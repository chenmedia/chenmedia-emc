"use server";

import { redirect } from "next/navigation";
import { getNeonAuth } from "@/lib/auth";

export async function signOut() {
  const auth = getNeonAuth();
  if (auth) await auth.signOut();
  redirect("/");
}
