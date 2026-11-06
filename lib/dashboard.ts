import "server-only";

import type { EmcEvent, EventProgramItem } from "@/lib/events";
import { getDatabase } from "@/lib/neon";

type CaptureTiming = "start" | "end" | "whole";
type Assignment = { photographerId: string; timing: CaptureTiming };
type Photographer = { id: string; name: string; color: string };
type PlannerState = { photographers: Photographer[]; assignments: Record<string, Assignment> };

type StateRow = {
  event_key: string;
  state: PlannerState;
  revision: number;
  updated_at: string;
};

export type DashboardEvent = EmcEvent & {
  coverage: number;
  openCount: number;
  priorityCount: number;
  priorityOpenCount: number;
  partnerCount: number;
  partnerOpenCount: number;
  conflictCount: number;
  nextOpen: { title: string; start: string; stage: string } | null;
  stages: Array<{ name: string; total: number; assigned: number; coverage: number; color: string }>;
};

export type DashboardActivity = {
  eventName: string;
  eventSlug: string;
  revision: number;
  changes: string[];
  changedAt: string;
  changedBy: string;
};

function minutes(value: string, end = false) {
  const [hours, mins] = value.split(":").map(Number);
  const total = hours * 60 + mins;
  return end && total < 5 * 60 ? total + 24 * 60 : total;
}

function captureWindow(session: EventProgramItem, timing: CaptureTiming) {
  const start = minutes(session.start);
  let end = minutes(session.end, true);
  if (end <= start) end += 24 * 60;
  if (timing === "whole") return { start, end };
  const duration = Math.min(15, end - start);
  return timing === "start" ? { start, end: start + duration } : { start: end - duration, end };
}

function conflictCount(program: EventProgramItem[], assignments: Record<string, Assignment>) {
  const sessions = new Map(program.map((item) => [item.id, item]));
  const byPhotographer = new Map<string, Array<{ session: EventProgramItem; assignment: Assignment }>>();
  Object.entries(assignments).forEach(([sessionId, assignment]) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    const list = byPhotographer.get(assignment.photographerId) ?? [];
    list.push({ session, assignment });
    byPhotographer.set(assignment.photographerId, list);
  });
  const conflicts = new Set<string>();
  byPhotographer.forEach((items) => {
    for (let first = 0; first < items.length; first += 1) for (let second = first + 1; second < items.length; second += 1) {
      const a = captureWindow(items[first].session, items[first].assignment.timing);
      const b = captureWindow(items[second].session, items[second].assignment.timing);
      if (a.start < b.end && a.end > b.start) {
        conflicts.add(items[first].session.id);
        conflicts.add(items[second].session.id);
      }
    }
  });
  return conflicts.size;
}

export async function getDashboardData(events: EmcEvent[], includeActivity: boolean) {
  const sql = getDatabase();
  const stateRows = events.length ? await sql`
      SELECT event_key, state, revision, updated_at
      FROM event_states
      WHERE event_key = ANY(${events.map((event) => event.eventKey)}::text[])
    ` as StateRow[] : [];
  const states = new Map(stateRows.map((row) => [row.event_key, row]));

  const dashboardEvents: DashboardEvent[] = events.map((event) => {
    const state = states.get(event.eventKey)?.state ?? { photographers: [], assignments: {} };
    const assignedIds = new Set(Object.keys(state.assignments));
    const open = event.program.filter((item) => !assignedIds.has(item.id));
    const priorities = event.program.filter((item) => Boolean(item.customerPriority));
    const partners = event.program.filter((item) => item.mainPartners.length > 0);
    const stageNames = [...new Set(event.program.map((item) => item.stage))];
    return {
      ...event,
      coverage: event.program.length ? Math.round((assignedIds.size / event.program.length) * 100) : 0,
      openCount: open.length,
      priorityCount: priorities.length,
      priorityOpenCount: priorities.filter((item) => !assignedIds.has(item.id)).length,
      partnerCount: partners.length,
      partnerOpenCount: partners.filter((item) => !assignedIds.has(item.id)).length,
      conflictCount: conflictCount(event.program, state.assignments),
      nextOpen: open.sort((a, b) => a.start.localeCompare(b.start))[0] ?? null,
      stages: stageNames.map((name) => {
        const items = event.program.filter((item) => item.stage === name);
        const assigned = items.filter((item) => assignedIds.has(item.id)).length;
        return { name, total: items.length, assigned, coverage: items.length ? Math.round((assigned / items.length) * 100) : 0, color: event.stageColors[name] || "#899496" };
      }).sort((a, b) => a.coverage - b.coverage || b.total - a.total),
    };
  });

  let activity: DashboardActivity[] = [];
  if (includeActivity) {
    const rows = await sql`
      SELECT h.event_key, h.revision, h.changes, h.changed_at, h.changed_by, e.name, e.slug
      FROM event_state_history h
      JOIN events e ON e.event_key = h.event_key
      WHERE h.action IN ('save', 'restore')
      ORDER BY h.changed_at DESC
      LIMIT 6
    ` as Array<{ event_key: string; revision: number; changes: string[]; changed_at: string; changed_by: string; name: string; slug: string }>;
    activity = rows.map((row) => ({
      eventName: row.name,
      eventSlug: row.slug,
      revision: row.revision,
      changes: Array.isArray(row.changes) ? row.changes : [],
      changedAt: row.changed_at,
      changedBy: row.changed_by,
    }));
  }

  return { events: dashboardEvents, activity };
}
