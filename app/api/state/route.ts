import { isEditor } from "@/lib/auth";
import { getDatabase } from "@/lib/neon";

export const dynamic = "force-dynamic";

const EVENT_KEY = "oslo-proptech-summit-2026";
const EMPTY_STATE = { photographers: [], assignments: {} };

type PlannerState = {
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

type EventStateRow = {
  state: PlannerState;
  revision: number;
  updated_at: string;
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function validTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function cleanState(input: unknown): PlannerState | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<PlannerState>;
  if (!Array.isArray(candidate.photographers) || !candidate.assignments || typeof candidate.assignments !== "object") return null;
  if (candidate.photographers.length > 100 || Object.keys(candidate.assignments).length > 500) return null;

  const photographers = candidate.photographers.flatMap((person) => {
    if (!person || typeof person !== "object") return [];
    const value = person as Record<string, unknown>;
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
    const value = assignment as Record<string, unknown>;
    if (typeof value.photographerId !== "string" || !photographerIds.has(value.photographerId)) return [];
    const timing = value.timing === "end" || value.timing === "whole" ? value.timing : "start";
    return [[sessionId.slice(0, 160), { photographerId: value.photographerId, timing }]];
  })) as PlannerState["assignments"];

  return { photographers, assignments };
}

export async function GET() {
  try {
    const [canEdit, sql] = await Promise.all([isEditor(), Promise.resolve(getDatabase())]);
    const [row] = await sql`SELECT state, revision, updated_at FROM event_states WHERE event_key = ${EVENT_KEY}` as EventStateRow[];
    if (!row) return json({ exists: false, state: EMPTY_STATE, revision: 0, updatedAt: null, canEdit });

    const visibleState = canEdit ? row.state : {
      ...row.state,
      photographers: row.state.photographers.map((person) => ({ ...person, phone: "" })),
    };

    return json({
      exists: true,
      state: visibleState,
      revision: row.revision,
      updatedAt: row.updated_at,
      canEdit,
    });
  } catch (error) {
    console.error("State read failed", error);
    return json({ error: "Kunne ikke hente planen." }, 500);
  }
}

export async function POST(request: Request) {
  if (!(await isEditor())) return json({ error: "Du må være logget inn som redaktør." }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Ugyldig forespørsel." }, 400);
  }

  const state = cleanState((body as { state?: unknown })?.state);
  if (!state) return json({ error: "Planen inneholder ugyldige data." }, 400);

  try {
    const sql = getDatabase();
    const serialized = JSON.stringify(state);
    const [saved] = await sql`
      INSERT INTO event_states (event_key, state, revision, updated_at, updated_by)
      VALUES (${EVENT_KEY}, ${serialized}::jsonb, 1, NOW(), 'editor')
      ON CONFLICT (event_key) DO UPDATE SET
        state = EXCLUDED.state,
        revision = event_states.revision + 1,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING revision, updated_at
    ` as Array<{ revision: number; updated_at: string }>;

    return json({ ok: true, revision: saved.revision, updatedAt: saved.updated_at });
  } catch (error) {
    console.error("State save failed", error);
    return json({ error: "Kunne ikke lagre planen." }, 500);
  }
}
