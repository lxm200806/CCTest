import { cookies } from "next/headers";
import { currentToken, SESSION_COOKIE } from "@/lib/session";
import { logout } from "@/lib/store";

export async function POST() {
  const token = await currentToken();
  if (token) await logout(token);
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
