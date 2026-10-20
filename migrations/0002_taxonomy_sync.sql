CREATE TABLE IF NOT EXISTS taxonomy_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision TEXT,
  checked_revision TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  last_attempt TEXT,
  last_success TEXT,
  error_code TEXT,
  lease_id TEXT,
  lease_until TEXT
);
INSERT OR IGNORE INTO taxonomy_state (id) VALUES (1);
