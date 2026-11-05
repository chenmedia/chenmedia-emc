/* eslint-disable @next/next/no-html-link-for-pages -- Opening an event reloads its event-scoped planning runtime. */
import { ArrowUpRight, CalendarDays, Camera, Clock3, MapPin, Plus, Users } from "lucide-react";
import AuthControl from "@/components/auth-control";
import { isEditor } from "@/lib/auth";
import { CHEN_MEDIA_LOGO, PRODUCT_NAME, PRODUCT_SHORT_NAME } from "@/lib/brand";
import { formatEventDate, listEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

const statusLabel = { draft: "Kladd", planning: "Planlegging", active: "Aktivt", archived: "Arkivert" };

export default async function EventsPage() {
  const [events, canEdit] = await Promise.all([listEvents(), isEditor()]);
  const activeEvents = events.filter((event) => event.status === "active").length;
  const assignmentCount = events.reduce((total, event) => total + event.assignmentCount, 0);
  const openCount = events.reduce((total, event) => total + Math.max(0, event.program.length - event.assignmentCount), 0);
  const photographerCount = events.reduce((total, event) => total + event.photographerCount, 0);

  return <div className="emc-daisy events-hub">
    <header className="dashboard-topbar">
      <a className="dashboard-brand" href="/events" aria-label={`${PRODUCT_NAME} – eventoversikt`}>
        <img src={CHEN_MEDIA_LOGO} width="166" height="57" alt="Chen Media" />
        <span className="dashboard-brand__divider" aria-hidden="true" />
        <span className="dashboard-product"><b>{PRODUCT_SHORT_NAME}</b><strong>{PRODUCT_NAME}</strong></span>
      </a>
      <AuthControl />
    </header>

    <main className="events-shell">
      <section className="events-masthead" aria-labelledby="events-title">
        <div><h1 id="events-title">Event Mission Control</h1><p>Planlegg fotodekning, team og kjøreplaner på tvers av alle eventproduksjonene dine.</p></div>
        {canEdit && <button className="btn btn-primary" type="button" disabled title="Opprettelse av event kommer i neste fase"><Plus size={17} aria-hidden="true" /> Nytt event</button>}
      </section>

      <section className="dashboard-summary" aria-label="Samlet status">
        <div><span>Aktive eventer</span><strong>{activeEvents}</strong><small>av {events.length} totalt</small></div>
        <div><span>Bemannede poster</span><strong>{assignmentCount}</strong><small>på tvers av eventer</small></div>
        <div className={openCount ? "has-attention" : ""}><span>Åpne poster</span><strong>{openCount}</strong><small>mangler fotograf</small></div>
        <div><span>Fotografer</span><strong>{photographerCount}</strong><small>i aktive planer</small></div>
      </section>

      <section className="events-section" aria-labelledby="event-list-title">
        <header className="events-section__heading"><div><h2 id="event-list-title">Eventer</h2><span>{events.length} {events.length === 1 ? "event" : "eventer"}</span></div><p>Åpne en produksjon for å bemanne programmet og følge dekningen.</p></header>
        <div className="event-list">{events.map((event) => {
          const coverage = event.program.length ? Math.round((event.assignmentCount / event.program.length) * 100) : 0;
          const missing = Math.max(0, event.program.length - event.assignmentCount);
          return <a className="event-row" href={`/events/${event.slug}`} key={event.eventKey}>
            <div className="event-row__identity"><div className="event-row__logo"><img src={event.logoUrl} alt="" /></div><div><span className={`event-status event-status--${event.status}`}><i />{statusLabel[event.status]}</span><h3>{event.name}</h3><div className="event-row__meta"><span><CalendarDays size={14} aria-hidden="true" />{formatEventDate(event)}</span><span><MapPin size={14} aria-hidden="true" />{event.venue}</span></div></div></div>
            <div className="event-row__coverage"><div><span>Dekning</span><strong>{coverage}%</strong></div><div className="coverage-track" aria-label={`${coverage} prosent dekket`}><i style={{ width: `${coverage}%` }} /></div><small>{event.assignmentCount} bemannet · {missing} åpne</small></div>
            <div className="event-row__stats"><span><Camera size={15} aria-hidden="true" /><b>{event.program.length}</b> poster</span><span><Users size={15} aria-hidden="true" /><b>{event.photographerCount}</b> fotografer</span><span><Clock3 size={15} aria-hidden="true" />Plan v{event.revision}</span></div>
            <span className="event-row__open">Åpne kontrollrom <ArrowUpRight size={17} aria-hidden="true" /></span>
          </a>;
        })}</div>
        {!events.length && <div className="events-empty"><Users size={28} aria-hidden="true" /><strong>Ingen eventer ennå</strong><span>Det første eventet vises her når det er opprettet.</span></div>}
      </section>
    </main>
  </div>;
}
