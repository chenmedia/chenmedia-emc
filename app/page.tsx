import { CalendarDays, Download, Info, MapPin, Plus, Search, UserPlus, Users, WandSparkles, X } from "lucide-react";
import program from "../src/data/program.json";
import FrameOpsBootstrap from "./frameops-bootstrap";
import AuthControl from "@/components/auth-control";

const stages = ["Alle", "Glasshallen", "Praktisk Proptech", "Energy First Real Estate", "Future of Work & Life", "Behind The Build", "The Deal Room", "Founders' Lounge", "The Board Room", "Side Events", "All stages", "Scene ikke oppgitt"];

const stageColors: Record<string, string> = {
  Glasshallen: "#37c9d4", "Praktisk Proptech": "#a9cc5d", "Energy First Real Estate": "#e8a342",
  "Future of Work & Life": "#7fa992", "Behind The Build": "#8c7898", "The Deal Room": "#c96e55",
  "Founders' Lounge": "#c7aa69", "The Board Room": "#0d7774", "Side Events": "#78a934",
  "All stages": "#657173", "Scene ikke oppgitt": "#899496",
};

const partnerSessions: Record<string, string[]> = {
  "proptech-for-breakfast-1": ["Proptech Norway"], "summit-afterwork-at-vicini": ["Proptech Norway"],
  "real-estate-innovation-project-of-the-year-part-i": ["Construction City"],
  "dont-just-host-it-build-it": ["Siemens", "Noova Energy Systems"], "roundtable-spir-group": ["Spir"],
  "fra-etterslep-til-innsikt": ["Spir"], "if-forsikring-roundtable": ["IF"],
  "resilience-is-maintained-or-lost": ["IF", "OBOS"], "built-for-the-bad-days": ["IF"],
};

const mainPartnersFor = (session: (typeof program)[number]) => {
  const partners = [...(partnerSessions[session.id] ?? [])];
  if (session.stage === "Future of Work & Life") partners.push("OBOS");
  if (session.stage === "Praktisk Proptech") partners.push("Noova Energy Systems");
  return [...new Set(partners)];
};

const customerPriorities: Record<string, string> = {
  "registration-and-breakfast-mingle-2": "Når det passer", "proptech-for-breakfast-1": "Når det passer",
  "gehl-and-the-human-data-layer": "Mellom 10:45 og 10:55", "the-urban-operating-system-ai-data-and-the-new-chinese-city": "Når det passer",
  "digital-sovereignty-lessons-from-the-battlefield-1": "Når det passer", "stop-asking-for-more-power": "11:15 og 11:30, eller 11:50",
  "resilience-is-maintained-or-lost": "11:40 og 11:55", "kontoret-etter-ki": "Ca. 12:00",
  "your-ai-strategy-is-already-obsolete": "Når det passer", "follow-the-green-umbrella-norsk": "Når det passer",
  "redi-before-ai-fix-the-basics": "Ca. 12:45", "dont-just-host-it-build-it": "12:10 og 12:33",
  "real-estate-innovation-project-of-the-year-part-i": "Når det passer", "lunch-mingle-3": "Når det passer",
  "built-for-the-bad-days": "Mellom 14:45 og 14:50", "bolig-norges-helsesjekk": "Ca. 14:30",
  "ett-år-120-millioner": "Når det passer", "fra-etterslep-til-innsikt": "Ca. 15:15",
  "where-is-the-second-mover": "15:30 og 16:00", "reality-check": "Mellom 15:45 og 15:55",
  "summit-afterwork-at-vicini": "Litt i begynnelsen",
};

const plannerProgram = program.map((session) => ({ ...session, mainPartners: mainPartnersFor(session), customerPriority: customerPriorities[session.id] ?? "" }));
const stageCounts = Object.fromEntries(stages.map((stage) => [stage, stage === "Alle" ? program.length : program.filter((item) => item.stage === stage).length]));

