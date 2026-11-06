"use client";

import { useMemo, useState } from "react";
import { Archive, Check, Copy, FileSpreadsheet, Link2, RefreshCcw, Save, ShieldCheck, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { EmcEvent } from "@/lib/events";
import type { EventMember, EventRole, EventShare } from "@/lib/event-access";

type Photographer = { id: string; name: string };
type Props = { event: EmcEvent; members: EventMember[]; shares: EventShare[]; photographers: Photographer[]; canManage: boolean };

function parseRows(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const separator = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const split = (line: string) => line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ""));
  const headers = split(lines[0]).map((header) => header.toLowerCase());
  const find = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const indexes = { title: find("title", "tittel", "program"), stage: find("stage", "scene", "rom"), start: find("start", "fra"), end: find("end", "slutt", "til"), type: find("type"), language: find("language", "språk"), partner: find("main partner", "mainpartners", "partner"), priority: find("kundeprioritet", "customerpriority", "prioritet"), href: find("href", "url", "lenke") };
  const value = (cells: string[], index: number) => index >= 0 ? cells[index] || "" : "";
  return lines.slice(1).flatMap((line, row) => {
    const cells = split(line); const title = value(cells, indexes.title); const stage = value(cells, indexes.stage); const start = value(cells, indexes.start); const end = value(cells, indexes.end);
    if (!title || !stage || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return [];
    const id = `${title.toLowerCase().replace(/[^a-z0-9æøå]+/g, "-").replace(/^-|-$/g, "")}-${row + 1}`;
    return [{ id, title, stage, start, end, language: value(cells, indexes.language), type: /break|pause|mingle/i.test(value(cells, indexes.type)) ? "break" : "session", href: value(cells, indexes.href), mainPartners: value(cells, indexes.partner).split(/[|,]/).map((entry) => entry.trim()).filter(Boolean), customerPriority: value(cells, indexes.priority) }];
  });
}

