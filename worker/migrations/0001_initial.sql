PRAGMA foreign_keys = ON;

CREATE TABLE installations (
  installation_id TEXT PRIMARY KEY,
  session_token_hash TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX installations_expiry_idx ON installations (expires_at);

CREATE TABLE grants (
  installation_id TEXT PRIMARY KEY,
  refresh_token_ciphertext TEXT NOT NULL,
  refresh_token_iv TEXT NOT NULL,
  key_version INTEGER NOT NULL,
  scopes TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (installation_id) REFERENCES installations (installation_id) ON DELETE CASCADE
);

CREATE TABLE jira_sites (
  installation_id TEXT NOT NULL,
  cloud_id TEXT NOT NULL,
  host TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (installation_id, cloud_id),
  UNIQUE (installation_id, host),
  FOREIGN KEY (installation_id) REFERENCES installations (installation_id) ON DELETE CASCADE
);

CREATE TABLE oauth_states (
  state_hash TEXT PRIMARY KEY,
  extension_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);

CREATE INDEX oauth_states_expiry_idx ON oauth_states (expires_at);

CREATE TABLE exchange_codes (
  exchange_code_hash TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  FOREIGN KEY (installation_id) REFERENCES installations (installation_id) ON DELETE CASCADE
);

CREATE INDEX exchange_codes_expiry_idx ON exchange_codes (expires_at);

CREATE TABLE refresh_leases (
  installation_id TEXT PRIMARY KEY,
  lease_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (installation_id) REFERENCES installations (installation_id) ON DELETE CASCADE
);

CREATE INDEX refresh_leases_expiry_idx ON refresh_leases (expires_at);

CREATE TABLE idempotency_records (
  installation_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  operation_hash TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('pending', 'applied', 'ambiguous')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (installation_id, key_hash),
  FOREIGN KEY (installation_id) REFERENCES installations (installation_id) ON DELETE CASCADE
);

CREATE INDEX idempotency_expiry_idx ON idempotency_records (expires_at);
