import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { authConfigured, isEditor } from "@/lib/auth";

export default async function AuthControl() {
  if (!authConfigured()) return null;

  if (await isEditor()) {
    return (
      <form action={signOut}>
        <button className="ui-button ui-button--ghost ui-button--small" type="submit">Logg ut</button>
      </form>
    );
  }

  return <Link className="ui-button ui-button--ghost ui-button--small" href="/auth/sign-in">Redaktørinnlogging</Link>;
}
