import { ensureEventAccessSchema } from "@/lib/event-access";
import { getEventByKey } from "@/lib/events";
import { getDatabase } from "@/lib/neon";
import { describeStateChanges, ensureHistorySchema, recordHistoryVersion, type StoredPlannerState } from "@/lib/planner-history";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };
type ActionBody = {
  action?: "done" | "reopen" | "handoff" | "accept" | "decline";
  sessionId?: string;
  reason?: string;
  requestedTo?: string;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!token || token.length > 160) return json({ error: "Ugyldig lenke." }, 404);

  let body: ActionBody;
  try { body = await request.json() as ActionBody; } catch { return json({ error: "Ugyldig forespørsel." }, 400); }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 160) : "";
  if (!sessionId || !body.action) return json({ error: "Oppdrag og handling må oppgis." }, 400);

  try {
    await ensureEventAccessSchema();
    const sql = getDatabase();
    const [share] = await sql`
      SELECT event_key, photographer_id, photographer_name
      FROM event_shares WHERE token = ${token} AND enabled = TRUE LIMIT 1
    ` as Array<{ event_key: string; photographer_id: string; photographer_name: string }>;
    if (!share) return json({ error: "Lenken er deaktivert eller finnes ikke." }, 404);

    const [row] = await sql`
      SELECT state, revision, updated_by FROM event_states WHERE event_key = ${share.event_key}
    ` as Array<{ state: StoredPlannerState; revision: number; updated_by: string }>;
    if (!row) return json({ error: "Planen finnes ikke ennå." }, 404);

    const previous: StoredPlannerState = { ...row.state, taskProgress: row.state.taskProgress || {} };
    const next: StoredPlannerState = structuredClone(previous);
    const progress = next.taskProgress || (next.taskProgress = {});
    const assignment = next.assignments[sessionId];
    const existing = progress[sessionId];

    if (body.action === "done" || body.action === "reopen" || body.action === "handoff") {
      if (assignment?.photographerId !== share.photographer_id) return json({ error: "Oppdraget tilhører ikke denne fotografplanen." }, 403);
    }

    if (body.action === "done") progress[sessionId] = { status: "done" };
    if (body.action === "reopen") delete progress[sessionId];
    if (body.action === "handoff") {
      const requestedTo = typeof body.requestedTo === "string" ? body.requestedTo : "";
      if (!requestedTo || requestedTo === share.photographer_id || !next.photographers.some((person) => person.id === requestedTo)) {
        return json({ error: "Velg en annen fotograf i teamet." }, 400);
      }
      progress[sessionId] = {
        status: "handoff",
        reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 160) : "",
        requestedBy: share.photographer_id,
        requestedTo,
        requestedAt: new Date().toISOString(),
      };
    }
    if (body.action === "accept" || body.action === "decline") {
      if (existing?.status !== "handoff" || existing.requestedTo !== share.photographer_id) {
        return json({ error: "Forespørselen er ikke lenger aktiv." }, 409);
      }
      if (body.action === "accept" && assignment) next.assignments[sessionId] = { ...assignment, photographerId: share.photographer_id };
      delete progress[sessionId];
    }

    const serialized = JSON.stringify(next);
    const [saved] = await sql`
      UPDATE event_states SET state = ${serialized}::jsonb, revision = revision + 1,
        updated_at = NOW(), updated_by = ${`${share.photographer_name} · privat lenke`}
      WHERE event_key = ${share.event_key} AND revision = ${row.revision}
      RETURNING revision, updated_at
    ` as Array<{ revision: number; updated_at: string }>;
    if (!saved) return json({ error: "Planen ble nettopp endret. Oppdater siden og prøv igjen." }, 409);

    await ensureHistorySchema(sql);
    const event = await getEventByKey(share.event_key);
    const names = new Map(event?.program.map((item) => [item.id, item.title]) || []);
    await recordHistoryVersion(sql, share.event_key, previous, row.revision, "baseline", ["Tidligere versjon før fotografoppdateringen."], row.updated_by || "Redaktør");
    await recordHistoryVersion(sql, share.event_key, next, saved.revision, "save", describeStateChanges(previous, next, names), `${share.photographer_name} · privat lenke`);

    return json({ ok: true, revision: saved.revision, assignments: next.assignments, taskProgress: next.taskProgress });
  } catch (error) {
    console.error("Shared photographer task update failed", error);
    return json({ error: "Kunne ikke oppdatere oppdraget. Prøv igjen." }, 500);
  }
}
