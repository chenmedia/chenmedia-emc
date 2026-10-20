import program from "../src/data/program.json";

export const stages = ["Alle", "Glasshallen", "Praktisk Proptech", "Energy First Real Estate", "Future of Work & Life", "Behind The Build", "The Deal Room", "Founders' Lounge", "The Board Room", "Side Events", "All stages", "Scene ikke oppgitt"];

export const stageColors: Record<string, string> = {
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

export const mainPartnersFor = (session: (typeof program)[number]) => {
  const partners = [...(partnerSessions[session.id] ?? [])];
  if (session.stage === "Future of Work & Life") partners.push("OBOS");
  if (session.stage === "Praktisk Proptech") partners.push("Noova Energy Systems");
  return [...new Set(partners)];
};

export const customerPriorities: Record<string, string> = {
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

export const plannerProgram = program.map((session) => ({
  ...session,
  mainPartners: mainPartnersFor(session),
  customerPriority: customerPriorities[session.id] ?? "",
}));

export const stageCounts = Object.fromEntries(stages.map((stage) => [stage, stage === "Alle" ? program.length : program.filter((item) => item.stage === stage).length]));

export { program };
