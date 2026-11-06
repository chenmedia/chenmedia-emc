"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

export default function EmailPasswordAuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setPassword("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = mode === "sign-in"
        ? await authClient.signIn.email({ email: normalizedEmail, password })
        : await authClient.signUp.email({ email: normalizedEmail, password, name: name.trim() });

      if (result.error) {
        setError(mode === "sign-in"
          ? "E-post eller passord er feil. Kontroller opplysningene og prøv igjen."
          : result.error.message || "Kontoen kunne ikke opprettes. Kontroller opplysningene og prøv igjen.");
        setPending(false);
        return;
      }

      router.push("/events");
      router.refresh();
    } catch (cause) {
      console.error(cause);
      setError("Innloggingstjenesten svarer ikke akkurat nå. Prøv igjen om litt.");
      setPending(false);
    }
  }

  return <div className="email-auth">
    <div className="email-auth__modes" role="group" aria-label="Velg innloggingsmåte">
      <button type="button" className={mode === "sign-in" ? "is-active" : ""} aria-pressed={mode === "sign-in"} onClick={() => changeMode("sign-in")}>Logg inn</button>
      <button type="button" className={mode === "sign-up" ? "is-active" : ""} aria-pressed={mode === "sign-up"} onClick={() => changeMode("sign-up")}>Opprett konto</button>
    </div>

    <form className="auth-form email-auth__form" onSubmit={(event) => void submit(event)}>
      {mode === "sign-up" && <label>
        Navn
        <input type="text" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
      </label>}
      <label>
        E-post
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" required />
      </label>
      <label>
        Passord
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required />
        {mode === "sign-up" && <span>Minst 8 tegn.</span>}
      </label>

      {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}

      <button className="ui-button ui-button--primary email-auth__submit" type="submit" disabled={pending}>
        {pending ? "Vent litt …" : mode === "sign-in" ? "Logg inn" : "Opprett konto"}
      </button>
    </form>

    <p className="email-auth__note">Bruk e-postadressen du har fått tilgang med. Rollen din blir hentet automatisk etter innlogging.</p>
  </div>;
}
