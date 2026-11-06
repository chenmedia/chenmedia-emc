"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, FileSpreadsheet, ImagePlus, MapPin, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ProgramRow = {
  id: string;
  title: string;
  stage: string;
  start: string;
  end: string;
  language: string;
  type: "session" | "break";
  href: string;
  mainPartners: string[];
  customerPriority: string;
};

function slugify(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function splitCsvLine(line: string, separator: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === separator && !quoted) { cells.push(cell.trim()); cell = ""; }
    else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

function parseProgram(text: string): ProgramRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const separator = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvLine(lines[0], separator).map((value) => value.toLowerCase().trim());
  const aliases: Record<string, string[]> = {
    title: ["title", "tittel", "program", "session"], stage: ["stage", "scene", "rom"], start: ["start", "fra", "starttid"],
    end: ["end", "slutt", "til", "sluttid"], language: ["language", "språk", "spraak"], type: ["type", "programtype"],
    href: ["href", "url", "lenke"], partners: ["mainpartners", "main partner", "partner", "partnere"],
    priority: ["customerpriority", "kundeprioritet", "prioritet", "fotoprioritet"],
  };
  const indexFor = (key: string) => headers.findIndex((header) => aliases[key].includes(header));
  const indexes = Object.fromEntries(Object.keys(aliases).map((key) => [key, indexFor(key)]));
  return lines.slice(1).flatMap((line, rowIndex) => {
    const cells = splitCsvLine(line, separator);
    const get = (key: string) => indexes[key] >= 0 ? (cells[indexes[key]] || "").trim() : "";
    const title = get("title"); const stage = get("stage"); const start = get("start"); const end = get("end");
    if (!title || !stage || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return [];
    return [{
      id: slugify(title) || `post-${rowIndex + 1}`, title, stage, start, end,
      language: get("language"), type: /break|pause|mingle/i.test(get("type")) ? "break" : "session",
      href: get("href"), mainPartners: get("partners").split(/[|,]/).map((value) => value.trim()).filter(Boolean),
      customerPriority: get("priority"),
    } satisfies ProgramRow];
  });
}

const example = "Tittel;Scene;Start;Slutt;Type;Språk;Main Partner;Kundeprioritet\nRegistrering;Foajé;08:00;08:45;pause;no;;Når det passer\nÅpningsinnlegg;Hovedscene;09:00;09:30;session;no;Hovedpartner;Ved start";

export default function EventWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [timezone, setTimezone] = useState("Europe/Oslo");
  const [status, setStatus] = useState("planning");
  const [logoUrl, setLogoUrl] = useState("/ops-logo.png");
  const [programText, setProgramText] = useState(example);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const program = useMemo(() => parseProgram(programText), [programText]);
  const stages = useMemo(() => [...new Set(program.map((row) => row.stage))], [program]);

  async function readFile(file: File) {
    const text = await file.text();
    setProgramText(text);
  }

  async function readLogo(file: File) {
    if (file.size > 500_000) { setError("Logoen må være mindre enn 500 KB."); return; }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(String(reader.result || "/ops-logo.png"));
    reader.readAsDataURL(file);
  }

  async function createEvent() {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, venue, startsOn, endsOn: endsOn || startsOn, timezone, status, logoUrl, program }),
      });
      const payload = await response.json() as { slug?: string; error?: string };
      if (!response.ok || !payload.slug) throw new Error(payload.error || "Kunne ikke opprette eventet.");
      router.push(`/events/${payload.slug}`);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunne ikke opprette eventet."); setPending(false); }
  }

  const detailsValid = Boolean(name.trim() && startsOn && (endsOn || startsOn) >= startsOn);
  return <div className="setup-flow">
    <nav className="setup-progress" aria-label="Fremdrift">
      {["Grunninfo", "Programimport", "Kontroll"].map((label, index) => <button key={label} type="button" className={step === index + 1 ? "is-current" : step > index + 1 ? "is-complete" : ""} onClick={() => index + 1 < step && setStep(index + 1)}><span>{step > index + 1 ? <Check size={15} /> : index + 1}</span>{label}</button>)}
    </nav>

    {step === 1 && <section className="setup-panel" aria-labelledby="setup-details-title">
      <div className="setup-panel__intro"><h2 id="setup-details-title">Opprett produksjonen</h2><p>Grunninformasjonen brukes i dashboard, kjøreplaner og PDF-er.</p></div>
      <div className="setup-form-grid">
        <label className="setup-field setup-field--wide"><span>Eventnavn</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Eksempel: Oslo Proptech Summit 2027" autoFocus required /></label>
        <label className="setup-field"><span>Startdato</span><input type="date" value={startsOn} onChange={(event) => { setStartsOn(event.target.value); if (!endsOn) setEndsOn(event.target.value); }} required /></label>
        <label className="setup-field"><span>Sluttdato</span><input type="date" min={startsOn} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} required /></label>
        <label className="setup-field setup-field--wide"><span>Sted</span><span className="setup-input-icon"><MapPin size={16} /><input value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="Venue eller adresse" /></span></label>
        <label className="setup-field"><span>Tidssone</span><select value={timezone} onChange={(event) => setTimezone(event.target.value)}><option>Europe/Oslo</option><option>Europe/Stockholm</option><option>Europe/Copenhagen</option><option>Europe/London</option></select></label>
        <label className="setup-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">Kladd</option><option value="planning">Planlegging</option><option value="active">Aktivt</option></select></label>
        <label className="setup-upload setup-field--wide"><ImagePlus size={22} /><span><strong>Eventlogo</strong><small>PNG, JPG eller WebP · maks 500 KB</small></span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && void readLogo(event.target.files[0])} /></label>
      </div>
    </section>}

    {step === 2 && <section className="setup-panel" aria-labelledby="setup-program-title">
      <div className="setup-panel__intro"><h2 id="setup-program-title">Importer programmet</h2><p>Last opp CSV/TSV fra Excel eller lim inn data. Påkrevde kolonner: tittel, scene, start og slutt.</p></div>
      <label className="setup-upload setup-upload--program"><Upload size={22} /><span><strong>Velg programfil</strong><small>.csv eller tab-separert eksport fra Excel</small></span><input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={(event) => event.target.files?.[0] && void readFile(event.target.files[0])} /></label>
      <label className="setup-field setup-field--wide"><span>Programdata</span><textarea rows={10} value={programText} onChange={(event) => setProgramText(event.target.value)} spellCheck={false} /></label>
      <div className="import-result"><FileSpreadsheet size={18} /><span><strong>{program.length} programposter funnet</strong><small>{stages.length} scener · {program.filter((item) => item.customerPriority).length} kundeprioriteringer · {program.filter((item) => item.mainPartners.length).length} partnerposter</small></span></div>
    </section>}

    {step === 3 && <section className="setup-panel" aria-labelledby="setup-review-title">
      <div className="setup-panel__intro"><h2 id="setup-review-title">Klar for kontrollrommet</h2><p>Kontroller oppsettet før eventet opprettes. Alt kan endres senere.</p></div>
      <div className="setup-review">
        <div className="setup-review__logo"><img src={logoUrl} alt="" /></div>
        <div><h3>{name || "Event uten navn"}</h3><p><CalendarDays size={15} /> {startsOn || "Dato mangler"}{endsOn && endsOn !== startsOn ? `–${endsOn}` : ""}</p><p><MapPin size={15} /> {venue || "Sted ikke satt"}</p></div>
        <dl><div><dt>Programposter</dt><dd>{program.length}</dd></div><div><dt>Scener</dt><dd>{stages.length}</dd></div><div><dt>Status</dt><dd>{status === "active" ? "Aktivt" : status === "draft" ? "Kladd" : "Planlegging"}</dd></div></dl>
      </div>
      {program.length === 0 && <p className="setup-error">Ingen gyldige programposter ble funnet. Gå tilbake og kontroller importen.</p>}
    </section>}

    {error && <p className="setup-error" role="alert">{error}</p>}
    <div className="setup-actions">
      {step > 1 ? <button className="btn btn-outline" type="button" onClick={() => setStep(step - 1)}><ArrowLeft size={17} /> Tilbake</button> : <Link className="btn btn-ghost" href="/events"><ArrowLeft size={17} /> Avbryt</Link>}
      {step < 3 ? <button className="btn btn-primary" type="button" disabled={(step === 1 && !detailsValid) || (step === 2 && !program.length)} onClick={() => setStep(step + 1)}>Fortsett <ArrowRight size={17} /></button> : <button className="btn btn-primary" type="button" disabled={pending || !detailsValid || !program.length} onClick={() => void createEvent()}>{pending ? "Oppretter…" : "Opprett event"} <Check size={17} /></button>}
    </div>
  </div>;
}
