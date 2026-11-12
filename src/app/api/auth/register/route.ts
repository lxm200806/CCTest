import { cookies } from "next/headers";
import { crossOriginResponse } from "@/lib/origin";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { register } from "@/lib/store";

export async function POST(request: Request) {
  const blocked = crossOriginResponse(request);
  if (blocked) return blocked;
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown; displayName?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName : "";
  const result = await register(username, password, displayName);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.error === "请使用邀请账号" ? 403 : 400 });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, result.token, sessionCookieOptions());
  return Response.json({ user: result.user });
}
