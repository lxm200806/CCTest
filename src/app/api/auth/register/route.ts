import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionCookie } from "@/lib/session";
import { register } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown; displayName?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName : "";
  const result = await register(username, password, displayName);
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, result.token, sessionCookie);
  return Response.json({ user: result.user });
}
