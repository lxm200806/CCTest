import { cookies } from "next/headers";
import { crossOriginResponse } from "@/lib/origin";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { login } from "@/lib/store";

export async function POST(request: Request) {
  const blocked = crossOriginResponse(request);
  if (blocked) return blocked;
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password) return Response.json({ error: "请填写账号和密码" }, { status: 400 });
  const result = await login(username, password);
  if (!result) return Response.json({ error: "账号或密码不对" }, { status: 401 });
  if ("error" in result) return Response.json({ error: result.error }, { status: 429 });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, result.token, sessionCookieOptions());
  return Response.json({ user: result.user });
}
