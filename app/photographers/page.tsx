/* eslint-disable @next/next/no-html-link-for-pages -- Full reload reinitializes the shared planning runtime between workspaces. */
import { ArrowLeft, CalendarDays, History, MapPin, Users } from "lucide-react";
import AuthControl from "@/components/auth-control";
import { isEditor } from "@/lib/auth";
import { plannerProgram } from "@/lib/planner-program";
import FrameOpsBootstrap from "../frameops-bootstrap";

export default async function PhotographerPlansPage() {
  const canEdit = await isEditor();
  return <>
    <header className="topbar">
      <a className="topbar__brand topbar__brand-link" href="/" aria-label="Til bemanningsplanen">
        <img src="/ops-logo.png" width="126" height="66" alt="Oslo Proptech Summit" />
        <span className="brand-divider" aria-hidden="true" />
        <span><span className="product-kicker">EMC</span><strong>Eventphoto Mission Control</strong></span>
      </a>
      <div className="topbar__meta"><span><CalendarDays size={15} aria-hidden="true" /> 21. oktober 2026</span><span><MapPin size={15} aria-hidden="true" /> Construction City</span><span id="sync-status" className="sync-badge sync-badge--loading" role="status" aria-live="polite"><i /> Kobler til…</span><AuthControl /></div>
    </header>

    <main className="app-shell photographer-plans-page">
      <section className="page-heading photographer-plans-page__heading" aria-labelledby="photographer-overview-title">
        <div><p className="eyebrow">OPERATIVE KJØREPLANER</p><h1 id="photographer-overview-title">Fotografplaner</h1><p className="lede">Velg fotograf for å se hele arbeidsdagen, tidslinjen og kundeprioriteringene uten støy fra hovedprogrammet.</p></div>
        <div className="page-heading__actions">{canEdit && <a href="/history" className="ui-button ui-button--outline"><History size={16} aria-hidden="true" /> Endringshistorikk</a>}<a href="/" className="ui-button ui-button--outline"><ArrowLeft size={16} aria-hidden="true" /> Til bemanningsplan</a></div>
      </section>

      <section className="photographer-overview photographer-overview--standalone" id="photographer-overview" aria-labelledby="photographer-overview-title">
        <div className="photographer-overview__legend" aria-label="Forklaring">
          <span><i className="partner-dot" /> Main Partner</span>
          <span><i className="priority-dot" /> Kundeprioritet</span>
          <span><i className="status-dot status-dot--conflict" /> Konflikt</span>
        </div>
        <div id="photographer-overview-list" className="photographer-overview__list" />
        <div id="photographer-overview-empty" className="photographer-overview__empty">
          <Users size={28} aria-hidden="true" />
          <strong>Ingen fotografer i planen ennå</strong>
          <span>Legg til fotografer i bemanningsplanen for å se individuelle kjøreplaner.</span>
        </div>
      </section>
    </main>

    <div id="toast-region" className="toast-region" aria-live="polite" />
    <script id="program-data" type="application/json" dangerouslySetInnerHTML={{ __html: JSON.stringify(plannerProgram).replaceAll("<", "\\u003c") }} />
    <FrameOpsBootstrap />
  </>;
}
