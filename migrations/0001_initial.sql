-- Better Auth 1.7.11 owns the account, session and credential tables.
CREATE TABLE "user" (
  id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE session (
  id TEXT PRIMARY KEY NOT NULL, expiresAt TEXT NOT NULL, token TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, ipAddress TEXT, userAgent TEXT,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE INDEX session_user_idx ON session(userId);
CREATE TABLE account (
  id TEXT PRIMARY KEY NOT NULL, accountId TEXT NOT NULL, providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  accessToken TEXT, refreshToken TEXT, idToken TEXT,
  accessTokenExpiresAt TEXT, refreshTokenExpiresAt TEXT, scope TEXT, password TEXT,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE INDEX account_user_idx ON account(userId);
CREATE TABLE verification (
  id TEXT PRIMARY KEY NOT NULL, identifier TEXT NOT NULL, value TEXT NOT NULL,
  expiresAt TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE INDEX verification_identifier_idx ON verification(identifier);
CREATE TABLE rateLimit (
  id TEXT PRIMARY KEY NOT NULL, "key" TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL, lastRequest INTEGER NOT NULL
);
CREATE TABLE children (
  id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL CHECK(length(nickname) BETWEEN 1 AND 24),
  age INTEGER NOT NULL CHECK(age BETWEEN 4 AND 14),
  daily_minutes INTEGER NOT NULL CHECK(daily_minutes BETWEEN 5 AND 120),
  color TEXT NOT NULL CHECK(color IN ('violet','blue','sage','amber')),
  created_at TEXT NOT NULL
);
CREATE INDEX children_user_idx ON children(user_id);
CREATE TABLE goals (
  id TEXT PRIMARY KEY NOT NULL, child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(child_id,topic_id)
);
CREATE TABLE progress (
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE, topic_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('learning','mastered')),
  score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100), evidence_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL CHECK(source IN ('quiz','parent')), note TEXT, updated_at TEXT NOT NULL,
  PRIMARY KEY(child_id,topic_id)
);
CREATE TABLE quizzes (
  id TEXT PRIMARY KEY NOT NULL, child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL, content TEXT NOT NULL CHECK(json_valid(content)), question_key TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('starter','ai')),
  mode TEXT NOT NULL CHECK(mode IN ('practice','diagnose','review')), created_at TEXT NOT NULL
);
CREATE INDEX quizzes_child_idx ON quizzes(child_id,topic_id,created_at);
CREATE TABLE attempts (
  id TEXT PRIMARY KEY NOT NULL, quiz_id TEXT NOT NULL UNIQUE REFERENCES quizzes(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL, question_key TEXT NOT NULL,
  option_index INTEGER NOT NULL CHECK(option_index BETWEEN 0 AND 3),
  score REAL NOT NULL CHECK(score BETWEEN 0 AND 1), created_at TEXT NOT NULL
);
CREATE INDEX attempts_topic_idx ON attempts(child_id,topic_id,created_at);
CREATE TABLE reviews (
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE, topic_id TEXT NOT NULL,
  stage INTEGER NOT NULL CHECK(stage BETWEEN 0 AND 4), due_at TEXT NOT NULL,
  PRIMARY KEY(child_id,topic_id)
);
CREATE INDEX reviews_due_idx ON reviews(child_id,due_at);
CREATE TABLE ai_settings (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  protocol TEXT NOT NULL CHECK(protocol IN ('openai','anthropic')),
  base_url TEXT NOT NULL, model TEXT NOT NULL, encrypted_key TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE ai_usage (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  day TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,day)
);
CREATE TABLE messages (
  id TEXT PRIMARY KEY NOT NULL, child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX messages_topic_idx ON messages(child_id,topic_id,created_at);
CREATE TABLE exports (
  id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL, created_at TEXT NOT NULL
);
