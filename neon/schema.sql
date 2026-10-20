CREATE TABLE IF NOT EXISTS event_states (
  event_key TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS event_states_updated_at_idx
  ON event_states (updated_at DESC);
