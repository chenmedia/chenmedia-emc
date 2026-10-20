import Link from "next/link";
import { redirect } from "next/navigation";
import GoogleSignInButton from "@/components/google-sign-in-button";
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
        <p className="eyebrow">EMC · SIKKER TILGANG</p>
        <h1>Logg inn som redaktør</h1>
        <p>Bruk Google-kontoen din. Bare forhåndsgodkjente e-postadresser får redigere den delte planen.</p>

        {!configured && <p className="auth-message auth-message--error" role="alert">Neon Auth mangler nødvendig konfigurasjon.</p>}
        {configured && !accessConfigured && <p className="auth-message auth-message--error" role="alert">Ingen redaktøradresser er konfigurert ennå.</p>}
        {error === "oauth" && <p className="auth-message auth-message--error" role="alert">Google-innloggingen ble avbrutt eller mislyktes. Prøv igjen.</p>}

        {user ? <div className="auth-identity">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
          <p>Denne Google-kontoen har kun lesetilgang. Logg ut og prøv en godkjent redaktørkonto.</p>
          <form action={signOut}><button className="ui-button ui-button--outline" type="submit">Logg ut</button></form>
        </div> : configured && accessConfigured ? <div className="auth-form"><GoogleSignInButton /></div> : null}

        <Link href="/">Tilbake til planen</Link>
      </section>
    </main>
  );
}
