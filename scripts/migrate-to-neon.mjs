import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL mangler. Hent miljøvariablene fra Vercel eller legg den i .env.local.");
  process.exit(1);
}

const force = process.argv.includes("--force");
const seedPath = fileURLToPath(new URL("../neon/seed-oslo-proptech-2026.json", import.meta.url));
const seed = JSON.parse(await readFile(seedPath, "utf8"));
const sql = neon(connectionString);

await sql`
  CREATE TABLE IF NOT EXISTS event_states (
    event_key TEXT PRIMARY KEY,
    state JSONB NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT NOT NULL DEFAULT 'system'
  )
`;
await sql`CREATE INDEX IF NOT EXISTS event_states_updated_at_idx ON event_states (updated_at DESC)`;

const [existing] = await sql`
  SELECT revision,
         jsonb_array_length(state->'photographers')::int AS photographer_count,
         (SELECT count(*) FROM jsonb_object_keys(state->'assignments'))::int AS assignment_count
  FROM event_states
  WHERE event_key = ${seed.eventKey}
`;

if (!existing) {
  await sql`
    INSERT INTO event_states (event_key, state, revision, updated_at, updated_by)
    VALUES (
      ${seed.eventKey},
      ${JSON.stringify(seed.state)}::jsonb,
      ${seed.revision},
      ${seed.updatedAt}::timestamptz,
      'chatgpt-site-migration'
    )
  `;
  console.log("Eksisterende EMC-plan ble lagt inn i Neon.");
} else if (force) {
  await sql`
    UPDATE event_states
    SET state = ${JSON.stringify(seed.state)}::jsonb,
        revision = ${seed.revision},
        updated_at = ${seed.updatedAt}::timestamptz,
        updated_by = 'chatgpt-site-migration-force'
    WHERE event_key = ${seed.eventKey}
  `;
  console.log("Eksisterende Neon-plan ble erstattet med migreringskopien (--force).");
} else {
  console.log(
    `Neon har allerede data (revisjon ${existing.revision}, ${existing.photographer_count} fotografer, ${existing.assignment_count} tildelinger). Ingen data ble overskrevet.`,
  );
}

const [verified] = await sql`
  SELECT revision,
         jsonb_array_length(state->'photographers')::int AS photographer_count,
         (SELECT count(*) FROM jsonb_object_keys(state->'assignments'))::int AS assignment_count
  FROM event_states
  WHERE event_key = ${seed.eventKey}
`;

const expectedPhotographers = seed.state.photographers.length;
const expectedAssignments = Object.keys(seed.state.assignments).length;
console.log(
  `Verifisert Neon: revisjon ${verified.revision}, ${verified.photographer_count}/${expectedPhotographers} fotografer, ${verified.assignment_count}/${expectedAssignments} tildelinger.`,
);

if (
  Number(verified.photographer_count) !== expectedPhotographers
  || Number(verified.assignment_count) !== expectedAssignments
) {
  console.error("Datamengden avviker fra migreringskopien. Bruk --force bare etter at Neon-dataene er kontrollert.");
  process.exit(2);
}
