"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function GoogleSignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setPending(true);
    setError("");
    try {
      const origin = window.location.origin;
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: `${origin}/auth/sign-in`,
        errorCallbackURL: `${origin}/auth/sign-in?error=oauth`,
      });
      if (result.error) {
        setError(result.error.message || "Google-innloggingen kunne ikke startes.");
        setPending(false);
      }
    } catch (cause) {
      console.error(cause);
      setError("Google-innloggingen kunne ikke startes. Prøv igjen.");
      setPending(false);
    }
  }

  return <>
    <button className="google-sign-in" type="button" onClick={() => void signIn()} disabled={pending}>
      <span className="google-sign-in__mark" aria-hidden="true">G</span>
      {pending ? "Åpner Google …" : "Fortsett med Google"}
    </button>
    {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
  </>;
}
