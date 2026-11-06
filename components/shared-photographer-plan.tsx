import { AlertTriangle, CalendarDays, Camera, CheckCircle2, Clock3, MapPin, RefreshCcw } from "lucide-react";
import type { EmcEvent } from "@/lib/events";

type Photographer = { id: string; name: string; phone: string; role: string; from: string; to: string; color: string };
type Assignment = { photographerId: string; timing: "start" | "end" | "whole" };
type Props = { event: EmcEvent; photographer: Photographer; assignments: Record<string, Assignment>; revision: number; changes: string[]; lastViewedRevision: number };

function minutes(value: string) { const [hours, mins] = value.split(":").map(Number); return hours * 60 + mins; }
function timingLabel(timing: Assignment["timing"]) { return timing === "start" ? "Ved start" : timing === "end" ? "Ved slutt" : "Hele posten"; }

export default function SharedPhotographerPlan({ event, photographer, assignments, revision, changes, lastViewedRevision }: Props) {
  const items = event.program.filter((item) => assignments[item.id]?.photographerId === photographer.id).sort((a, b) => a.start.localeCompare(b.start));
  const start = items.length ? Math.min(...items.map((item) => minutes(item.start))) : 8 * 60;
  const end = items.length ? Math.max(...items.map((item) => minutes(item.end))) : 18 * 60;
  const span = Math.max(60, end - start);
  return <main className="shared-plan">
    <header className="shared-plan__hero"><div><span className="shared-plan__status"><i /> LIVE PLAN · V{revision}</span><h1>{photographer.name}</h1><p>{photographer.role} · tilgjengelig {photographer.from}–{photographer.to}</p></div><a className="btn btn-outline btn-sm" href=""><RefreshCcw size={15} /> Oppdater siden</a></header>
    <section className="shared-plan__event" aria-label="Eventinformasjon"><div><Camera size={20} /><span><strong>{event.name}</strong><small><CalendarDays size={14} /> {event.startsOn}{event.endsOn !== event.startsOn ? `–${event.endsOn}` : ""}</small></span></div><div><MapPin size={17} /><span>{event.venue}</span></div></section>
    {changes.length > 0 && <section className="shared-plan__changes"><AlertTriangle size={20} /><div><strong>{revision - lastViewedRevision} ny {revision - lastViewedRevision === 1 ? "versjon" : "versjoner"} siden sist</strong><ul>{changes.slice(0, 6).map((change, index) => <li key={`${change}-${index}`}>{change}</li>)}</ul></div></section>}
    {!changes.length && lastViewedRevision > 0 && <p className="shared-plan__up-to-date"><CheckCircle2 size={17} /> Du har sett siste versjon av planen.</p>}
    <section className="shared-timeline" aria-labelledby="timeline-title"><header><div><h2 id="timeline-title">Din arbeidsdag</h2><p>{items.length} fotooppdrag i tidsrekkefølge</p></div><span><Clock3 size={15} /> {items[0]?.start || photographer.from}–{items.at(-1)?.end || photographer.to}</span></header><div className="shared-timeline__rail">{items.map((item) => { const left = ((minutes(item.start) - start) / span) * 100; const width = Math.max(2.5, ((minutes(item.end) - minutes(item.start)) / span) * 100); return <i key={item.id} style={{ left: `${left}%`, width: `${width}%`, background: event.stageColors[item.stage] || photographer.color }} title={`${item.start} ${item.title}`} />; })}</div></section>
    <section className="shared-agenda" aria-label="Dine fotooppdrag">{items.map((item, index) => <article key={item.id} style={{ "--stage-color": event.stageColors[item.stage] || photographer.color } as React.CSSProperties}><div className="shared-agenda__time"><strong>{item.start}</strong><span>{item.end}</span></div><div className="shared-agenda__copy"><div><span>{item.stage}</span><b>{timingLabel(assignments[item.id].timing)}</b></div><h2>{item.title}</h2>{item.customerPriority && <p className="shared-agenda__priority">Kundeprioritet · {item.customerPriority}</p>}{item.mainPartners.length > 0 && <p className="shared-agenda__partner">Main Partner · {item.mainPartners.join(", ")}</p>}</div><span className="shared-agenda__number">{String(index + 1).padStart(2, "0")}</span></article>)}</section>
    {!items.length && <section className="shared-plan__empty"><Camera size={28} /><strong>Ingen oppdrag tildelt ennå</strong><span>Planen oppdateres automatisk når fotoleder fordeler programmet.</span></section>}
    <footer className="shared-plan__footer"><strong>Event Mission Control</strong><span>Privat arbeidsplan · oppdater siden før eventstart</span></footer>
  </main>;
}
