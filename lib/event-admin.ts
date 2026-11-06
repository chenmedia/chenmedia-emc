import "server-only";

import type { EventProgramItem } from "@/lib/events";

const statusValues = new Set(["draft", "planning", "active", "archived"]);
const palette = ["#37c9d4", "#a9cc5d", "#e8a342", "#7fa992", "#8c7898", "#c96e55", "#c7aa69", "#0d7774"];

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function cleanTime(value: unknown) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : "";
}

export function cleanProgram(value: unknown): EventProgramItem[] | null {
  if (!Array.isArray(value) || value.length > 2000) return null;
  const seen = new Set<string>();
  const result: EventProgramItem[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 240) : "";
    const stage = typeof item.stage === "string" ? item.stage.trim().slice(0, 120) : "";
    const start = cleanTime(item.start);
    const end = cleanTime(item.end);
    if (!title || !stage || !start || !end) return null;
    let id = slugify(typeof item.id === "string" ? item.id : title) || `post-${index + 1}`;
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    result.push({
      id,
      title,
      stage,
      start,
      end,
      language: typeof item.language === "string" ? item.language.trim().slice(0, 12) : "",
      type: item.type === "break" ? "break" : "session",
      href: typeof item.href === "string" ? item.href.trim().slice(0, 500) : "",
      mainPartners: Array.isArray(item.mainPartners) ? item.mainPartners.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim().slice(0, 100)).filter(Boolean).slice(0, 20) : [],
      customerPriority: typeof item.customerPriority === "string" ? item.customerPriority.trim().slice(0, 240) : "",
    });
  }
  return result;
}

export function stageColorsFor(program: EventProgramItem[]) {
  return Object.fromEntries([...new Set(program.map((item) => item.stage))].map((stage, index) => [stage, palette[index % palette.length]]));
}

export function cleanEventInput(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim().slice(0, 160) : "";
  const venue = typeof value.venue === "string" ? value.venue.trim().slice(0, 200) : "";
  const startsOn = typeof value.startsOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.startsOn) ? value.startsOn : "";
  const endsOn = typeof value.endsOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.endsOn) ? value.endsOn : startsOn;
  const timezone = typeof value.timezone === "string" ? value.timezone.trim().slice(0, 80) : "Europe/Oslo";
  const status = typeof value.status === "string" && statusValues.has(value.status) ? value.status as "draft" | "planning" | "active" | "archived" : "planning";
  const logoUrl = typeof value.logoUrl === "string" && value.logoUrl.length <= 750_000 ? value.logoUrl : "/ops-logo.png";
  const program = cleanProgram(value.program);
  if (!name || !startsOn || !endsOn || endsOn < startsOn || !program) return null;
  return { name, venue, startsOn, endsOn, timezone, status, logoUrl, program, stageColors: stageColorsFor(program) };
}
