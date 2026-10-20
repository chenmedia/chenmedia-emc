"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, History, RotateCcw } from "lucide-react";

type HistoryEntry = {
  revision: number;
  action: "save" | "restore" | "baseline";
  changes: string[];
  changedAt: string;
  changedBy: string;
  photographerCount: number;
  assignmentCount: number;
};

type HistoryPayload = {
  currentRevision: number;
  entries: HistoryEntry[];
};

const formatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

async function requestHistory() {
  const response = await fetch("/api/history", { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json() as HistoryPayload & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Kunne ikke hente historikken.");
  return payload;
}

export default function HistoryPanel() {
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState("");
  const [pendingRevision, setPendingRevision] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoredFrom, setRestoredFrom] = useState<number | null>(null);

  async function loadHistory() {
    try {
      const payload = await requestHistory();
      setData(payload);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kunne ikke hente historikken.");
    }
  }

  useEffect(() => {
    let active = true;
    void requestHistory().then((payload) => {
      if (!active) return;
      setData(payload);
      setError("");
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Kunne ikke hente historikken.");
    });
    return () => { active = false; };
  }, []);

  async function restore(revision: number) {
    setRestoring(true);
    setError("");
    try {
      const response = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ revision }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Kunne ikke gjenopprette revisjonen.");
      setRestoredFrom(revision);
      setPendingRevision(null);
      await loadHistory();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kunne ikke gjenopprette revisjonen.");
    } finally {
      setRestoring(false);
    }
  }

  if (error && !data) return <div className="history-state history-state--error" role="alert"><strong>Historikken kunne ikke lastes</strong><span>{error}</span></div>;
  if (!data) return <div className="history-state" role="status"><History size={24} aria-hidden="true" /><strong>Laster endringshistorikk…</strong></div>;
  if (!data.entries.length) return <div className="history-state"><History size={24} aria-hidden="true" /><strong>Ingen endringer logget ennå</strong><span>Den første endringen som lagres vil opprette historikken.</span></div>;

  return <>
    {restoredFrom !== null && <div className="history-success" role="status"><Check size={17} aria-hidden="true" /><span>Revisjon {restoredFrom} er gjenopprettet som en ny revisjon. Historikken er bevart.</span></div>}
    {error && <div className="history-inline-error" role="alert">{error}</div>}
    <div className="history-list" aria-label="Lagrede revisjoner">
      {data.entries.map((entry) => {
        const current = entry.revision === data.currentRevision;
        const confirming = entry.revision === pendingRevision;
        return <article className="history-entry" key={entry.revision}>
          <div className="history-entry__revision"><span>REV</span><strong>{entry.revision}</strong></div>
          <div className="history-entry__body">
            <div className="history-entry__topline">
              <div><strong>{entry.action === "restore" ? "Gjenopprettet versjon" : entry.action === "baseline" ? "Sikkerhetskopi" : "Planendring"}</strong><span>{formatter.format(new Date(entry.changedAt))} · {entry.changedBy}</span></div>
              <div className="history-entry__meta"><span>{entry.photographerCount} fotografer</span><span>{entry.assignmentCount} oppdrag</span>{current && <b>Aktiv versjon</b>}</div>
            </div>
            <details className="history-entry__details">
              <summary><ChevronDown size={14} aria-hidden="true" /> Se hva som ble endret ({entry.changes.length})</summary>
              <ul>{entry.changes.map((change, index) => <li key={`${entry.revision}-${index}`}>{change}</li>)}</ul>
            </details>
            {!current && <div className="history-entry__actions">
              {confirming ? <div className="history-confirm"><span>Dette erstatter den aktive planen med revisjon {entry.revision}. Nåværende versjon beholdes i historikken.</span><button className="ui-button ui-button--ghost ui-button--small" type="button" onClick={() => setPendingRevision(null)} disabled={restoring}>Avbryt</button><button className="ui-button ui-button--primary ui-button--small" type="button" onClick={() => void restore(entry.revision)} disabled={restoring}>{restoring ? "Gjenoppretter…" : "Bekreft gjenoppretting"}</button></div>
                : <button className="ui-button ui-button--outline ui-button--small" type="button" onClick={() => setPendingRevision(entry.revision)}><RotateCcw size={14} aria-hidden="true" /> Gjenopprett denne</button>}
            </div>}
          </div>
        </article>;
      })}
    </div>
  </>;
}
