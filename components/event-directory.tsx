"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, Camera, MapPin, Search, Settings, Users } from "lucide-react";
import type { DashboardEvent } from "@/lib/dashboard";

type Props = { events: DashboardEvent[]; canEdit: boolean };
type StatusFilter = "all" | DashboardEvent["status"];
const labels: Record<StatusFilter, string> = { all: "Alle", active: "Aktive", planning: "Planlegging", draft: "Kladd", archived: "Arkiv" };
const statusLabel = { draft: "Kladd", planning: "Planlegging", active: "Aktivt", archived: "Arkivert" };

function formatEventDate(event: Pick<DashboardEvent, "startsOn" | "endsOn" | "timezone">) {
  const formatter = new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: event.timezone,
  });
  const start = formatter.format(new Date(`${event.startsOn}T12:00:00Z`));
  if (event.startsOn === event.endsOn) return start;
  return `${start}–${formatter.format(new Date(`${event.endsOn}T12:00:00Z`))}`;
}

export default function EventDirectory({ events, canEdit }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const visible = useMemo(() => events.filter((event) => {
    const matchesStatus = status === "all" || event.status === status;
    const haystack = `${event.name} ${event.venue}`.toLowerCase();
    return matchesStatus && haystack.includes(query.trim().toLowerCase());
  }), [events, query, status]);

  return <section className="mission-directory" id="eventer" aria-labelledby="event-list-title">
    <header className="mission-section-heading"><div><h2 id="event-list-title">Produksjoner</h2><span>{visible.length} av {events.length}</span></div><p>Filtrer, åpne og administrer eventene fra samme arbeidsflate.</p></header>
    <div className="directory-tools"><label><Search size={16} aria-hidden="true" /><span className="sr-only">Søk i eventer</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søk etter event eller sted" /></label><div role="group" aria-label="Filtrer etter status">{(Object.keys(labels) as StatusFilter[]).map((value) => <button key={value} type="button" className={status === value ? "is-active" : ""} aria-pressed={status === value} onClick={() => setStatus(value)}>{labels[value]}</button>)}</div></div>
    <div className="directory-table" role="list">{visible.map((event) => <article className="directory-row" key={event.eventKey} role="listitem">
      <div className="directory-identity"><div className="directory-logo"><img src={event.logoUrl} alt={`${event.name} logo`} /></div><div><span className={`event-status event-status--${event.status}`}><i />{statusLabel[event.status]}</span><h3><a href={`/events/${event.slug}`}>{event.name}</a></h3><p><span><CalendarDays size={14} />{formatEventDate(event)}</span><span><MapPin size={14} />{event.venue || "Sted ikke satt"}</span></p></div></div>
      <div className="directory-coverage"><div><span>Dekning</span><strong>{event.coverage}%</strong></div><div className="coverage-track"><i style={{ width: `${event.coverage}%` }} /></div><small>{event.assignmentCount} bemannet · {event.openCount} åpne</small></div>
      <dl className="directory-facts"><div><dt><Camera size={14} /> Program</dt><dd>{event.program.length}</dd></div><div><dt><Users size={14} /> Team</dt><dd>{event.photographerCount}</dd></div><div className={event.priorityOpenCount ? "needs-attention" : ""}><dt>Prioritet åpne</dt><dd>{event.priorityOpenCount}</dd></div></dl>
      <div className="directory-actions"><a href={`/events/${event.slug}`} className="btn btn-primary btn-sm">Åpne <ArrowUpRight size={15} /></a><a href={`/events/${event.slug}/photographers`} className="btn btn-ghost btn-sm">Fotografer</a>{canEdit && <a href={`/events/${event.slug}/settings`} className="ui-icon-button" aria-label={`Innstillinger for ${event.name}`}><Settings size={16} /></a>}</div>
    </article>)}</div>
    {!visible.length && <div className="directory-empty"><Search size={24} /><strong>Ingen eventer passer filteret</strong><span>Prøv en annen status eller fjern søket.</span></div>}
  </section>;
}
