import type { EncryptedToken } from './token-crypto';

export interface StoredJiraSite {
  readonly cloudId: string;
  readonly host: string;
  readonly displayName: string;
}

export interface OAuthStateRecord {
  readonly extensionId: string;
  readonly redirectUri: string;
  readonly codeChallenge: string;
}

export interface AuthenticatedInstallation {
  readonly installationId: string;
  readonly encryptedRefreshToken: EncryptedToken;
  readonly scopes: string;
  readonly sites: readonly StoredJiraSite[];
}

interface SessionStoreOptions {
  readonly now?: () => number;
  readonly sessionIdleTtlSeconds?: number;
}

const DEFAULT_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export class SessionStore {
  private readonly now: () => number;
  private readonly sessionIdleTtlSeconds: number;

  constructor(
    private readonly db: D1Database,
    options: SessionStoreOptions = {},
  ) {
    this.now = options.now ?? (() => Math.floor(Date.now() / 1_000));
    this.sessionIdleTtlSeconds = options.sessionIdleTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  }

  async putOAuthState(input: {
    readonly stateHash: string;
    readonly extensionId: string;
    readonly redirectUri: string;
    readonly codeChallenge: string;
    readonly expiresAt: number;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO oauth_states
          (state_hash, extension_id, redirect_uri, code_challenge, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.stateHash,
        input.extensionId,
        input.redirectUri,
        input.codeChallenge,
        this.now(),
        input.expiresAt,
      )
      .run();
  }

  async consumeOAuthState(stateHash: string): Promise<OAuthStateRecord | null> {
    const now = this.now();
    const row = await this.db
      .prepare(
        `SELECT extension_id, redirect_uri, code_challenge
         FROM oauth_states
         WHERE state_hash = ? AND consumed_at IS NULL AND expires_at >= ?`,
      )
      .bind(stateHash, now)
      .first<Record<string, unknown>>();
    if (row === null) {
      return null;
    }
    const update = await this.db
      .prepare(
        `UPDATE oauth_states SET consumed_at = ?
         WHERE state_hash = ? AND consumed_at IS NULL AND expires_at >= ?`,
      )
      .bind(now, stateHash, now)
      .run();
    if (update.meta.changes !== 1) {
      return null;
    }
    return {
      extensionId: requireRowString(row.extension_id),
      redirectUri: requireRowString(row.redirect_uri),
      codeChallenge: requireRowString(row.code_challenge),
    };
  }

  async createPendingInstallation(input: {
    readonly installationId: string;
    readonly encryptedRefreshToken: EncryptedToken;
    readonly scopes: string;
    readonly sites: readonly StoredJiraSite[];
    readonly exchangeCodeHash: string;
    readonly codeChallenge: string;
    readonly redirectUri: string;
    readonly exchangeExpiresAt: number;
  }): Promise<void> {
    const now = this.now();
    const statements: D1PreparedStatement[] = [
      this.db
        .prepare(
          `INSERT INTO installations
            (installation_id, created_at, last_activity_at, expires_at)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(input.installationId, now, now, now + this.sessionIdleTtlSeconds),
      this.db
        .prepare(
          `INSERT INTO grants
            (installation_id, refresh_token_ciphertext, refresh_token_iv, key_version, scopes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          input.installationId,
          input.encryptedRefreshToken.ciphertext,
          input.encryptedRefreshToken.iv,
          input.encryptedRefreshToken.keyVersion,
          input.scopes,
          now,
          now,
        ),
      this.db
        .prepare(
          `INSERT INTO exchange_codes
            (exchange_code_hash, installation_id, code_challenge, redirect_uri, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          input.exchangeCodeHash,
          input.installationId,
          input.codeChallenge,
          input.redirectUri,
          now,
          input.exchangeExpiresAt,
        ),
      ...input.sites.map((site) =>
        this.db
          .prepare(
            `INSERT INTO jira_sites
              (installation_id, cloud_id, host, display_name, created_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(input.installationId, site.cloudId, site.host, site.displayName, now),
      ),
    ];
    await this.db.batch(statements);
  }

  async exchangeSession(input: {
    readonly exchangeCodeHash: string;
    readonly codeChallenge: string;
    readonly redirectUri: string;
    readonly sessionTokenHash: string;
  }): Promise<{
    readonly installationId: string;
    readonly sites: readonly StoredJiraSite[];
  } | null> {
    const now = this.now();
    const row = await this.db
      .prepare(
        `SELECT installation_id, code_challenge, redirect_uri
         FROM exchange_codes
         WHERE exchange_code_hash = ? AND consumed_at IS NULL AND expires_at >= ?`,
      )
      .bind(input.exchangeCodeHash, now)
      .first<Record<string, unknown>>();
    if (
      row === null ||
      row.code_challenge !== input.codeChallenge ||
      row.redirect_uri !== input.redirectUri
    ) {
      return null;
    }
    const consume = await this.db
      .prepare(
        `UPDATE exchange_codes SET consumed_at = ?
         WHERE exchange_code_hash = ? AND consumed_at IS NULL AND expires_at >= ?`,
      )
      .bind(now, input.exchangeCodeHash, now)
      .run();
    if (consume.meta.changes !== 1) {
      return null;
    }
    const installationId = requireRowString(row.installation_id);
    await this.db
      .prepare(
        `UPDATE installations
         SET session_token_hash = ?, last_activity_at = ?, expires_at = ?
         WHERE installation_id = ? AND revoked_at IS NULL`,
      )
      .bind(input.sessionTokenHash, now, now + this.sessionIdleTtlSeconds, installationId)
      .run();
    return { installationId, sites: await this.listSites(installationId) };
  }

  async loadSession(sessionTokenHash: string): Promise<AuthenticatedInstallation | null> {
    const now = this.now();
    const row = await this.db
      .prepare(
        `SELECT i.installation_id, g.refresh_token_ciphertext, g.refresh_token_iv,
                g.key_version, g.scopes
         FROM installations i
         JOIN grants g ON g.installation_id = i.installation_id
         WHERE i.session_token_hash = ? AND i.revoked_at IS NULL AND i.expires_at >= ?`,
      )
      .bind(sessionTokenHash, now)
      .first<Record<string, unknown>>();
    if (row === null || row.key_version !== 1) {
      return null;
    }
    const installationId = requireRowString(row.installation_id);
    await this.db
      .prepare(
        `UPDATE installations SET last_activity_at = ?, expires_at = ?
         WHERE installation_id = ?`,
      )
      .bind(now, now + this.sessionIdleTtlSeconds, installationId)
      .run();
    return {
      installationId,
      encryptedRefreshToken: {
        ciphertext: requireRowString(row.refresh_token_ciphertext),
        iv: requireRowString(row.refresh_token_iv),
        keyVersion: 1,
      },
      scopes: requireRowString(row.scopes),
      sites: await this.listSites(installationId),
    };
  }

  async disconnect(sessionTokenHash: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM installations WHERE session_token_hash = ?')
      .bind(sessionTokenHash)
      .run();
    return result.meta.changes === 1;
  }

  async acquireRefreshLease(
    installationId: string,
    leaseId: string,
    expiresAt: number,
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        `INSERT INTO refresh_leases (installation_id, lease_id, expires_at)
         VALUES (?, ?, ?)
         ON CONFLICT (installation_id) DO UPDATE
           SET lease_id = excluded.lease_id, expires_at = excluded.expires_at
         WHERE refresh_leases.expires_at <= ?`,
      )
      .bind(installationId, leaseId, expiresAt, this.now())
      .run();
    return result.meta.changes === 1;
  }

  async completeRefresh(
    installationId: string,
    leaseId: string,
    encryptedRefreshToken: EncryptedToken,
  ): Promise<boolean> {
    const lease = await this.db
      .prepare('SELECT lease_id FROM refresh_leases WHERE installation_id = ? AND expires_at >= ?')
      .bind(installationId, this.now())
      .first<{ lease_id: string }>();
    if (lease?.lease_id !== leaseId) {
      return false;
    }
    const results = await this.db.batch([
      this.db
        .prepare(
          `UPDATE grants
           SET refresh_token_ciphertext = ?, refresh_token_iv = ?, key_version = ?, updated_at = ?
           WHERE installation_id = ?`,
        )
        .bind(
          encryptedRefreshToken.ciphertext,
          encryptedRefreshToken.iv,
          encryptedRefreshToken.keyVersion,
          this.now(),
          installationId,
        ),
      this.db
        .prepare('DELETE FROM refresh_leases WHERE installation_id = ? AND lease_id = ?')
        .bind(installationId, leaseId),
    ]);
    return results.every((result) => result.success);
  }

  async releaseRefreshLease(installationId: string, leaseId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM refresh_leases WHERE installation_id = ? AND lease_id = ?')
      .bind(installationId, leaseId)
      .run();
  }

  async claimIdempotency(
    installationId: string,
    keyHash: string,
    operationHash: string,
    expiresAt: number,
  ): Promise<{ readonly state: 'claimed' | 'pending' | 'applied' | 'ambiguous' | 'conflict' }> {
    const insert = await this.db
      .prepare(
        `INSERT OR IGNORE INTO idempotency_records
          (installation_id, key_hash, operation_hash, outcome, created_at, expires_at)
         VALUES (?, ?, ?, 'pending', ?, ?)`,
      )
      .bind(installationId, keyHash, operationHash, this.now(), expiresAt)
      .run();
    if (insert.meta.changes === 1) {
      return { state: 'claimed' };
    }
    const row = await this.db
      .prepare(
        `SELECT operation_hash, outcome FROM idempotency_records
         WHERE installation_id = ? AND key_hash = ? AND expires_at >= ?`,
      )
      .bind(installationId, keyHash, this.now())
      .first<Record<string, unknown>>();
    if (row === null || row.operation_hash !== operationHash) {
      return { state: 'conflict' };
    }
    return { state: row.outcome as 'pending' | 'applied' | 'ambiguous' };
  }

  async completeIdempotency(
    installationId: string,
    keyHash: string,
    outcome: 'applied' | 'ambiguous',
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        `UPDATE idempotency_records SET outcome = ?
         WHERE installation_id = ? AND key_hash = ? AND outcome = 'pending'`,
      )
      .bind(outcome, installationId, keyHash)
      .run();
    return result.meta.changes === 1;
  }

  async abandonIdempotency(installationId: string, keyHash: string): Promise<void> {
    await this.db
      .prepare(
        `DELETE FROM idempotency_records
         WHERE installation_id = ? AND key_hash = ? AND outcome = 'pending'`,
      )
      .bind(installationId, keyHash)
      .run();
  }

  async consumeRateLimit(
    installationId: string,
    maximumRequests: number,
    windowSeconds: number,
  ): Promise<boolean> {
    const now = this.now();
    const cutoff = now - windowSeconds;
    const result = await this.db
      .prepare(
        `INSERT INTO rate_limit_windows (installation_id, window_started_at, request_count)
         VALUES (?, ?, 1)
         ON CONFLICT (installation_id) DO UPDATE SET
           window_started_at = CASE
             WHEN rate_limit_windows.window_started_at <= ? THEN excluded.window_started_at
             ELSE rate_limit_windows.window_started_at
           END,
           request_count = CASE
             WHEN rate_limit_windows.window_started_at <= ? THEN 1
             ELSE rate_limit_windows.request_count + 1
           END
         WHERE rate_limit_windows.window_started_at <= ?
            OR rate_limit_windows.request_count < ?`,
      )
      .bind(installationId, now, cutoff, cutoff, cutoff, maximumRequests)
      .run();
    return result.meta.changes === 1;
  }

  async revokeInstallation(installationId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM installations WHERE installation_id = ?')
      .bind(installationId)
      .run();
  }

  async cleanupExpired(): Promise<void> {
    const now = this.now();
    await this.db.batch([
      this.db
        .prepare('DELETE FROM installations WHERE expires_at < ? OR revoked_at IS NOT NULL')
        .bind(now),
      this.db
        .prepare('DELETE FROM oauth_states WHERE expires_at < ? OR consumed_at IS NOT NULL')
        .bind(now),
      this.db
        .prepare('DELETE FROM exchange_codes WHERE expires_at < ? OR consumed_at IS NOT NULL')
        .bind(now),
      this.db.prepare('DELETE FROM refresh_leases WHERE expires_at < ?').bind(now),
      this.db.prepare('DELETE FROM idempotency_records WHERE expires_at < ?').bind(now),
      this.db
        .prepare('DELETE FROM rate_limit_windows WHERE window_started_at < ?')
        .bind(now - 2 * 60),
    ]);
  }

  async listSites(installationId: string): Promise<readonly StoredJiraSite[]> {
    const result = await this.db
      .prepare(
        `SELECT cloud_id, host, display_name FROM jira_sites
         WHERE installation_id = ? ORDER BY display_name, host`,
      )
      .bind(installationId)
      .all<Record<string, unknown>>();
    return result.results.map((row) => ({
      cloudId: requireRowString(row.cloud_id),
      host: requireRowString(row.host),
      displayName: requireRowString(row.display_name),
    }));
  }
}

function requireRowString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('D1 returned an invalid stored record.');
  }
  return value;
}
