import { CalendarDays, Camera, ChevronRight, MapPin, Plus, Users } from "lucide-react";
import AuthControl from "@/components/auth-control";
import { isEditor } from "@/lib/auth";
import { formatEventDate, listEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

const statusLabel = { draft: "Kladd", planning: "Planlegging", active: "Aktivt", archived: "Arkivert" };

export default async function EventsPage() {
  const [events, canEdit] = await Promise.all([listEvents(), isEditor()]);
  return <div className="emc-daisy events-hub">
    <header className="topbar navbar"><div className="topbar__brand"><img src="/ops-logo.png" width="126" height="66" alt="Eventphoto Mission Control" /><div className="brand-divider" aria-hidden="true" /><div><span className="product-kicker">EMC</span><strong>Eventphoto Mission Control</strong></div></div><div className="topbar__meta"><AuthControl /></div></header>
    <main className="events-shell">
      <section className="events-heading"><div><p className="eyebrow">EVENTOVERSIKT</p><h1>Alle fotoplaner på ett sted.</h1><p>Velg et event for å åpne bemanningsplanen, fotografoversiktene og endringshistorikken.</p></div>{canEdit && <button className="btn btn-primary" type="button" disabled title="Opprettelse av event kommer i fase 3"><Plus size={17} aria-hidden="true" /> Opprett event</button>}</section>
      <section className="event-grid" aria-label="Eventer">{events.map((event) => {
        const coverage = event.program.length ? Math.round((event.assignmentCount / event.program.length) * 100) : 0;
        return <a className="event-card" href={`/events/${event.slug}`} key={event.eventKey}>
          <div className="event-card__top"><span className={`event-status event-status--${event.status}`}><i />{statusLabel[event.status]}</span><ChevronRight size={20} aria-hidden="true" /></div>
          <div className="event-card__brand"><img src={event.logoUrl} alt="" /><div><h2>{event.name}</h2><span><CalendarDays size={14} aria-hidden="true" />{formatEventDate(event)}</span><span><MapPin size={14} aria-hidden="true" />{event.venue}</span></div></div>
          <div className="event-card__metrics"><span><strong>{coverage}%</strong>Dekning</span><span><strong>{event.assignmentCount}</strong>Bemannet</span><span><strong>{event.photographerCount}</strong>Fotografer</span><span><strong>{event.program.length}</strong>Aktiviteter</span></div>
          <div className="event-card__footer"><span><Camera size={15} aria-hidden="true" /> Åpne fotoplan</span>{event.updatedAt && <small>Plan v{event.revision}</small>}</div>
        </a>;
      })}</section>
      {!events.length && <div className="events-empty"><Users size={28} aria-hidden="true" /><strong>Ingen eventer ennå</strong><span>Det første eventet vises her når det er opprettet.</span></div>}
    </main>
  </div>;
}
