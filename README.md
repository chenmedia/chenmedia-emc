# Eventphoto Mission Control — EMC

Eventphoto Mission Control for Oslo Proptech Summit 2026.

EMC gir fotoleder en samlet programoversikt med scene-, partner- og
kundeprioritetsfiltre, teamregister, tildelinger ved start/slutt/hele
programposten, konfliktvarsling, autofordeling og PDF-/CSV-eksport.

Applikasjonen er klargjort for Next.js på Vercel med Neon Postgres og
passordbeskyttet redaktørtilgang. Se [VERCEL_NEON.md](./VERCEL_NEON.md).

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
