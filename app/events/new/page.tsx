/* eslint-disable @next/next/no-html-link-for-pages -- Dashboard navigation intentionally resets the event-scoped runtime. */
import { redirect } from "next/navigation";
import AuthControl from "@/components/auth-control";
import EventWizard from "@/components/event-wizard";
import { isEditor } from "@/lib/auth";
import { CHEN_MEDIA_LOGO, PRODUCT_NAME, PRODUCT_SHORT_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  if (!(await isEditor())) redirect(`/auth/sign-in?returnTo=${encodeURIComponent("/events/new")}`);
  return <div className="emc-daisy admin-surface">
    <header className="dashboard-topbar"><a className="dashboard-brand" href="/events" aria-label="Til eventoversikten"><img src={CHEN_MEDIA_LOGO} width="166" height="57" alt="Chen Media" /><span className="dashboard-brand__divider" aria-hidden="true" /><span className="dashboard-product"><b>{PRODUCT_SHORT_NAME}</b><strong>{PRODUCT_NAME}</strong></span></a><AuthControl /></header>
    <main className="admin-shell"><header className="admin-heading"><div><h1>Nytt event</h1><p>Bygg et nytt kontrollrom fra programfil til ferdig bemanningsplan.</p></div></header><EventWizard /></main>
  </div>;
}
