/* eslint-disable @next/next/no-html-link-for-pages -- Event navigation intentionally reloads event-scoped planning state. */
import { Activity, AlertTriangle, ArrowUpRight, BarChart3, CalendarDays, Camera, CheckCircle2, ChevronRight, Clock3, LayoutDashboard, Menu, Plus, Settings, Users } from "lucide-react";
import AuthControl from "@/components/auth-control";
import EventDirectory from "@/components/event-directory";
import { isEditor } from "@/lib/auth";
import { CHEN_MEDIA_LOGO, PRODUCT_NAME } from "@/lib/brand";
import { getDashboardData } from "@/lib/dashboard";
import { formatEventDate, listEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

function relativeTime(value: string | null) {
  if (!value) return "Ikke lagret ennå";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diff / 60_000));
  if (minutes < 1) return "Akkurat nå";
  if (minutes < 60) return `${minutes} min siden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} t siden`;
  return `${Math.round(hours / 24)} d siden`;
}

export default async function EventsPage() {
  const [baseEvents, canEdit] = await Promise.all([listEvents(), isEditor()]);
  const { events, activity } = await getDashboardData(baseEvents, canEdit);
  const activeEvent = events.find((event) => event.status === "active") ?? events.find((event) => event.status === "planning") ?? events[0];
  const activeEvents = events.filter((event) => event.status === "active").length;
  const totalPosts = events.reduce((total, event) => total + event.program.length, 0);
  const assignmentCount = events.reduce((total, event) => total + event.assignmentCount, 0);
  const openCount = events.reduce((total, event) => total + event.openCount, 0);
  const priorityOpen = events.reduce((total, event) => total + event.priorityOpenCount, 0);
  const partnerOpen = events.reduce((total, event) => total + event.partnerOpenCount, 0);
  const conflicts = events.reduce((total, event) => total + event.conflictCount, 0);
  const totalCoverage = totalPosts ? Math.round((assignmentCount / totalPosts) * 100) : 0;
  const today = new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Oslo" }).format(new Date());

  const nav = <nav className="mission-nav" aria-label="Hovednavigasjon">
    <a className="is-active" href="/events" aria-current="page"><LayoutDashboard size={17} /> Oversikt</a>
    <a href="#eventer"><CalendarDays size={17} /> Produksjoner <span>{events.length}</span></a>
    {activeEvent && <><a href={`/events/${activeEvent.slug}`}><BarChart3 size={17} /> Kontrollrom</a><a href={`/events/${activeEvent.slug}/photographers`}><Camera size={17} /> Fotografplaner</a>{canEdit && <a href={`/events/${activeEvent.slug}/settings`}><Settings size={17} /> Eventoppsett</a>}</>}
  </nav>;

  return <div className="emc-daisy mission-dashboard">
    <a className="skip-link" href="#main-content">Gå til hovedinnhold</a>
    <aside className="mission-sidebar">
      <a className="mission-brand" href="/events"><img src={CHEN_MEDIA_LOGO} width="166" height="57" alt="Chen Media" /><span><b>EMC</b><strong>{PRODUCT_NAME}</strong></span></a>
      <div className="mission-sidebar__label">Arbeidsflate</div>
      {nav}
      {canEdit && <a className="mission-create" href="/events/new"><Plus size={17} /> Opprett event</a>}
      <div className="mission-sidebar__footer"><span><i /> System online</span><small>Neon · Vercel</small></div>
    </aside>

    <div className="mission-mobile-bar"><a className="mission-mobile-brand" href="/events"><img src={CHEN_MEDIA_LOGO} alt="Chen Media" /></a><details><summary aria-label="Åpne meny"><Menu size={20} /></summary><div>{nav}{canEdit && <a className="mission-create" href="/events/new"><Plus size={17} /> Opprett event</a>}</div></details></div>

    <main className="mission-main" id="main-content">
      <header className="mission-topline"><div><span>{today}</span><i aria-hidden="true" /><span>{activeEvents} {activeEvents === 1 ? "aktiv produksjon" : "aktive produksjoner"}</span></div><AuthControl /></header>

      <section className="mission-heading" aria-labelledby="dashboard-title"><div><h1 id="dashboard-title">Produksjonsoversikt</h1><p>Se hva som er klart, hva som mangler dekning og hvor teamet bør handle først.</p></div>{canEdit && <a className="btn btn-primary" href="/events/new"><Plus size={17} /> Nytt event</a>}</section>

      {activeEvent ? <section className="active-mission" aria-labelledby="active-event-title">
        <div className="active-mission__identity"><div className="active-mission__logo"><img src={activeEvent.logoUrl} alt={`${activeEvent.name} logo`} /></div><div><span className={`event-status event-status--${activeEvent.status}`}><i />{activeEvent.status === "active" ? "Aktiv produksjon" : "Neste produksjon"}</span><h2 id="active-event-title">{activeEvent.name}</h2><p><span><CalendarDays size={14} />{formatEventDate(activeEvent)}</span><span>{activeEvent.venue}</span><span>Plan v{activeEvent.revision}</span></p></div></div>
        <div className="active-mission__coverage"><div className="coverage-figure"><strong>{activeEvent.coverage}%</strong><span>total dekning</span></div><div><div className="coverage-track coverage-track--large"><i style={{ width: `${activeEvent.coverage}%` }} /></div><p>{activeEvent.assignmentCount} av {activeEvent.program.length} poster bemannet</p></div></div>
        <div className="active-mission__actions"><a className="btn btn-primary" href={`/events/${activeEvent.slug}`}>Åpne kontrollrom <ArrowUpRight size={16} /></a><a className="mission-text-link" href={`/events/${activeEvent.slug}/photographers`}>Se fotografplaner <ChevronRight size={15} /></a></div>
      </section> : <section className="mission-empty"><CalendarDays size={28} /><h2>Ingen produksjoner ennå</h2><p>Opprett et event og importer programmet for å starte planleggingen.</p>{canEdit && <a className="btn btn-primary" href="/events/new">Opprett første event</a>}</section>}

      <section className="mission-ledger" aria-label="Samlet status">
        <div><span>Samlet dekning</span><strong>{totalCoverage}%</strong><small>{assignmentCount} av {totalPosts} poster</small></div>
        <div><span>Åpne poster</span><strong>{openCount}</strong><small>mangler fotograf</small></div>
        <div className={priorityOpen ? "needs-attention" : ""}><span>Prioritet åpne</span><strong>{priorityOpen}</strong><small>kundeprioriteringer</small></div>
        <div className={conflicts ? "has-conflict" : ""}><span>Konflikter</span><strong>{conflicts}</strong><small>dobbeltbookinger</small></div>
      </section>

      {activeEvent && <section className="mission-intelligence" aria-label="Operativ status">
        <div className="mission-alerts"><header className="mission-section-heading"><div><h2>Handle først</h2><span>{priorityOpen + partnerOpen + conflicts}</span></div><p>De viktigste hullene i den aktive planen.</p></header><div className="alert-list">
          {conflicts > 0 && <a className="alert-item alert-item--danger" href={`/events/${activeEvent.slug}`}><AlertTriangle size={18} /><span><strong>{conflicts} programposter i konflikt</strong><small>Fordel fotograf eller endre øyeblikk.</small></span><ChevronRight size={16} /></a>}
          {activeEvent.priorityOpenCount > 0 && <a className="alert-item" href={`/events/${activeEvent.slug}`}><Activity size={18} /><span><strong>{activeEvent.priorityOpenCount} kundeprioriteringer uten dekning</strong><small>Disse bør bemannes før øvrige poster.</small></span><ChevronRight size={16} /></a>}
          {activeEvent.partnerOpenCount > 0 && <a className="alert-item" href={`/events/${activeEvent.slug}`}><Users size={18} /><span><strong>{activeEvent.partnerOpenCount} Main Partner-poster åpne</strong><small>Kontroller partnerforpliktelsene.</small></span><ChevronRight size={16} /></a>}
          {activeEvent.nextOpen && <a className="alert-item alert-item--quiet" href={`/events/${activeEvent.slug}`}><Clock3 size={18} /><span><strong>Neste åpne post kl. {activeEvent.nextOpen.start}</strong><small>{activeEvent.nextOpen.title} · {activeEvent.nextOpen.stage}</small></span><ChevronRight size={16} /></a>}
          {!conflicts && !activeEvent.priorityOpenCount && !activeEvent.partnerOpenCount && <div className="alert-clear"><CheckCircle2 size={20} /><span><strong>Ingen kritiske hull</strong><small>Prioriteter og partnerposter er dekket.</small></span></div>}
        </div></div>

        <div className="stage-health"><header className="mission-section-heading"><div><h2>Scenedekning</h2><span>{activeEvent.stages.length}</span></div><p>Lavest dekning vises først.</p></header><div className="stage-health__list">{activeEvent.stages.slice(0, 6).map((stage) => <div key={stage.name}><div><span><i style={{ background: stage.color }} />{stage.name}</span><strong>{stage.coverage}%</strong></div><div className="coverage-track"><i style={{ width: `${stage.coverage}%`, background: stage.color }} /></div><small>{stage.assigned} av {stage.total} bemannet</small></div>)}</div><a className="mission-text-link" href={`/events/${activeEvent.slug}`}>Åpne full sceneoversikt <ChevronRight size={15} /></a></div>
      </section>}

      {canEdit && activity.length > 0 && <section className="mission-activity" aria-labelledby="activity-title"><header className="mission-section-heading"><div><h2 id="activity-title">Siste endringer</h2><span>{activity.length}</span></div><p>Nyeste lagringer på tvers av produksjoner.</p></header><div>{activity.map((entry) => <a href={`/events/${entry.eventSlug}/history`} key={`${entry.eventSlug}-${entry.revision}`}><span className="activity-revision">v{entry.revision}</span><span><strong>{entry.changes[0] || "Planen ble oppdatert"}</strong><small>{entry.eventName} · {entry.changedBy}</small></span><time dateTime={entry.changedAt}>{relativeTime(entry.changedAt)}</time><ChevronRight size={15} /></a>)}</div></section>}

      <EventDirectory events={events} canEdit={canEdit} />
    </main>
  </div>;
}
