import { editorLabel } from "@/lib/auth";
import { cleanEventInput, slugify } from "@/lib/event-admin";
import { createShareToken, ensureEventAccessSchema, getEventAccess } from "@/lib/event-access";
import { getEventBySlug } from "@/lib/events";
import { getDatabase } from "@/lib/neon";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ eventSlug: string }> };
type ActionBody = Record<string, unknown> & { action?: string };
const roleValues = new Set(["owner", "editor", "viewer"]);

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: RouteContext) {
  const event = await getEventBySlug((await context.params).eventSlug);
  if (!event) return json({ error: "Fant ikke eventet." }, 404);
  const access = await getEventAccess(event.eventKey);
  if (!access.user || !access.canEdit) return json({ error: "Du har ikke redigeringstilgang til dette eventet." }, 403);
  let body: ActionBody;
  try { body = await request.json() as ActionBody; } catch { return json({ error: "Ugyldig forespørsel." }, 400); }
  await ensureEventAccessSchema();
  const sql = getDatabase();
  const changedBy = editorLabel(access.user);

  if (body.action === "update") {
    const cleaned = cleanEventInput(body.event);
    if (!cleaned) return json({ error: "Kontroller event- og programdataene." }, 400);
    const serializedProgram = JSON.stringify(cleaned.program);
    const serializedColors = JSON.stringify(cleaned.stageColors);
    await sql`
      UPDATE events SET name = ${cleaned.name}, venue = ${cleaned.venue}, starts_on = ${cleaned.startsOn}::date,
        ends_on = ${cleaned.endsOn}::date, timezone = ${cleaned.timezone}, status = ${cleaned.status},
        logo_url = ${cleaned.logoUrl}, program = ${serializedProgram}::jsonb, stage_colors = ${serializedColors}::jsonb,
        updated_at = NOW()
      WHERE event_key = ${event.eventKey}
    `;
    return json({ ok: true });
  }

  if (body.action === "clone") {
    if (!access.canManage) return json({ error: "Bare eventeier kan duplisere eventet." }, 403);
    const requestedName = typeof body.name === "string" ? body.name.trim().slice(0, 160) : `${event.name} – kopi`;
    const baseSlug = slugify(requestedName) || `${event.slug}-kopi`;
    let slug = baseSlug;
    for (let suffix = 2; suffix < 100; suffix += 1) {
      const [existing] = await sql`SELECT 1 FROM events WHERE slug = ${slug} LIMIT 1` as Array<Record<string, unknown>>;
      if (!existing) break;
      slug = `${baseSlug}-${suffix}`;
    }
    await sql`
      INSERT INTO events (event_key, slug, name, venue, starts_on, ends_on, timezone, status, logo_url, program, stage_colors)
      VALUES (${slug}, ${slug}, ${requestedName}, ${event.venue}, ${event.startsOn}::date, ${event.endsOn}::date,
              ${event.timezone}, 'draft', ${event.logoUrl}, ${JSON.stringify(event.program)}::jsonb, ${JSON.stringify(event.stageColors)}::jsonb)
    `;
    await sql`INSERT INTO event_states (event_key, state, revision, updated_by) VALUES (${slug}, '{"photographers":[],"assignments":{}}'::jsonb, 1, ${changedBy})`;
    await sql`INSERT INTO event_members (event_key, email, role, added_by) VALUES (${slug}, ${access.user.email}, 'owner', ${changedBy})`;
    return json({ ok: true, slug }, 201);
  }

  if (body.action === "member") {
    if (!access.canManage) return json({ error: "Bare eventeier kan administrere tilgang." }, 403);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
    const role = typeof body.role === "string" && roleValues.has(body.role) ? body.role : "viewer";
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Skriv inn en gyldig e-postadresse." }, 400);
    await sql`
      INSERT INTO event_members (event_key, email, role, added_by)
      VALUES (${event.eventKey}, ${email}, ${role}, ${changedBy})
      ON CONFLICT (event_key, email) DO UPDATE SET role = EXCLUDED.role, added_by = EXCLUDED.added_by
    `;
    return json({ ok: true });
  }

  if (body.action === "remove-member") {
    if (!access.canManage) return json({ error: "Bare eventeier kan administrere tilgang." }, 403);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email === access.user.email.toLowerCase()) return json({ error: "Du kan ikke fjerne din egen eiertilgang." }, 400);
    await sql`DELETE FROM event_members WHERE event_key = ${event.eventKey} AND LOWER(email) = ${email}`;
    return json({ ok: true });
  }

  if (body.action === "share") {
    const photographerId = typeof body.photographerId === "string" ? body.photographerId.slice(0, 100) : "";
    const [stateRow] = await sql`SELECT state FROM event_states WHERE event_key = ${event.eventKey}` as Array<{ state: { photographers?: Array<{ id: string; name: string }> } }>;
    const photographer = stateRow?.state.photographers?.find((person) => person.id === photographerId);
    if (!photographer) return json({ error: "Fant ikke fotografen." }, 404);
    const token = createShareToken();
    const [share] = await sql`
      INSERT INTO event_shares (token, event_key, photographer_id, photographer_name, created_by)
      VALUES (${token}, ${event.eventKey}, ${photographer.id}, ${photographer.name}, ${changedBy})
      ON CONFLICT (event_key, photographer_id) DO UPDATE SET enabled = TRUE, photographer_name = EXCLUDED.photographer_name
      RETURNING token
    ` as Array<{ token: string }>;
    return json({ ok: true, token: share.token }, 201);
  }

  if (body.action === "revoke-share") {
    const token = typeof body.token === "string" ? body.token : "";
    await sql`UPDATE event_shares SET enabled = FALSE WHERE token = ${token} AND event_key = ${event.eventKey}`;
    return json({ ok: true });
  }

  return json({ error: "Ukjent handling." }, 400);
}
