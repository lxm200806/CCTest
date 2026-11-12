import "server-only";

import { cookies } from "next/headers";
import { findUserByToken } from "@/lib/store";

export const SESSION_COOKIE = "sw_session";

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    secure: process.env.COOKIE_SECURE === "1",
  };
}

export async function currentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findUserByToken(token);
}

export async function currentToken() {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}
