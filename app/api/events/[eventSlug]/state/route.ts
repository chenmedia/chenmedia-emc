import { editorLabel, getEditor, isEditor } from "@/lib/auth";
import { getEventBySlug } from "@/lib/events";
import { getDatabase } from "@/lib/neon";
import { describeStateChanges, ensureHistorySchema, recordHistoryVersion, type StoredPlannerState } from "@/lib/planner-history";

export const dynamic = "force-dynamic";

const EMPTY_STATE: StoredPlannerState = { photographers: [], assignments: {} };

type RouteContext = { params: Promise<{ eventSlug: string }> };
type EventStateRow = { state: StoredPlannerState; revision: number; updated_at: string; updated_by: string };

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function validTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function cleanState(input: unknown): StoredPlannerState | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<StoredPlannerState>;
  if (!Array.isArray(candidate.photographers) || !candidate.assignments || typeof candidate.assignments !== "object") return null;
  if (candidate.photographers.length > 100 || Object.keys(candidate.assignments).length > 1000) return null;

  const photographers = candidate.photographers.flatMap((person) => {
    if (!person || typeof person !== "object") return [];
    const value = person as unknown as Record<string, unknown>;
    if (typeof value.id !== "string" || typeof value.name !== "string" || !validTime(value.from) || !validTime(value.to)) return [];
    return [{
      id: value.id.slice(0, 100),
      name: value.name.trim().slice(0, 120),
      phone: typeof value.phone === "string" ? value.phone.trim().slice(0, 40) : "",
      role: typeof value.role === "string" ? value.role.trim().slice(0, 80) : "Scene",
      from: value.from,
      to: value.to,
      color: typeof value.color === "string" && /^#[0-9a-f]{6}$/i.test(value.color) ? value.color : "#37c9d4",
    }];
  });

  const photographerIds = new Set(photographers.map((person) => person.id));
  const assignments = Object.fromEntries(Object.entries(candidate.assignments).flatMap(([sessionId, assignment]) => {
    if (!assignment || typeof assignment !== "object") return [];
    const value = assignment as unknown as Record<string, unknown>;
    if (typeof value.photographerId !== "string" || !photographerIds.has(value.photographerId)) return [];
    const timing = value.timing === "end" || value.timing === "whole" ? value.timing : "start";
    return [[sessionId.slice(0, 160), { photographerId: value.photographerId, timing }]];
  })) as StoredPlannerState["assignments"];

  return { photographers, assignments };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { eventSlug } = await context.params;
    const [event, canEdit] = await Promise.all([getEventBySlug(eventSlug), isEditor()]);
    if (!event) return json({ error: "Fant ikke eventet." }, 404);
    const sql = getDatabase();
    const [row] = await sql`
      SELECT state, revision, updated_at, updated_by FROM event_states WHERE event_key = ${event.eventKey}
    ` as EventStateRow[];
    if (!row) return json({ exists: false, state: EMPTY_STATE, revision: 0, updatedAt: null, canEdit });

    const visibleState = canEdit ? row.state : {
      ...row.state,
      photographers: row.state.photographers.map((person) => ({ ...person, phone: "" })),
    };
    return json({ exists: true, state: visibleState, revision: row.revision, updatedAt: row.updated_at, canEdit });
  } catch (error) {
    console.error("Event state read failed", error);
    return json({ error: "Kunne ikke hente planen." }, 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const editor = await getEditor();
  if (!editor) return json({ error: "Du må være logget inn som redaktør." }, 401);
  const { eventSlug } = await context.params;
  const event = await getEventBySlug(eventSlug);
  if (!event) return json({ error: "Fant ikke eventet." }, 404);

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Ugyldig forespørsel." }, 400); }
  const state = cleanState((body as { state?: unknown })?.state);
  if (!state) return json({ error: "Planen inneholder ugyldige data." }, 400);

  try {
    const sql = getDatabase();
    await ensureHistorySchema(sql);
    const [previous] = await sql`
      SELECT state, revision, updated_at, updated_by FROM event_states WHERE event_key = ${event.eventKey}
    ` as EventStateRow[];
    const changedBy = editorLabel(editor);
    if (previous) {
      await recordHistoryVersion(sql, event.eventKey, previous.state, previous.revision, "baseline", ["Tidligere versjon før endringen."], previous.updated_by || "Redaktør");
    }
    const serialized = JSON.stringify(state);
    const [saved] = await sql`
      INSERT INTO event_states (event_key, state, revision, updated_at, updated_by)
      VALUES (${event.eventKey}, ${serialized}::jsonb, 1, NOW(), ${changedBy})
      ON CONFLICT (event_key) DO UPDATE SET
        state = EXCLUDED.state,
        revision = event_states.revision + 1,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING revision, updated_at
    ` as Array<{ revision: number; updated_at: string }>;
    const sessionNames = new Map(event.program.map((session) => [session.id, session.title]));
    await recordHistoryVersion(sql, event.eventKey, state, saved.revision, "save", describeStateChanges(previous?.state ?? null, state, sessionNames), changedBy);
    return json({ ok: true, revision: saved.revision, updatedAt: saved.updated_at });
  } catch (error) {
    console.error("Event state save failed", error);
    return json({ error: "Kunne ikke lagre planen." }, 500);
  }
}
