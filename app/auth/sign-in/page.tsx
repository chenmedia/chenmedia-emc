import Link from "next/link";
import { signIn } from "../actions";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignInPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const message = error === "invalid"
    ? "Feil redaktørpassord. Prøv igjen."
    : error === "not-configured"
      ? "Redaktørtilgang er ikke konfigurert ennå."
      : "";

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">EMC · SIKKER TILGANG</p>
        <h1>Logg inn som redaktør</h1>
        <p>Bruk redaktørpassordet for å endre den delte planen.</p>
        {message && <p className="auth-message" role="alert">{message}</p>}
        <form action={signIn} className="auth-form">
          <label htmlFor="password">Redaktørpassord</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
          <button className="ui-button ui-button--primary" type="submit">Logg inn</button>
        </form>
        <Link href="/">Tilbake til planen</Link>
      </section>
    </main>
  );
}
