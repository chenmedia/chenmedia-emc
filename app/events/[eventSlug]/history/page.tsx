/* eslint-disable @next/next/no-html-link-for-pages -- Full reload keeps the event workspace synchronized after a restore. */
import { ArrowLeft, CalendarDays, History, LayoutGrid, MapPin } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import AuthControl from "@/components/auth-control";
import { getEventAccess } from "@/lib/event-access";
import { formatEventDate, getEventBySlug } from "@/lib/events";
import HistoryPanel from "@/app/history/history-panel";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;
  const event = await getEventBySlug(eventSlug);
  if (!event) notFound();
  const { canEdit } = await getEventAccess(event.eventKey);
  if (!canEdit) redirect(`/auth/sign-in?returnTo=${encodeURIComponent(`/events/${eventSlug}/history`)}`);
  const base = `/events/${event.slug}`;
  return <><header className="topbar"><a className="topbar__brand topbar__brand-link" href="/events"><img src={event.logoUrl} width="126" height="66" alt={event.name} /><span className="brand-divider" aria-hidden="true" /><span><span className="product-kicker">EMC</span><strong>Event Mission Control</strong></span></a><div className="topbar__meta"><a className="event-switcher" href="/events"><LayoutGrid size={15} aria-hidden="true" /><span><small>AKTIVT EVENT</small>{event.name}</span></a><span><CalendarDays size={15} aria-hidden="true" /> {formatEventDate(event)}</span><span><MapPin size={15} aria-hidden="true" /> {event.venue}</span><AuthControl /></div></header>
    <main className="app-shell history-page"><section className="page-heading history-page__heading" aria-labelledby="history-title"><div><p className="eyebrow">{event.name.toUpperCase()}</p><h1 id="history-title">Endringshistorikk</h1><p className="lede">Se hvem som endret planen, hva som ble endret og gjenopprett en tidligere versjon uten å miste nyere historikk.</p></div><div className="page-heading__actions"><a href={base} className="ui-button ui-button--outline"><ArrowLeft size={16} aria-hidden="true" /> Til bemanningsplan</a></div></section><section aria-labelledby="history-list-title"><div className="history-section-heading"><History size={19} aria-hidden="true" /><div><h2 id="history-list-title">Revisjoner</h2><p>Nyeste versjon vises først.</p></div></div><HistoryPanel endpoint={`/api/events/${event.slug}/history`} /></section></main>
  </>;
}
