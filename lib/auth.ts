import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";

export type EmcUser = {
  id: string;
  name: string;
  email: string;
};

let authInstance: ReturnType<typeof createNeonAuth> | null = null;

function cookieSecret() {
  return process.env.NEON_AUTH_COOKIE_SECRET || process.env.EMC_SESSION_SECRET || "";
}

export function authConfigured() {
  return Boolean(process.env.NEON_AUTH_BASE_URL && cookieSecret().length >= 32);
}

export function editorAccessConfigured() {
  return allowedEditorEmails().size > 0;
}

export function getNeonAuth() {
  if (!authConfigured()) return null;
  if (!authInstance) {
    authInstance = createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL!,
      cookies: { secret: cookieSecret() },
    });
  }
  return authInstance;
}

function allowedEditorEmails() {
  return new Set(
    (process.env.EMC_EDITOR_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function hasEditorAccess(user: EmcUser | null) {
  return Boolean(user && allowedEditorEmails().has(user.email.toLowerCase()));
}

export async function getAuthUser(): Promise<EmcUser | null> {
  const auth = getNeonAuth();
  if (!auth) return null;

  try {
    const { data: session } = await auth.getSession();
    const user = session?.user;
    if (!user || typeof user.id !== "string" || typeof user.email !== "string") return null;
    return {
      id: user.id,
      name: typeof user.name === "string" && user.name.trim() ? user.name.trim() : user.email,
      email: user.email.trim().toLowerCase(),
    };
  } catch (error) {
    console.error("Neon Auth session lookup failed", error);
    return null;
  }
}

export async function getEditor() {
  const user = await getAuthUser();
  return hasEditorAccess(user) ? user : null;
}

export async function isEditor() {
  return Boolean(await getEditor());
}

export function editorLabel(user: EmcUser) {
  return `${user.name} (${user.email})`;
}
