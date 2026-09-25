-- Fathom clone schema. Applied by scripts/db/migrate.ts (idempotent).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS meetings (
  id              text PRIMARY KEY,
  title           text NOT NULL,
  source_title    text,
  started_at      timestamptz NOT NULL,
  duration_ms     integer NOT NULL DEFAULT 0,
  media_url       text,
  source_url      text,
  source_label    text,
  recorded_on     date,
  platform        text NOT NULL DEFAULT 'zoom',
  meeting_type    text NOT NULL DEFAULT 'general',
  default_template text NOT NULL DEFAULT 'general',
  status          text NOT NULL DEFAULT 'ready',   -- processing | ready | failed
  status_detail   text,
  shared_with_me  boolean NOT NULL DEFAULT false,
  share_token     text UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS participants (
  meeting_id text NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  key        integer NOT NULL,
  name       text NOT NULL,
  role       text,
  color      text NOT NULL,
  talk_ms    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (meeting_id, key)
);

CREATE TABLE IF NOT EXISTS utterances (
  meeting_id text NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  idx        integer NOT NULL,
  speaker    integer NOT NULL,
  start_ms   integer NOT NULL,
  end_ms     integer NOT NULL,
  text       text NOT NULL,
  tsv        tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  PRIMARY KEY (meeting_id, idx)
);
CREATE INDEX IF NOT EXISTS utterances_tsv ON utterances USING gin (tsv);

CREATE TABLE IF NOT EXISTS chapters (
  meeting_id text NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  idx        integer NOT NULL,
  title      text NOT NULL,
  gist       text NOT NULL DEFAULT '',
  start_ms   integer NOT NULL,
  end_ms     integer NOT NULL,
  PRIMARY KEY (meeting_id, idx)
);

CREATE TABLE IF NOT EXISTS summaries (
  meeting_id   text NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  content      jsonb NOT NULL,
  model        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, template_key)
);

CREATE TABLE IF NOT EXISTS action_items (
  id         serial PRIMARY KEY,
  meeting_id text NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  text       text NOT NULL,
  assignee   text,
  start_ms   integer,
  done       boolean NOT NULL DEFAULT false,
  tsv        tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);
CREATE INDEX IF NOT EXISTS action_items_meeting ON action_items (meeting_id);
CREATE INDEX IF NOT EXISTS action_items_tsv ON action_items USING gin (tsv);

CREATE TABLE IF NOT EXISTS highlights (
  id          text PRIMARY KEY,
  meeting_id  text NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  start_ms    integer NOT NULL,
  end_ms      integer NOT NULL,
  note        text NOT NULL DEFAULT '',
  source      text NOT NULL DEFAULT 'manual',    -- manual | live
  share_token text UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS highlights_meeting ON highlights (meeting_id);

CREATE TABLE IF NOT EXISTS calendar_events (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  attendees   jsonb NOT NULL DEFAULT '[]',
  platform    text NOT NULL DEFAULT 'zoom',
  external    boolean NOT NULL DEFAULT false,
  record      boolean NOT NULL DEFAULT true,
  replay_of   text REFERENCES meetings(id) ON DELETE SET NULL,  -- recording the live simulator replays
  meeting_id  text REFERENCES meetings(id) ON DELETE SET NULL,  -- meeting produced once "recorded"
  offset_min  integer,   -- demo: start relative to the current hour, so there is always a call to join
  length_min  integer
);
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS offset_min integer;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS length_min integer;

CREATE TABLE IF NOT EXISTS settings (
  id                 integer PRIMARY KEY DEFAULT 1,
  calendar_connected boolean NOT NULL DEFAULT false,
  calendar_email     text,
  auto_record        text NOT NULL DEFAULT 'all'     -- all | external | none
);
INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;
