/* eslint-disable @next/next/no-html-link-for-pages */
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import AuthControl from "@/components/auth-control";
import EventSettings from "@/components/event-settings";
import { getEventAccess, listEventMembers, listEventShares } from "@/lib/event-access";
import { getEventBySlug } from "@/lib/events";
import { getDatabase } from "@/lib/neon";

export const dynamic = "force-dynamic";

export default async function EventSettingsPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const event = await getEventBySlug((await params).eventSlug);
  if (!event) notFound();
  const access = await getEventAccess(event.eventKey);
  if (!access.canEdit) redirect(`/auth/sign-in?returnTo=${encodeURIComponent(`/events/${event.slug}/settings`)}`);
  const [members, shares] = await Promise.all([listEventMembers(event.eventKey), listEventShares(event.eventKey)]);
  const sql = getDatabase();
  const [stateRow] = await sql`SELECT state FROM event_states WHERE event_key = ${event.eventKey}` as Array<{ state: { photographers?: Array<{ id: string; name: string }> } }>;
  const photographers = stateRow?.state.photographers?.map(({ id, name }) => ({ id, name })) ?? [];
  return <div className="emc-daisy admin-surface"><header className="dashboard-topbar"><a className="dashboard-brand dashboard-brand--event" href="/events"><img src={event.logoUrl} width="126" height="66" alt={event.name} /><span className="dashboard-brand__divider" aria-hidden="true" /><span className="dashboard-product"><b>EMC</b><strong>{event.name}</strong></span></a><div className="admin-top-actions"><a className="btn btn-ghost btn-sm" href="/events"><LayoutGrid size={16} /> Eventer</a><AuthControl /></div></header><main className="admin-shell"><header className="admin-heading"><div><h1>Eventoppsett</h1><p>Administrer program, tilgang og fotografenes private arbeidsplaner.</p></div><a className="btn btn-outline" href={`/events/${event.slug}`}><ArrowLeft size={17} /> Til kontrollrommet</a></header><EventSettings event={event} members={members} shares={shares} photographers={photographers} canManage={access.canManage} /></main></div>;
}
