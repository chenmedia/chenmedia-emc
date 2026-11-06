"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Camera, Check, CheckCircle2, Clock3, MapPin, RefreshCcw, Send, UserRoundCheck, X } from "lucide-react";
import type { EmcEvent } from "@/lib/events";

type Photographer = { id: string; name: string; role: string; from: string; to: string; color: string };
type Assignment = { photographerId: string; timing: "start" | "end" | "whole" };
type TaskProgress = { status: "done" | "handoff"; reason?: string; requestedBy?: string; requestedTo?: string; requestedAt?: string };
type Props = { event: EmcEvent; photographer: Photographer; photographers: Photographer[]; assignments: Record<string, Assignment>; taskProgress: Record<string, TaskProgress>; shareToken: string; revision: number; changes: string[]; lastViewedRevision: number };
type TaskAction = "done" | "reopen" | "handoff" | "accept" | "decline";

function minutes(value: string) { const [hours, mins] = value.split(":").map(Number); return hours * 60 + mins; }
function timingLabel(timing: Assignment["timing"]) { return timing === "start" ? "Ved start" : timing === "end" ? "Ved slutt" : "Hele posten"; }

export default function SharedPhotographerPlan({ event, photographer, photographers, assignments: initialAssignments, taskProgress: initialProgress, shareToken, revision: initialRevision, changes, lastViewedRevision }: Props) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [taskProgress, setTaskProgress] = useState(initialProgress);
  const [revision, setRevision] = useState(initialRevision);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [handoffSession, setHandoffSession] = useState<string | null>(null);
  const [reason, setReason] = useState("For lang forflytning");
  const [requestedTo, setRequestedTo] = useState("");

  const items = useMemo(() => event.program.filter((item) => assignments[item.id]?.photographerId === photographer.id).sort((a, b) => a.start.localeCompare(b.start)), [assignments, event.program, photographer.id]);
  const incoming = useMemo(() => event.program.filter((item) => taskProgress[item.id]?.status === "handoff" && taskProgress[item.id]?.requestedTo === photographer.id), [event.program, photographer.id, taskProgress]);
  const doneCount = items.filter((item) => taskProgress[item.id]?.status === "done").length;
  const active = items.find((item) => taskProgress[item.id]?.status !== "done") || items.at(-1);
  const completion = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const start = items.length ? Math.min(...items.map((item) => minutes(item.start))) : 8 * 60;
  const end = items.length ? Math.max(...items.map((item) => minutes(item.end))) : 18 * 60;
  const span = Math.max(60, end - start);

  async function updateTask(action: TaskAction, sessionId: string, details: Record<string, string> = {}) {
    setPending(`${action}:${sessionId}`); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/share/${shareToken}/task`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ action, sessionId, ...details }) });
      const payload = await response.json() as { error?: string; revision?: number; assignments?: Record<string, Assignment>; taskProgress?: Record<string, TaskProgress> };
      if (!response.ok) throw new Error(payload.error || "Kunne ikke oppdatere oppdraget.");
      if (payload.assignments) setAssignments(payload.assignments);
      if (payload.taskProgress) setTaskProgress(payload.taskProgress);
      if (payload.revision) setRevision(payload.revision);
      setHandoffSession(null); setRequestedTo("");
      setNotice(action === "done" ? "Oppdraget er markert som fotografert." : action === "handoff" ? "Avløsningsforespørselen er sendt." : action === "accept" ? "Oppdraget er lagt til i planen din." : "Planen er oppdatert.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Kunne ikke oppdatere planen."); }
    finally { setPending(null); }
  }

  return <main className="shared-plan">
    <header className="shared-plan__hero"><div><span className="shared-plan__status"><i /> FRAMEOPS / EMC · V{revision}</span><h1>{photographer.name}</h1><p>{photographer.role} · tilgjengelig {photographer.from}–{photographer.to}</p></div><a className="btn btn-outline btn-sm" href=""><RefreshCcw size={15} /> Oppdater siden</a></header>
    <section className="shared-plan__event" aria-label="Eventinformasjon"><div><Camera size={20} /><span><strong>{event.name}</strong><small><CalendarDays size={14} /> {event.startsOn}{event.endsOn !== event.startsOn ? `–${event.endsOn}` : ""}</small></span></div><div><MapPin size={17} /><span>{event.venue}</span></div></section>
    {changes.length > 0 && <section className="shared-plan__changes"><AlertTriangle size={20} /><div><strong>{revision - lastViewedRevision} ny {revision - lastViewedRevision === 1 ? "versjon" : "versjoner"} siden sist</strong><ul>{changes.slice(0, 6).map((change, index) => <li key={`${change}-${index}`}>{change}</li>)}</ul></div></section>}
    {!changes.length && lastViewedRevision > 0 && <p className="shared-plan__up-to-date"><CheckCircle2 size={17} /> Du har sett siste versjon av planen.</p>}
    {error && <p className="shared-plan__message shared-plan__message--error" role="alert">{error}</p>}
    {notice && <p className="shared-plan__message" role="status"><CheckCircle2 size={17} /> {notice}</p>}

    {incoming.map((item) => { const request = taskProgress[item.id]; const requester = photographers.find((person) => person.id === request.requestedBy); return <section className="shared-handoff-request" key={item.id}><UserRoundCheck size={22} /><div><strong>{requester?.name || "En fotograf"} trenger avløsning</strong><span>{item.start} · {item.stage}</span><p>{item.title}</p>{request.reason && <small>{request.reason}</small>}</div><div><button className="btn btn-primary btn-sm" disabled={Boolean(pending)} onClick={() => void updateTask("accept", item.id)}><Check size={15} /> Ta oppdraget</button><button className="btn btn-outline btn-sm" disabled={Boolean(pending)} onClick={() => void updateTask("decline", item.id)}>Kan ikke</button></div></section>; })}

    {active && <section className="shared-active-task"><div><span>NESTE OPPDRAG · {timingLabel(assignments[active.id].timing)}</span><h2>{active.title}</h2><p><Clock3 size={15} /> {active.start}–{active.end} · {active.stage}</p></div><div><button className="btn btn-primary" disabled={Boolean(pending)} onClick={() => void updateTask(taskProgress[active.id]?.status === "done" ? "reopen" : "done", active.id)}><Check size={17} /> {taskProgress[active.id]?.status === "done" ? "Åpne igjen" : "Fotografert"}</button><button className="btn btn-outline" disabled={Boolean(pending) || taskProgress[active.id]?.status === "handoff"} onClick={() => setHandoffSession(active.id)}><Send size={17} /> {taskProgress[active.id]?.status === "handoff" ? "Avventer svar" : "Trenger avløsning"}</button></div></section>}

    <section className="shared-progress"><div><span>Dagen din</span><strong>{doneCount} av {items.length} fotografert</strong></div><div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}><i style={{ width: `${completion}%` }} /></div></section>
    <section className="shared-timeline" aria-labelledby="timeline-title"><header><div><h2 id="timeline-title">Din arbeidsdag</h2><p>{items.length} fotooppdrag i tidsrekkefølge</p></div><span><Clock3 size={15} /> {items[0]?.start || photographer.from}–{items.at(-1)?.end || photographer.to}</span></header><div className="shared-timeline__rail">{items.map((item) => { const left = ((minutes(item.start) - start) / span) * 100; const width = Math.max(2.5, ((minutes(item.end) - minutes(item.start)) / span) * 100); return <i className={taskProgress[item.id]?.status === "done" ? "is-done" : ""} key={item.id} style={{ left: `${left}%`, width: `${width}%`, background: event.stageColors[item.stage] || photographer.color }} title={`${item.start} ${item.title}`} />; })}</div></section>
    <section className="shared-agenda" aria-label="Dine fotooppdrag">{items.map((item, index) => { const progress = taskProgress[item.id]; return <article className={progress?.status ? `is-${progress.status}` : ""} key={item.id} style={{ "--stage-color": event.stageColors[item.stage] || photographer.color } as React.CSSProperties}><div className="shared-agenda__time"><strong>{item.start}</strong><span>{item.end}</span></div><div className="shared-agenda__copy"><div><span>{item.stage}</span><b>{timingLabel(assignments[item.id].timing)}</b></div><h2>{item.title}</h2>{item.customerPriority && <p className="shared-agenda__priority">Kundeprioritet · {item.customerPriority}</p>}{item.mainPartners.length > 0 && <p className="shared-agenda__partner">Main Partner · {item.mainPartners.join(", ")}</p>}<div className="shared-agenda__actions"><span className={`shared-task-state is-${progress?.status || "pending"}`}>{progress?.status === "done" ? "Fotografert" : progress?.status === "handoff" ? "Avløsning forespurt" : "Ikke fotografert"}</span><button className="btn btn-sm btn-outline" disabled={Boolean(pending)} onClick={() => void updateTask(progress?.status === "done" ? "reopen" : "done", item.id)}>{progress?.status === "done" ? "Endre" : "Fotografert"}</button>{progress?.status !== "handoff" && <button className="btn btn-sm btn-ghost" disabled={Boolean(pending)} onClick={() => setHandoffSession(item.id)}>Avløsning</button>}</div></div><span className="shared-agenda__number">{String(index + 1).padStart(2, "0")}</span></article>; })}</section>
    {!items.length && <section className="shared-plan__empty"><Camera size={28} /><strong>Ingen oppdrag tildelt ennå</strong><span>Planen oppdateres automatisk når fotoleder fordeler programmet.</span></section>}
    <footer className="shared-plan__footer"><strong>FrameOps / Event Mission Control</strong><span>Privat arbeidsplan · oppdater siden før eventstart</span></footer>

    {active && <div className="shared-mobile-actions"><button className="btn btn-primary" disabled={Boolean(pending)} onClick={() => void updateTask(taskProgress[active.id]?.status === "done" ? "reopen" : "done", active.id)}><Check size={17} /> {taskProgress[active.id]?.status === "done" ? "Åpne igjen" : "Fotografert"}</button><button className="btn btn-outline" disabled={Boolean(pending) || taskProgress[active.id]?.status === "handoff"} onClick={() => setHandoffSession(active.id)}><Send size={17} /> Avløsning</button></div>}

    {handoffSession && <div className="shared-handoff-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHandoffSession(null); }}><section className="shared-handoff-sheet" role="dialog" aria-modal="true" aria-labelledby="handoff-title"><header><div><h2 id="handoff-title">Be om avløsning</h2><p>Du har ansvaret til en annen fotograf godtar.</p></div><button type="button" aria-label="Lukk" onClick={() => setHandoffSession(null)}><X size={20} /></button></header><label>Årsak<select value={reason} onChange={(event) => setReason(event.target.value)}><option>For lang forflytning</option><option>Forrige oppdrag er forsinket</option><option>Overlapp i planen</option><option>Teknisk pause</option><option>Programendring</option><option>Annet</option></select></label><label>Send til<select value={requestedTo} onChange={(event) => setRequestedTo(event.target.value)}><option value="">Velg fotograf</option>{photographers.filter((person) => person.id !== photographer.id).map((person) => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}</select></label><footer><button className="btn btn-outline" type="button" onClick={() => setHandoffSession(null)}>Avbryt</button><button className="btn btn-primary" type="button" disabled={!requestedTo || Boolean(pending)} onClick={() => void updateTask("handoff", handoffSession, { reason, requestedTo })}><Send size={16} /> Send forespørsel</button></footer></section></div>}
  </main>;
}
