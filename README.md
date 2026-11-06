# Event Mission Control — EMC

Event Mission Control for planning event photography teams across conferences and live productions.

EMC gir fotoleder en samlet programoversikt med scene-, partner- og
kundeprioritetsfiltre, teamregister, tildelinger ved start/slutt/hele
programposten, konfliktvarsling, autofordeling og PDF-/CSV-eksport.

Produksjonsflyten støtter nå flere eventer med veiviser og CSV/TSV-import,
eventspesifikke roller, sikker konfliktløsning ved samtidig redigering,
duplisering og arkivering, samt private mobilplaner for fotografer med
endringer siden sist de åpnet lenken.

Applikasjonen er klargjort for Next.js på Vercel med Neon Postgres og
Google-basert redaktørtilgang med Neon Auth. Se [VERCEL_NEON.md](./VERCEL_NEON.md).

Fotografer og tildelinger lagres i en sentral Neon-database. Nettleserens
lokale lagring brukes bare som cache.

## Lokal utvikling

- `pnpm install`
- kopier `.env.example` til `.env.local` og fyll inn verdiene
- `pnpm db:migrate` for å opprette skjemaet og overføre den eksisterende planen
- `pnpm dev`
- `pnpm build`

Databaseskjemaet ligger i `neon/schema.sql`. Den lokale, ignorerte
migreringskopien ligger i `neon/seed-oslo-proptech-2026.json`, og API-et for
den delte planen ligger i `app/api/state/route.ts`.

Eventspesifikke endepunkter ligger under `app/api/events`. Nye eventer opprettes
fra `/events/new`, administreres fra `/events/[eventSlug]/settings`, og private
fotograflenker åpnes fra `/share/[token]`.
