/* eslint-disable @next/next/no-html-link-for-pages -- Full reload reinitializes the shared planning runtime between event workspaces. */
import { ArrowLeft, CalendarDays, History, LayoutGrid, MapPin, Users } from "lucide-react";
import { notFound } from "next/navigation";
import AuthControl from "@/components/auth-control";
import { isEditor } from "@/lib/auth";
import { formatEventDate, getEventBySlug } from "@/lib/events";
import FrameOpsBootstrap from "@/app/frameops-bootstrap";

export const dynamic = "force-dynamic";

export default async function PhotographerPlansPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;
  const [event, canEdit] = await Promise.all([getEventBySlug(eventSlug), isEditor()]);
  if (!event) notFound();
  const base = `/events/${event.slug}`;
  const eventContext = { slug: event.slug, name: event.name, venue: event.venue, dateLabel: formatEventDate(event), timezone: event.timezone, stateEndpoint: `/api/events/${event.slug}/state`, historyEndpoint: `/api/events/${event.slug}/history` };
  return <>
    <header className="topbar"><a className="topbar__brand topbar__brand-link" href="/events"><img src={event.logoUrl} width="126" height="66" alt={event.name} /><span className="brand-divider" aria-hidden="true" /><span><span className="product-kicker">EMC</span><strong>Event Mission Control</strong></span></a><div className="topbar__meta"><a className="event-switcher" href="/events"><LayoutGrid size={15} aria-hidden="true" /><span><small>AKTIVT EVENT</small>{event.name}</span></a><span><CalendarDays size={15} aria-hidden="true" /> {formatEventDate(event)}</span><span><MapPin size={15} aria-hidden="true" /> {event.venue}</span><span id="sync-status" className="sync-badge sync-badge--loading" role="status" aria-live="polite"><i /> Kobler til…</span><AuthControl /></div></header>
    <main className="app-shell photographer-plans-page"><section className="page-heading photographer-plans-page__heading" aria-labelledby="photographer-overview-title"><div><p className="eyebrow">{event.name.toUpperCase()}</p><h1 id="photographer-overview-title">Fotografplaner</h1><p className="lede">Velg fotograf for å se hele arbeidsdagen, tidslinjen og kundeprioriteringene uten støy fra hovedprogrammet.</p></div><div className="page-heading__actions">{canEdit && <a href={`${base}/history`} className="ui-button ui-button--outline"><History size={16} aria-hidden="true" /> Endringshistorikk</a>}<a href={base} className="ui-button ui-button--outline"><ArrowLeft size={16} aria-hidden="true" /> Til bemanningsplan</a></div></section>
      <section className="photographer-overview photographer-overview--standalone" id="photographer-overview" aria-labelledby="photographer-overview-title"><div className="photographer-overview__legend" aria-label="Forklaring"><span><i className="partner-dot" /> Main Partner</span><span><i className="priority-dot" /> Kundeprioritet</span><span><i className="status-dot status-dot--conflict" /> Konflikt</span></div><div id="photographer-overview-list" className="photographer-overview__list" /><div id="photographer-overview-empty" className="photographer-overview__empty"><Users size={28} aria-hidden="true" /><strong>Ingen fotografer i planen ennå</strong><span>Legg til fotografer i bemanningsplanen for å se individuelle kjøreplaner.</span></div></section>
    </main><div id="toast-region" className="toast-region" aria-live="polite" /><script id="event-context" type="application/json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventContext).replaceAll("<", "\\u003c") }} /><script id="program-data" type="application/json" dangerouslySetInnerHTML={{ __html: JSON.stringify(event.program).replaceAll("<", "\\u003c") }} /><FrameOpsBootstrap />
  </>;
}
