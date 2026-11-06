import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { authConfigured, getAuthUser, hasEditorAccess } from "@/lib/auth";

export default async function AuthControl() {
  if (!authConfigured()) return null;

  const user = await getAuthUser();
  if (user) {
    const administrator = hasEditorAccess(user);
    return <div className="auth-control">
      <span><small>{administrator ? "Administrator" : "Tilgang etter rolle"}</small>{user.name}</span>
      <form action={signOut}>
        <button className="ui-button ui-button--ghost ui-button--small" type="submit">Logg ut</button>
      </form>
    </div>;
  }

  return <Link className="ui-button ui-button--ghost ui-button--small" href="/auth/sign-in">Logg inn</Link>;
}