export default function Home() {
  return <>
    <a className="skip-link" href="#schedule">Gå til bemanningsplan</a>
    <header className="topbar">
      <div className="topbar__brand"><img src="/ops-logo.png" width="126" height="66" alt="Oslo Proptech Summit" /><div className="brand-divider" aria-hidden="true" /><div><span className="product-kicker">EMC</span><strong>Eventphoto Mission Control</strong></div></div>
      <div className="topbar__meta"><span><CalendarDays size={15} aria-hidden="true" /> 21. oktober 2026</span><span><MapPin size={15} aria-hidden="true" /> Construction City</span><span id="sync-status" className="sync-badge sync-badge--loading" role="status" aria-live="polite"><i /> Kobler til…</span><AuthControl /></div>
    </header>

    <main className="app-shell">
      <section className="page-heading" aria-labelledby="page-title"><div><p className="eyebrow">MISSION CONTROL · OSLO PROPTECH SUMMIT</p><h1 id="page-title">Kontroll på hvert øyeblikk.</h1><p className="lede">Operativ bemanningsplan for fototeamet under Oslo Proptech Summit 2026. Delte besøkende har kun visning; eieren kan redigere den synkroniserte planen.</p></div><div className="page-heading__actions"><a href="#photographer-overview" className="ui-button ui-button--secondary"><Users size={16} aria-hidden="true" /> Fotografoversikt</a><button id="export-master-pdf" className="ui-button ui-button--outline" type="button"><Download size={16} aria-hidden="true" /> Master-PDF</button><button id="export-button" className="ui-button ui-button--outline" type="button"><Download size={16} aria-hidden="true" /> Eksporter CSV</button><button className="ui-button ui-button--primary" type="button" data-ui-dialog-trigger="photographer-dialog"><UserPlus size={16} aria-hidden="true" /> Legg til fotograf</button></div></section>

      <section className="metric-strip" aria-label="Statusoversikt">
        <div className="metric metric--primary"><span className="metric__label">Dekning</span><strong id="coverage-percent">0%</strong><span id="coverage-caption">0 av {program.length} aktiviteter</span></div>
        <div className="metric"><span className="metric__label">Bemannet</span><strong id="assigned-count">0</strong><span>aktiviteter</span></div>
        <div className="metric"><span className="metric__label">Mangler fotograf</span><strong id="unassigned-count">{program.length}</strong><span>må fordeles</span></div>
        <div className="metric metric--alert"><span className="metric__label">Konflikter</span><strong id="conflict-count">0</strong><span>dobbeltbookinger</span></div>
      </section>
      <section id="conflict-summary" className="conflict-summary" aria-live="polite" hidden><div className="conflict-summary__icon" aria-hidden="true">!</div><div><strong>Dobbeltbookede fotografer</strong><div id="conflict-summary-list" className="conflict-summary__list" /></div></section>

      <div className="workspace">
        <section className="filter-panel ui-card" aria-label="Programfiltre">
          <div className="panel-heading"><div><p className="panel-kicker">FILTRER</p><h2>Program</h2></div><span id="visible-count" className="count-label">{program.length}</span></div>
          <div className="filter-group"><label htmlFor="program-search">Søk i programmet</label><div className="search-wrap"><Search size={16} aria-hidden="true" /><input id="program-search" type="search" placeholder="Tittel eller scene" autoComplete="off" /></div></div>
          <fieldset className="filter-group"><legend>Scene</legend><div className="stage-filter" id="stage-filter">{stages.map((stage) => <button key={stage} type="button" className={`stage-filter__item${stage === "Alle" ? " is-active" : ""}`} data-stage={stage} aria-pressed={stage === "Alle"}><span className="stage-dot" style={{ "--stage-color": stage === "Alle" ? "#004746" : stageColors[stage] } as React.CSSProperties} /><span>{stage}</span><span className="stage-filter__count">{stageCounts[stage]}</span></button>)}</div></fieldset>
          <fieldset className="filter-group"><legend>Programtype</legend><div className="coverage-filter programtype-filter" id="programtype-filter"><button type="button" className="is-active" data-program-filter="all" aria-pressed="true">Alle</button><button type="button" data-program-filter="main" aria-pressed="false">Main Partner</button><button type="button" data-program-filter="priority" aria-pressed="false">Kundeprioritet</button></div></fieldset>
          <fieldset className="filter-group"><legend>Dekning</legend><div className="coverage-filter" id="coverage-filter"><button type="button" className="is-active" data-coverage="all" aria-pressed="true">Alle</button><button type="button" data-coverage="unassigned" aria-pressed="false">Ufordelt</button><button type="button" data-coverage="conflict" aria-pressed="false">Konflikt</button></div></fieldset>
          <fieldset className="filter-group"><legend>Fotograf</legend><div className="photographer-filter" id="photographer-filter"><button type="button" className="is-active" data-photographer-filter="all" aria-pressed="true"><span>Alle fotografer</span><span className="stage-filter__count">0</span></button></div></fieldset>
          <div className="filter-actions"><button id="auto-assign" className="ui-button ui-button--secondary ui-button--small" type="button"><WandSparkles size={15} aria-hidden="true" /> Autofordel ledige</button><button id="clear-assignments" className="ui-button ui-button--ghost ui-button--small" type="button">Nullstill tildelinger</button></div>
        </section>

        <section className="schedule-panel" id="schedule" aria-labelledby="schedule-title">
          <div className="schedule-heading"><div><p className="panel-kicker">BEMANNINGSPLAN</p><h2 id="schedule-title">Alle aktiviteter</h2></div><div className="schedule-legend" aria-label="Statusforklaring"><span><i className="status-dot status-dot--covered" /> Bemannet</span><span><i className="status-dot status-dot--open" /> Ufordelt</span><span><i className="status-dot status-dot--conflict" /> Konflikt</span><span><i className="partner-dot" /> Main Partner</span><span><i className="priority-dot" /> Kundeprioritet</span></div></div>
          <div id="empty-filter" className="filter-empty" hidden><strong>Ingen aktiviteter passer filtrene</strong><span>Prøv en annen scene eller fjern søket.</span></div>
          <div className="session-list" id="session-list">{program.map((session) => {
            const mainPartners = mainPartnersFor(session); const customerPriority = customerPriorities[session.id] ?? "";
            return <article key={session.id} className={`session-row${mainPartners.length ? " is-main-partner" : ""}${customerPriority ? " is-customer-priority" : ""}`} data-session-id={session.id} data-stage={session.stage} data-title={session.title.toLowerCase()} data-partners={mainPartners.join(" ").toLowerCase()} data-priority={customerPriority.toLowerCase()} data-start={session.start} data-end={session.end} style={{ "--stage-color": stageColors[session.stage] ?? "#899496" } as React.CSSProperties}>
              <div className="session-time"><strong>{session.start}</strong><span>{session.end}</span></div>
              <div className="session-copy"><div className="session-meta"><span className="session-stage"><i />{session.stage}</span>{session.language && <span>{session.language === "no" ? "NO" : "EN"}</span>}{session.type === "break" && <span>PAUSE / MINGLE</span>}{mainPartners.map((partner) => <span className="partner-badge" key={partner}>MAIN PARTNER · {partner}</span>)}{customerPriority && <span className="priority-badge">KUNDEPRIORITET · {customerPriority}</span>}</div><h3>{session.title}</h3><a href={session.href} target="_blank" rel="noreferrer">Se programpost</a></div>
              <div className="assignment-control"><div className="assignment-fields"><div><label htmlFor={`timing-${session.id}`}>1 · Øyeblikk</label><select id={`timing-${session.id}`} data-timing-select={session.id}><option value="start">Start · 15 min</option><option value="end">Slutt · 15 min</option><option value="whole">Hele programposten</option></select></div><div><label htmlFor={`assign-${session.id}`}>2 · Fotograf</label><select id={`assign-${session.id}`} data-assignment-select={session.id}><option value="">Velg fotograf</option></select></div></div><span className="assignment-status" data-status-for={session.id}><i className="status-dot status-dot--open" /> Ufordelt</span></div>
            </article>;
          })}</div>
        </section>

        <section className="team-panel ui-card" aria-label="Fotografteam">
          <div className="panel-heading"><div><p className="panel-kicker">TEAM</p><h2>Fotografer</h2></div><button className="ui-icon-button" type="button" data-ui-dialog-trigger="photographer-dialog" aria-label="Legg til fotograf"><Plus size={19} aria-hidden="true" /></button></div>
          <div id="team-list" className="team-list" /><div id="team-empty" className="team-empty"><Users size={26} aria-hidden="true" /><strong>Teamet er tomt</strong><span>Legg inn fotografene før du fordeler programmet.</span></div><div className="team-tip"><Info size={16} aria-hidden="true" /><p>Velg 15 minutter ved start eller slutt, eller hele programposten. Autofordeling prioriterer korte vinduer.</p></div>
        </section>
      </div>

      <section className="photographer-overview" id="photographer-overview" aria-labelledby="photographer-overview-title">
        <div className="photographer-overview__heading">
          <div>
            <p className="panel-kicker">KJØREPLANER</p>
            <h2 id="photographer-overview-title">Fotografoversikt</h2>
            <p>Samme operative informasjon som i PDF-ene, samlet i visuelle dagslinjer.</p>
          </div>
          <div className="photographer-overview__legend" aria-label="Forklaring">
            <span><i className="partner-dot" /> Main Partner</span>
            <span><i className="priority-dot" /> Kundeprioritet</span>
            <span><i className="status-dot status-dot--conflict" /> Konflikt</span>
          </div>
        </div>
        <div id="photographer-overview-list" className="photographer-overview__list" />
        <div id="photographer-overview-empty" className="photographer-overview__empty">
          <Users size={28} aria-hidden="true" />
          <strong>Ingen fotografer i planen ennå</strong>
          <span>Legg til fotografer for å se individuelle tidslinjer og kjøreplaner.</span>
        </div>
      </section>
    </main>

    <dialog id="photographer-dialog" className="photographer-dialog"><div className="dialog-heading"><div><p className="panel-kicker">NY RESSURS</p><h2>Legg til fotograf</h2></div><button className="ui-icon-button" type="button" data-ui-dialog-close aria-label="Lukk"><X size={19} aria-hidden="true" /></button></div><form id="photographer-form" className="photographer-form"><div className="form-field form-field--wide"><label htmlFor="photographer-name">Navn</label><input id="photographer-name" name="name" required placeholder="Fullt navn" autoComplete="name" /></div><div className="form-field"><label htmlFor="photographer-phone">Mobil</label><input id="photographer-phone" name="phone" type="tel" placeholder="+47 …" autoComplete="tel" /></div><div className="form-field"><label htmlFor="photographer-role">Rolle</label><select id="photographer-role" name="role"><option value="Scene">Scene</option><option value="Hovedfoto">Hovedfoto</option><option value="Sosiale medier">Sosiale medier</option><option value="Backstage">Backstage</option><option value="Video">Video</option></select></div><div className="form-field"><label htmlFor="photographer-from">Tilgjengelig fra</label><input id="photographer-from" name="from" type="time" defaultValue="08:00" required /></div><div className="form-field"><label htmlFor="photographer-to">Tilgjengelig til</label><input id="photographer-to" name="to" type="time" defaultValue="18:00" required /></div><div className="form-field form-field--color"><label htmlFor="photographer-color">Fargekode</label><input id="photographer-color" name="color" type="color" defaultValue="#37c9d4" /></div><div className="dialog-actions"><button className="ui-button ui-button--ghost" type="button" data-ui-dialog-close>Avbryt</button><button className="ui-button ui-button--primary" type="submit">Legg til i teamet</button></div></form></dialog>
    <div id="toast-region" className="toast-region" aria-live="polite" />
    <script id="program-data" type="application/json" dangerouslySetInnerHTML={{ __html: JSON.stringify(plannerProgram).replaceAll("<", "\\u003c") }} />
    <FrameOpsBootstrap />
  </>;
}
