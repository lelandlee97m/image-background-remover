-- Sessions table for Google OAuth
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  google_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  picture TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
