-- Sessions table for Google OAuth
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  google_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  picture TEXT,
  created_at TEXT,
  expires_at TEXT NOT NULL
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Usage tracking for daily quota (3/day per user)
CREATE TABLE IF NOT EXISTS usage_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_identifier TEXT NOT NULL,
  date TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_identifier, date)
);
CREATE INDEX IF NOT EXISTS idx_usage_ident_date ON usage_tracking(user_identifier, date);
