CREATE TABLE owner_auth_sessions (
    session_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    PRIMARY KEY (session_id, scope)
);
CREATE INDEX owner_auth_sessions_expiry
ON owner_auth_sessions (expires_at);