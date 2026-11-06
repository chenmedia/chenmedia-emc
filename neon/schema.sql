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

CREATE TABLE IF NOT EXISTS events (
  event_key TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  venue TEXT NOT NULL DEFAULT '',
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Oslo',
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('draft', 'planning', 'active', 'archived')),
  logo_url TEXT NOT NULL DEFAULT '/ops-logo.png',
  program JSONB NOT NULL DEFAULT '[]'::jsonb,
  stage_colors JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS events_status_date_idx
  ON events (status, starts_on DESC);

CREATE TABLE IF NOT EXISTS event_members (
  event_key TEXT NOT NULL REFERENCES events(event_key) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by TEXT NOT NULL DEFAULT 'system',
  PRIMARY KEY (event_key, email)
);

CREATE INDEX IF NOT EXISTS event_members_email_idx ON event_members (LOWER(email));

CREATE TABLE IF NOT EXISTS event_shares (
  token TEXT PRIMARY KEY,
  event_key TEXT NOT NULL REFERENCES events(event_key) ON DELETE CASCADE,
  photographer_id TEXT NOT NULL,
  photographer_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_viewed_revision INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL DEFAULT 'editor',
  UNIQUE (event_key, photographer_id)
);

CREATE INDEX IF NOT EXISTS event_shares_event_idx ON event_shares (event_key, enabled);
