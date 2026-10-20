# Flytt EMC til Vercel og Neon

Prosjektet er en vanlig Next.js-app. Vercel bygger den fra GitHub, mens den
delte planen lagres i Neon. Offentlige besøkende kan lese planen uten
telefonnumre; redaktøren logger inn med et passord som lagres sikkert som en
HttpOnly-signert sesjon.

## 1. Koble GitHub til Vercel

Koble GitHub-repositoriet chenmedia-EMC til Vercel-prosjektet chenmedia-EMC.
Sett Root Directory til photo-team-planner dersom repositoriet inneholder hele
ChatGPT-prosjektmappen; la den stå tom dersom innholdet i denne mappen ligger i
roten av repositoriet.

Vercel skal oppdage Next.js automatisk. Build-kommandoen er pnpm build.

## 2. Kontroller Neon-integrasjonen

Neon-integrasjonen i Vercel skal ha opprettet DATABASE_URL for Production,
Preview og Development. Ikke legg databasepassord i Git.

## 3. Legg til redaktørhemmeligheter

Opprett disse krypterte Environment Variables i Vercel:

- EMC_EDITOR_PASSWORD: et langt, unikt passord du bruker på /auth/sign-in.
- EMC_SESSION_SECRET: minst 32 tilfeldige tegn, kun brukt til å signere
  innloggingssesjonen.

## 4. Overfør eksisterende data

Hent Vercel-variablene lokalt til .env.local, last dem inn i skallet og kjør:

    pnpm db:migrate

Den lokale migreringskopien er Git-ignorert fordi den inneholder persondata.
Skriptet oppretter tabellen og legger inn revisjon 37 med 3 fotografer og
36 tildelinger. Det overskriver ikke en eksisterende Neon-plan. --force finnes
for en eksplisitt gjenoppretting:

    pnpm db:migrate -- --force

## 5. Deploy og verifiser

Etter deploy:

1. Åpne /api/state uten innlogging og kontroller revision: 37, tre fotografer
   og 36 tildelinger.
2. Kontroller at offentlige telefonnumre er tomme.
3. Logg inn på /auth/sign-in, endre én tildeling og last siden på nytt.
4. Kontroller at revisjonen øker og at endringen vises på en annen enhet.
