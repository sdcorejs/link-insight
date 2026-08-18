CREATE TABLE rate_limit_windows (
  installation_id TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  FOREIGN KEY (installation_id) REFERENCES installations (installation_id) ON DELETE CASCADE
);

CREATE INDEX rate_limit_window_idx ON rate_limit_windows (window_started_at);
