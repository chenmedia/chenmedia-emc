import "server-only";

import { randomBytes } from "node:crypto";
import { getAuthUser, hasEditorAccess, type EmcUser } from "@/lib/auth";
import { ensureEventsSchema } from "@/lib/events";
import { getDatabase } from "@/lib/neon";

export type EventRole = "owner" | "editor" | "viewer";

export type EventMember = {
  email: string;
  role: EventRole;
  addedAt: string;
  addedBy: string;
};

export type EventShare = {
  token: string;
  photographerId: string;
  photographerName: string;
  enabled: boolean;
  lastViewedRevision: number;
  createdAt: string;
};

export async function ensureEventAccessSchema() {
  await ensureEventsSchema();
  const sql = getDatabase();
  await sql`
    CREATE TABLE IF NOT EXISTS event_members (
      event_key TEXT NOT NULL REFERENCES events(event_key) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
      added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      added_by TEXT NOT NULL DEFAULT 'system',
      PRIMARY KEY (event_key, email)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS event_members_email_idx ON event_members (LOWER(email))`;
  await sql`
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
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS event_shares_event_idx ON event_shares (event_key, enabled)`;
}

export async function eventRoleForUser(eventKey: string, user: EmcUser | null) {
  if (!user) return null;
  if (hasEditorAccess(user)) return "owner" as const;
  await ensureEventAccessSchema();
  const sql = getDatabase();
  const [row] = await sql`
    SELECT role FROM event_members
    WHERE event_key = ${eventKey} AND LOWER(email) = ${user.email.toLowerCase()}
    LIMIT 1
  ` as Array<{ role: EventRole }>;
  return row?.role ?? null;
}

export async function getEventAccess(eventKey: string) {
  const user = await getAuthUser();
  const role = await eventRoleForUser(eventKey, user);
  return { user, role, canEdit: role === "owner" || role === "editor", canManage: role === "owner" };
}

export async function getEventEditor(eventKey: string) {
  const access = await getEventAccess(eventKey);
  return access.canEdit && access.user ? access.user : null;
}

export async function listEventMembers(eventKey: string) {
  await ensureEventAccessSchema();
  const sql = getDatabase();
  const rows = await sql`
    SELECT email, role, added_at, added_by FROM event_members
    WHERE event_key = ${eventKey}
    ORDER BY CASE role WHEN 'owner' THEN 1 WHEN 'editor' THEN 2 ELSE 3 END, email
  ` as Array<{ email: string; role: EventRole; added_at: string; added_by: string }>;
  return rows.map((row) => ({ email: row.email, role: row.role, addedAt: row.added_at, addedBy: row.added_by }));
}

export async function listEventShares(eventKey: string) {
  await ensureEventAccessSchema();
  const sql = getDatabase();
  const rows = await sql`
    SELECT token, photographer_id, photographer_name, enabled, last_viewed_revision, created_at
    FROM event_shares WHERE event_key = ${eventKey} ORDER BY photographer_name
  ` as Array<{ token: string; photographer_id: string; photographer_name: string; enabled: boolean; last_viewed_revision: number; created_at: string }>;
  return rows.map((row) => ({
    token: row.token,
    photographerId: row.photographer_id,
    photographerName: row.photographer_name,
    enabled: row.enabled,
    lastViewedRevision: row.last_viewed_revision,
    createdAt: row.created_at,
  }));
}

export function createShareToken() {
  return randomBytes(24).toString("base64url");
}
