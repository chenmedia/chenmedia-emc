import { isEditor } from "@/lib/auth";
import { getDatabase } from "@/lib/neon";
import { ensureHistorySchema, EVENT_KEY, recordHistoryVersion, type StoredPlannerState } from "@/lib/planner-history";

export const dynamic = "force-dynamic";

type HistoryRow = {
  revision: number;
  action: "save" | "restore" | "baseline";
  changes: string[];
  changed_at: string;
  changed_by: string;
  photographer_count: number;
  assignment_count: number;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  if (!(await isEditor())) return json({ error: "Du må være logget inn som redaktør." }, 401);

  try {
    const sql = getDatabase();
    await ensureHistorySchema(sql);
    const [current] = await sql`SELECT state, revision FROM event_states WHERE event_key = ${EVENT_KEY}` as Array<{ state: StoredPlannerState; revision: number }>;
    if (current) {
      await recordHistoryVersion(sql, current.state, current.revision, "baseline", ["Startpunkt da endringshistorikken ble aktivert."]);
    }
    const rows = await sql`
      SELECT revision, action, changes, changed_at, changed_by,
             jsonb_array_length(state->'photographers')::int AS photographer_count,
             (SELECT count(*) FROM jsonb_object_keys(state->'assignments'))::int AS assignment_count
      FROM event_state_history
      WHERE event_key = ${EVENT_KEY}
      ORDER BY revision DESC
      LIMIT 100
    ` as HistoryRow[];

    return json({ currentRevision: current?.revision ?? 0, entries: rows.map((row) => ({
      revision: row.revision,
      action: row.action,
      changes: Array.isArray(row.changes) ? row.changes : [],
      changedAt: row.changed_at,
      changedBy: row.changed_by === "editor" ? "Redaktør" : row.changed_by,
      photographerCount: Number(row.photographer_count),
      assignmentCount: Number(row.assignment_count),
    })) });
  } catch (error) {
    console.error("History read failed", error);
    return json({ error: "Kunne ikke hente endringshistorikken." }, 500);
  }
}

export async function POST(request: Request) {
  if (!(await isEditor())) return json({ error: "Du må være logget inn som redaktør." }, 401);

  let revision = 0;
  try {
    const body = await request.json() as { revision?: unknown };
    revision = typeof body.revision === "number" && Number.isInteger(body.revision) ? body.revision : 0;
  } catch {
    return json({ error: "Ugyldig forespørsel." }, 400);
  }
  if (revision < 1) return json({ error: "Ugyldig revisjon." }, 400);

  try {
    const sql = getDatabase();
    await ensureHistorySchema(sql);
    const [snapshot] = await sql`
      SELECT state FROM event_state_history WHERE event_key = ${EVENT_KEY} AND revision = ${revision}
    ` as Array<{ state: StoredPlannerState }>;
    if (!snapshot) return json({ error: "Fant ikke den valgte revisjonen." }, 404);

    const [current] = await sql`
      SELECT state, revision FROM event_states WHERE event_key = ${EVENT_KEY}
    ` as Array<{ state: StoredPlannerState; revision: number }>;
    if (!current) return json({ error: "Fant ikke den aktive planen." }, 404);

    await recordHistoryVersion(sql, current.state, current.revision, "baseline", ["Sikkerhetskopi før gjenoppretting."]);
    const serialized = JSON.stringify(snapshot.state);
    const [restored] = await sql`
      UPDATE event_states
      SET state = ${serialized}::jsonb,
          revision = revision + 1,
          updated_at = NOW(),
          updated_by = 'editor'
      WHERE event_key = ${EVENT_KEY}
      RETURNING revision, updated_at
    ` as Array<{ revision: number; updated_at: string }>;
    await recordHistoryVersion(sql, snapshot.state, restored.revision, "restore", [`Gjenopprettet planen fra revisjon ${revision}.`]);

    return json({ ok: true, revision: restored.revision, updatedAt: restored.updated_at, restoredFrom: revision });
  } catch (error) {
    console.error("History restore failed", error);
    return json({ error: "Kunne ikke gjenopprette revisjonen." }, 500);
  }
}
