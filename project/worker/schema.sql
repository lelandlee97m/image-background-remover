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

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Users table (synced from OAuth sessions)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  tier TEXT DEFAULT 'free',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Credits table
CREATE TABLE IF NOT EXISTS credits (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  balance INTEGER DEFAULT 0,
  source TEXT,
  pack_type TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id);

-- Usage log table
CREATE TABLE IF NOT EXISTS usage_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  device_fingerprint TEXT,
  ip_address TEXT,
  action TEXT DEFAULT 'remove_bg',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_usage_log_user ON usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_fp ON usage_log(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_usage_log_created ON usage_log(created_at);

-- Guest usage tracking table
CREATE TABLE IF NOT EXISTS guest_usage (
  device_fingerprint TEXT PRIMARY KEY,
  usage_count INTEGER DEFAULT 0,
  last_used TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- PayPal orders (one-time credit pack purchases)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  paypal_order_id TEXT UNIQUE NOT NULL,
  pack_type TEXT NOT NULL,
  credits INTEGER NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_paypal_id ON orders(paypal_order_id);

-- PayPal subscriptions (recurring plans)
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  paypal_subscription_id TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL,
  tier TEXT DEFAULT 'pro_lite',
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'active',
  credits_per_cycle INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  next_billing_at TEXT,
  cancelled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paypal_id ON subscriptions(paypal_subscription_id);
