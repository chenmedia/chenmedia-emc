import Link from "next/link";
import { redirect } from "next/navigation";
import EmailPasswordAuthForm from "@/components/email-password-auth-form";
import { signOut } from "../actions";
import { authConfigured, editorAccessConfigured, getAuthUser, hasEditorAccess } from "@/lib/auth";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: Props) {
  const [{ error }, user] = await Promise.all([searchParams, getAuthUser()]);
  if (hasEditorAccess(user)) redirect("/");

  const configured = authConfigured();
  const accessConfigured = editorAccessConfigured();

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Logg inn til EMC</h1>
        <p>Tilgangen styres av rollen din. Administratorer administrerer eventer og tilgang, redaktører oppdaterer planer, og seere har lesetilgang.</p>

        {!configured && <p className="auth-message auth-message--error" role="alert">Neon Auth mangler nødvendig konfigurasjon.</p>}
        {configured && !accessConfigured && <p className="auth-message auth-message--error" role="alert">Ingen administratorer er konfigurert ennå.</p>}
        {error === "oauth" && <p className="auth-message auth-message--error" role="alert">Google-innlogging er slått av. Bruk e-post og passord nedenfor.</p>}

        {user ? <div className="auth-identity">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
          <p>Denne kontoen har ingen global administratorrolle. Hvis du er invitert til et event, åpner du eventlenken du har mottatt.</p>
          <form action={signOut}><button className="ui-button ui-button--outline" type="submit">Logg ut</button></form>
        </div> : configured && accessConfigured ? <EmailPasswordAuthForm /> : null}

        <Link href="/events">Til eventoversikten</Link>
      </section>
    </main>
  );
}
