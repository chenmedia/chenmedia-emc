import "server-only";

import { getDatabase } from "@/lib/neon";
import { plannerProgram } from "@/lib/planner-program";

export const EVENT_KEY = "oslo-proptech-summit-2026";

export type StoredPlannerState = {
  photographers: Array<{
    id: string;
    name: string;
    phone: string;
    role: string;
    from: string;
    to: string;
    color: string;
  }>;
  assignments: Record<string, { photographerId: string; timing: "start" | "end" | "whole" }>;
};

type Sql = ReturnType<typeof getDatabase>;

const sessionNames = new Map(plannerProgram.map((session) => [session.id, session.title]));
let schemaReady: Promise<void> | null = null;

export function ensureHistorySchema(sql: Sql) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
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
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS event_state_history_event_idx ON event_state_history (event_key, revision DESC)`;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function photographerName(state: StoredPlannerState, id: string | undefined) {
  return state.photographers.find((person) => person.id === id)?.name || "ukjent fotograf";
}

function timingLabel(timing: "start" | "end" | "whole") {
  return timing === "end" ? "slutt" : timing === "whole" ? "hele programposten" : "start";
}

export function describeStateChanges(previous: StoredPlannerState | null, next: StoredPlannerState) {
  if (!previous) return ["Opprettet den sentrale bemanningsplanen."];

  const changes: string[] = [];
  const previousPeople = new Map(previous.photographers.map((person) => [person.id, person]));
  const nextPeople = new Map(next.photographers.map((person) => [person.id, person]));

  next.photographers.forEach((person) => {
    const before = previousPeople.get(person.id);
    if (!before) changes.push(`La til fotograf ${person.name}.`);
    else if (JSON.stringify(before) !== JSON.stringify(person)) changes.push(`Oppdaterte fotografdetaljene for ${person.name}.`);
  });
  previous.photographers.forEach((person) => {
    if (!nextPeople.has(person.id)) changes.push(`Fjernet fotograf ${person.name}.`);
  });

  const sessionIds = new Set([...Object.keys(previous.assignments), ...Object.keys(next.assignments)]);
  sessionIds.forEach((sessionId) => {
    const before = previous.assignments[sessionId];
    const after = next.assignments[sessionId];
    const title = sessionNames.get(sessionId) || sessionId;
    if (!before && after) {
      changes.push(`Tildelte «${title}» til ${photographerName(next, after.photographerId)} (${timingLabel(after.timing)}).`);
    } else if (before && !after) {
      changes.push(`Fjernet ${photographerName(previous, before.photographerId)} fra «${title}».`);
    } else if (before && after && (before.photographerId !== after.photographerId || before.timing !== after.timing)) {
      changes.push(`Endret «${title}» fra ${photographerName(previous, before.photographerId)} (${timingLabel(before.timing)}) til ${photographerName(next, after.photographerId)} (${timingLabel(after.timing)}).`);
    }
  });

  return changes.length ? changes : ["Lagret planen uten synlige bemanningsendringer."];
}

export async function recordHistoryVersion(
  sql: Sql,
  state: StoredPlannerState,
  revision: number,
  action: "save" | "restore" | "baseline",
  changes: string[],
  changedBy: string,
) {
  await ensureHistorySchema(sql);
  const serializedState = JSON.stringify(state);
  const serializedChanges = JSON.stringify(changes);
  await sql`
    INSERT INTO event_state_history (event_key, revision, state, action, changes, changed_at, changed_by)
    VALUES (${EVENT_KEY}, ${revision}, ${serializedState}::jsonb, ${action}, ${serializedChanges}::jsonb, NOW(), ${changedBy})
    ON CONFLICT (event_key, revision) DO NOTHING
  `;
}