export default function EventSettings({ event, members: initialMembers, shares: initialShares, photographers, canManage }: Props) {
  const router = useRouter();
  const endpoint = `/api/events/${event.slug}/manage`;
  const [name, setName] = useState(event.name); const [venue, setVenue] = useState(event.venue);
  const [startsOn, setStartsOn] = useState(event.startsOn); const [endsOn, setEndsOn] = useState(event.endsOn);
  const [timezone, setTimezone] = useState(event.timezone); const [status, setStatus] = useState(event.status);
  const [logoUrl, setLogoUrl] = useState(event.logoUrl); const [program, setProgram] = useState(event.program);
  const [members, setMembers] = useState(initialMembers); const [shares, setShares] = useState(initialShares);
  const [email, setEmail] = useState(""); const [role, setRole] = useState<EventRole>("editor");
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  const stages = useMemo(() => new Set(program.map((item) => item.stage)).size, [program]);

  async function action(body: Record<string, unknown>) {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json() as { error?: string; slug?: string; token?: string };
    if (!response.ok) throw new Error(payload.error || "Handlingen kunne ikke fullføres.");
    return payload;
  }

  async function save() {
    setPending(true); setError(""); setMessage("");
    try { await action({ action: "update", event: { name, venue, startsOn, endsOn, timezone, status, logoUrl, program } }); setMessage("Eventoppsettet er lagret."); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Kunne ikke lagre."); }
    finally { setPending(false); }
  }

  async function cloneEvent() {
    setPending(true); setError("");
    try { const payload = await action({ action: "clone", name: `${name} – kopi` }); router.push(`/events/${payload.slug}/settings`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Kunne ikke duplisere."); setPending(false); }
  }

  async function addMember() {
    setError("");
    try { await action({ action: "member", email, role }); setMembers((current) => [...current.filter((member) => member.email !== email.toLowerCase()), { email: email.toLowerCase(), role, addedAt: new Date().toISOString(), addedBy: "Deg" }]); setEmail(""); setMessage("Tilgangen er oppdatert."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Kunne ikke oppdatere tilgang."); }
  }

  async function removeMember(memberEmail: string) {
    try { await action({ action: "remove-member", email: memberEmail }); setMembers((current) => current.filter((member) => member.email !== memberEmail)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Kunne ikke fjerne tilgang."); }
  }

  async function createShare(photographerId: string) {
    try { const payload = await action({ action: "share", photographerId }); const photographer = photographers.find((person) => person.id === photographerId); if (payload.token && photographer) setShares((current) => [...current.filter((share) => share.photographerId !== photographerId), { token: payload.token!, photographerId, photographerName: photographer.name, enabled: true, lastViewedRevision: 0, createdAt: new Date().toISOString() }]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Kunne ikke lage lenke."); }
  }

  async function revokeShare(token: string) {
    try { await action({ action: "revoke-share", token }); setShares((current) => current.map((share) => share.token === token ? { ...share, enabled: false } : share)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Kunne ikke deaktivere lenken."); }
  }

  async function copyShare(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${token}`); setMessage("Privat lenke kopiert.");
  }

  function importProgram(file: File) { void file.text().then((text) => { const rows = parseRows(text); if (!rows.length) setError("Fant ingen gyldige programposter i filen."); else { setProgram(rows as EmcEvent["program"]); setMessage(`${rows.length} programposter er klare. Trykk Lagre endringer.`); } }); }
  function importLogo(file: File) { if (file.size > 500_000) { setError("Logoen må være mindre enn 500 KB."); return; } const reader = new FileReader(); reader.onload = () => setLogoUrl(String(reader.result)); reader.readAsDataURL(file); }

  return <div className="settings-layout">
    <nav className="settings-nav" aria-label="Eventoppsett"><a href="#details">Grunninfo</a><a href="#program">Program</a><a href="#access">Tilgang</a><a href="#sharing">Fotograflenker</a><a href="#lifecycle">Livssyklus</a></nav>
    <div className="settings-content">
      <section className="settings-section" id="details"><header><div><h2>Grunninfo</h2><p>Navn, dato, sted og identitet som brukes i hele produksjonen.</p></div><Save size={20} /></header><div className="setup-form-grid"><label className="setup-field setup-field--wide"><span>Eventnavn</span><input value={name} onChange={(e) => setName(e.target.value)} /></label><label className="setup-field"><span>Startdato</span><input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></label><label className="setup-field"><span>Sluttdato</span><input type="date" min={startsOn} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} /></label><label className="setup-field setup-field--wide"><span>Sted</span><input value={venue} onChange={(e) => setVenue(e.target.value)} /></label><label className="setup-field"><span>Tidssone</span><select value={timezone} onChange={(e) => setTimezone(e.target.value)}><option>Europe/Oslo</option><option>Europe/Stockholm</option><option>Europe/Copenhagen</option><option>Europe/London</option></select></label><label className="setup-field"><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value as EmcEvent["status"])}><option value="draft">Kladd</option><option value="planning">Planlegging</option><option value="active">Aktivt</option><option value="archived">Arkivert</option></select></label><label className="setup-upload setup-field--wide"><span><strong>Bytt eventlogo</strong><small>PNG, JPG eller WebP · maks 500 KB</small></span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && importLogo(e.target.files[0])} /></label></div></section>

      <section className="settings-section" id="program"><header><div><h2>Program</h2><p>{program.length} poster fordelt på {stages} scener.</p></div><FileSpreadsheet size={20} /></header><div className="settings-import"><div><strong>Erstatt program fra CSV eller Excel-eksport</strong><span>Tildelinger beholdes når programpostens ID er den samme. Kontroller planen etter import.</span></div><label className="btn btn-outline">Velg fil<input type="file" accept=".csv,.tsv,text/csv" onChange={(e) => e.target.files?.[0] && importProgram(e.target.files[0])} /></label></div><div className="program-preview">{program.slice(0, 6).map((item) => <div key={item.id}><time>{item.start}</time><span><strong>{item.title}</strong><small>{item.stage}</small></span></div>)}{program.length > 6 && <p>+ {program.length - 6} flere programposter</p>}</div></section>

      <section className="settings-section" id="access"><header><div><h2>Tilgang</h2><p>Bestem hvem som kan redigere eller lese akkurat dette eventet.</p></div><ShieldCheck size={20} /></header>{canManage && <div className="access-add"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="navn@firma.no" /><select value={role} onChange={(e) => setRole(e.target.value as EventRole)}><option value="editor">Redaktør</option><option value="viewer">Kun visning</option><option value="owner">Eier</option></select><button className="btn btn-primary" type="button" disabled={!email} onClick={() => void addMember()}><UserPlus size={16} /> Legg til</button></div>}<div className="access-list">{members.map((member) => <div key={member.email}><span><strong>{member.email}</strong><small>{member.role === "owner" ? "Eier" : member.role === "editor" ? "Redaktør" : "Kun visning"}</small></span>{canManage && member.role !== "owner" && <button className="ui-icon-button" type="button" onClick={() => void removeMember(member.email)} aria-label={`Fjern ${member.email}`}><X size={16} /></button>}</div>)}</div></section>

      <section className="settings-section" id="sharing"><header><div><h2>Private fotograflenker</h2><p>Hver fotograf får sin egen mobilplan og ser hva som er endret siden sist.</p></div><Link2 size={20} /></header><div className="share-list">{photographers.map((person) => { const share = shares.find((entry) => entry.photographerId === person.id && entry.enabled); return <div key={person.id}><span><strong>{person.name}</strong><small>{share ? `Aktiv · sist sett på plan v${share.lastViewedRevision}` : "Ingen lenke"}</small></span>{share ? <div><button className="btn btn-outline btn-sm" type="button" onClick={() => void copyShare(share.token)}><Copy size={15} /> Kopier</button><button className="btn btn-ghost btn-sm" type="button" onClick={() => void revokeShare(share.token)}>Deaktiver</button></div> : <button className="btn btn-secondary btn-sm" type="button" onClick={() => void createShare(person.id)}>Lag privat lenke</button>}</div>; })}{!photographers.length && <p className="settings-empty">Legg først fotografer til i bemanningsplanen.</p>}</div></section>

      <section className="settings-section" id="lifecycle"><header><div><h2>Livssyklus</h2><p>Lag en ny produksjon fra dette oppsettet eller flytt eventet ut av aktive planer.</p></div><Archive size={20} /></header><div className="lifecycle-actions"><div><strong>Dupliser event</strong><span>Kopierer program, scener og eventinnstillinger. Fotografteam og tildelinger starter tomt.</span><button className="btn btn-outline" type="button" disabled={!canManage || pending} onClick={() => void cloneEvent()}><RefreshCcw size={16} /> Lag kopi</button></div><div><strong>Arkiver event</strong><span>Eventet beholdes med hele historikken og kan åpnes igjen senere.</span><button className="btn btn-outline" type="button" disabled={status === "archived"} onClick={() => setStatus("archived")}>Merk som arkivert</button></div></div></section>

      {(message || error) && <p className={error ? "settings-message is-error" : "settings-message"} role="status">{error || message}</p>}
      <div className="settings-savebar"><span>{program.length} poster · {members.length} tilganger · {shares.filter((share) => share.enabled).length} aktive lenker</span><button className="btn btn-primary" type="button" disabled={pending} onClick={() => void save()}><Check size={17} /> {pending ? "Lagrer…" : "Lagre endringer"}</button></div>
    </div>
  </div>;
}
