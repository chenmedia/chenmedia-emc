/* eslint-disable @next/next/no-html-link-for-pages -- Full reload keeps the planning runtime synchronized after a restore. */
import { ArrowLeft, CalendarDays, History, MapPin } from "lucide-react";
import { redirect } from "next/navigation";
import AuthControl from "@/components/auth-control";
import { isEditor } from "@/lib/auth";
import HistoryPanel from "./history-panel";

export default async function HistoryPage() {
  if (!(await isEditor())) redirect("/auth/sign-in");

  return <>
    <header className="topbar">
      <a className="topbar__brand topbar__brand-link" href="/" aria-label="Til bemanningsplanen">
        <img src="/ops-logo.png" width="126" height="66" alt="Oslo Proptech Summit" />
        <span className="brand-divider" aria-hidden="true" />
        <span><span className="product-kicker">EMC</span><strong>Eventphoto Mission Control</strong></span>
      </a>
      <div className="topbar__meta"><span><CalendarDays size={15} aria-hidden="true" /> 21. oktober 2026</span><span><MapPin size={15} aria-hidden="true" /> Construction City</span><AuthControl /></div>
    </header>

    <main className="app-shell history-page">
      <section className="page-heading history-page__heading" aria-labelledby="history-title">
        <div><p className="eyebrow">REDAKTØRVERKTØY</p><h1 id="history-title">Endringshistorikk</h1><p className="lede">Se hvem som endret planen, hva som ble endret og gjenopprett en tidligere versjon uten å miste nyere historikk.</p></div>
        <div className="page-heading__actions"><a href="/" className="ui-button ui-button--outline"><ArrowLeft size={16} aria-hidden="true" /> Til bemanningsplan</a></div>
      </section>
      <section aria-labelledby="history-list-title">
        <div className="history-section-heading"><History size={19} aria-hidden="true" /><div><h2 id="history-list-title">Revisjoner</h2><p>Nyeste versjon vises først.</p></div></div>
        <HistoryPanel />
      </section>
    </main>
  </>;
}
