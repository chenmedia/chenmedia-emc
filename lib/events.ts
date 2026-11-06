import "server-only";

import { getDatabase } from "@/lib/neon";
import { plannerProgram, stageColors as defaultStageColors } from "@/lib/planner-program";

export const DEFAULT_EVENT_SLUG = "oslo-proptech-summit-2026";

export type EventProgramItem = (typeof plannerProgram)[number];

export type EmcEvent = {
  eventKey: string;
  slug: string;
  name: string;
  venue: string;
  startsOn: string;
  endsOn: string;
  timezone: string;
  status: "draft" | "planning" | "active" | "archived";
  logoUrl: string;
  program: EventProgramItem[];
  stageColors: Record<string, string>;
  revision: number;
  updatedAt: string | null;
  photographerCount: number;
  assignmentCount: number;
};

type EventRow = {
  event_key: string;
  slug: string;
  name: string;
  venue: string;
  starts_on: string;
  ends_on: string;
  timezone: string;
  status: EmcEvent["status"];
  logo_url: string;
  program: EventProgramItem[];
  stage_colors: Record<string, string>;
  revision: number | null;
  updated_at: string | null;
  photographer_count: number | null;
  assignment_count: number | null;
};

let schemaReady: Promise<void> | null = null;

export function ensureEventsSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getDatabase();
      await sql`
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
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS events_status_date_idx ON events (status, starts_on DESC)`;

      const serializedProgram = JSON.stringify(plannerProgram);
      const serializedStageColors = JSON.stringify(defaultStageColors);
      await sql`
        INSERT INTO events (
          event_key, slug, name, venue, starts_on, ends_on, timezone, status, logo_url, program, stage_colors
        ) VALUES (
          ${DEFAULT_EVENT_SLUG}, ${DEFAULT_EVENT_SLUG}, 'Oslo Proptech Summit 2026', 'Construction City',
          '2026-10-21'::date, '2026-10-21'::date, 'Europe/Oslo', 'active', '/ops-logo.png',
          ${serializedProgram}::jsonb, ${serializedStageColors}::jsonb
        )
        ON CONFLICT (event_key) DO NOTHING
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function mapEvent(row: EventRow): EmcEvent {
  return {
    eventKey: row.event_key,
    slug: row.slug,
    name: row.name,
    venue: row.venue,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    timezone: row.timezone,
    status: row.status,
    logoUrl: row.logo_url,
    program: Array.isArray(row.program) ? row.program : [],
    stageColors: row.stage_colors && typeof row.stage_colors === "object" ? row.stage_colors : {},
    revision: Number(row.revision || 0),
    updatedAt: row.updated_at,
    photographerCount: Number(row.photographer_count || 0),
    assignmentCount: Number(row.assignment_count || 0),
  };
}

const eventSelect = `
  SELECT e.event_key, e.slug, e.name, e.venue, e.starts_on::text, e.ends_on::text,
         e.timezone, e.status, e.logo_url, e.program, e.stage_colors,
         s.revision, s.updated_at,
         COALESCE(jsonb_array_length(s.state->'photographers'), 0)::int AS photographer_count,
         COALESCE((SELECT count(*) FROM jsonb_object_keys(COALESCE(s.state->'assignments', '{}'::jsonb))), 0)::int AS assignment_count
  FROM events e
  LEFT JOIN event_states s ON s.event_key = e.event_key
`;

export async function listEvents() {
  await ensureEventsSchema();
  const sql = getDatabase();
  const rows = await sql.query(`${eventSelect} ORDER BY e.starts_on DESC, e.name ASC`) as EventRow[];
  return rows.map(mapEvent);
}

export async function getEventByKey(eventKey: string) {
  await ensureEventsSchema();
  const sql = getDatabase();
  const rows = await sql.query(`${eventSelect} WHERE e.event_key = $1 LIMIT 1`, [eventKey]) as EventRow[];
  return rows[0] ? mapEvent(rows[0]) : null;
}

export async function getEventBySlug(slug: string) {
  await ensureEventsSchema();
  const sql = getDatabase();
  const rows = await sql.query(`${eventSelect} WHERE e.slug = $1 LIMIT 1`, [slug]) as EventRow[];
  return rows[0] ? mapEvent(rows[0]) : null;
}

export function formatEventDate(event: Pick<EmcEvent, "startsOn" | "endsOn" | "timezone">) {
  const start = new Date(`${event.startsOn}T12:00:00Z`);
  const end = new Date(`${event.endsOn}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: event.timezone,
  });
  if (event.startsOn === event.endsOn) return formatter.format(start);
  return `${formatter.format(start)}–${formatter.format(end)}`;
}

export function eventStages(event: EmcEvent) {
  const names = [...new Set(event.program.map((session) => session.stage))];
  return ["Alle", ...names];
}

export function eventStageCounts(event: EmcEvent) {
  return Object.fromEntries(eventStages(event).map((stage) => [
    stage,
    stage === "Alle" ? event.program.length : event.program.filter((item) => item.stage === stage).length,
  ]));
}
