CREATE TABLE IF NOT EXISTS event_states (
  event_key TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS event_states_updated_at_idx
  ON event_states (updated_at DESC);

CREATE TABLE IF NOT EXISTS event_state_history (
  id BIGSERIAL PRIMARY KEY,
  event_key TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  state JSONB NOT NULL,
  action TEXT NOT NULL DEFAULT 'save',
  changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by TEXT NOT NULL DEFAULT 'editor',
  UNIQUE (event_key, revision)
);

CREATE INDEX IF NOT EXISTS event_state_history_event_idx
  ON event_state_history (event_key, revision DESC);
