"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authConfigured,
  createSessionToken,
  passwordIsValid,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";

export async function signIn(formData: FormData) {
  if (!authConfigured()) redirect("/auth/sign-in?error=not-configured");

  const password = String(formData.get("password") ?? "");
  if (!passwordIsValid(password)) redirect("/auth/sign-in?error=invalid");

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions);
  redirect("/");
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  redirect("/");
}
