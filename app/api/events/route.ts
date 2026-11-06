import { editorLabel, getEditor } from "@/lib/auth";
import { cleanEventInput, slugify } from "@/lib/event-admin";
import { ensureEventAccessSchema } from "@/lib/event-access";
import { getDatabase } from "@/lib/neon";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const editor = await getEditor();
  if (!editor) return json({ error: "Du må være godkjent redaktør for å opprette eventer." }, 401);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Ugyldig forespørsel." }, 400); }
  const event = cleanEventInput(body);
  if (!event) return json({ error: "Kontroller navn, datoer og programdata." }, 400);

  await ensureEventAccessSchema();
  const sql = getDatabase();
  const baseSlug = slugify(event.name) || `event-${Date.now()}`;
  let slug = baseSlug;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const [existing] = await sql`SELECT 1 FROM events WHERE slug = ${slug} LIMIT 1` as Array<{ "?column?": number }>;
    if (!existing) break;
    slug = `${baseSlug}-${suffix}`;
  }
  const serializedProgram = JSON.stringify(event.program);
  const serializedColors = JSON.stringify(event.stageColors);
  const changedBy = editorLabel(editor);
  try {
    await sql`
      INSERT INTO events (event_key, slug, name, venue, starts_on, ends_on, timezone, status, logo_url, program, stage_colors)
      VALUES (${slug}, ${slug}, ${event.name}, ${event.venue}, ${event.startsOn}::date, ${event.endsOn}::date,
              ${event.timezone}, ${event.status}, ${event.logoUrl}, ${serializedProgram}::jsonb, ${serializedColors}::jsonb)
    `;
    await sql`
      INSERT INTO event_states (event_key, state, revision, updated_at, updated_by)
      VALUES (${slug}, '{"photographers":[],"assignments":{}}'::jsonb, 1, NOW(), ${changedBy})
    `;
    await sql`
      INSERT INTO event_members (event_key, email, role, added_by)
      VALUES (${slug}, ${editor.email}, 'owner', ${changedBy})
      ON CONFLICT (event_key, email) DO UPDATE SET role = 'owner'
    `;
    return json({ ok: true, slug }, 201);
  } catch (error) {
    console.error("Event creation failed", error);
    return json({ error: "Kunne ikke opprette eventet." }, 500);
  }
}
