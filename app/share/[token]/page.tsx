import { notFound } from "next/navigation";
import SharedPhotographerPlan from "@/components/shared-photographer-plan";
import { ensureEventAccessSchema } from "@/lib/event-access";
import { getEventByKey } from "@/lib/events";
import { getDatabase } from "@/lib/neon";

export const dynamic = "force-dynamic";

type ShareRow = { event_key: string; photographer_id: string; last_viewed_revision: number };
type PlannerState = {
  photographers: Array<{ id: string; name: string; phone: string; role: string; from: string; to: string; color: string }>;
  assignments: Record<string, { photographerId: string; timing: "start" | "end" | "whole" }>;
  taskProgress?: Record<string, { status: "done" | "handoff"; reason?: string; requestedBy?: string; requestedTo?: string; requestedAt?: string }>;
};

export default async function SharedPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await ensureEventAccessSchema();
  const sql = getDatabase();
  const [share] = await sql`SELECT event_key, photographer_id, last_viewed_revision FROM event_shares WHERE token = ${token} AND enabled = TRUE LIMIT 1` as ShareRow[];
  if (!share) notFound();
  const event = await getEventByKey(share.event_key);
  const stateRow = await sql`SELECT state, revision FROM event_states WHERE event_key = ${share.event_key}` as Array<{ state: PlannerState; revision: number }>;
  if (!event || !stateRow[0]) notFound();
  const photographer = stateRow[0].state.photographers.find((person) => person.id === share.photographer_id);
  if (!photographer) notFound();
  const history = await sql`
    SELECT changes FROM event_state_history
    WHERE event_key = ${share.event_key} AND revision > ${share.last_viewed_revision}
    ORDER BY revision DESC LIMIT 8
  ` as Array<{ changes: string[] }>;
  const changes = history.flatMap((entry) => Array.isArray(entry.changes) ? entry.changes : []).filter((change) => change && !change.toLowerCase().includes("startpunkt"));
  await sql`UPDATE event_shares SET last_viewed_revision = ${stateRow[0].revision} WHERE token = ${token}`;
  const photographers = stateRow[0].state.photographers.map((person) => ({ id: person.id, name: person.name, role: person.role, from: person.from, to: person.to, color: person.color }));
  return <div className="emc-daisy shared-plan-page"><SharedPhotographerPlan event={event} photographer={photographer} photographers={photographers} assignments={stateRow[0].state.assignments} taskProgress={stateRow[0].state.taskProgress || {}} shareToken={token} revision={stateRow[0].revision} changes={[...new Set(changes)]} lastViewedRevision={share.last_viewed_revision} /></div>;
}
