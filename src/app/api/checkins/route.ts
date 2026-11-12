import { crossOriginResponse } from "@/lib/origin";
import { currentUser } from "@/lib/session";
import { checkinsFor, setCheckin, studentFor } from "@/lib/store";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const student = await studentFor(user.id);
  if (!student) return Response.json({ error: "没有学生档案" }, { status: 404 });
  return Response.json({ student, checkins: await checkinsFor(user.id), readonly: false });
}

export async function POST(request: Request) {
  const blocked = crossOriginResponse(request);
  if (blocked) return blocked;
  const user = await currentUser();
  if (!user) return Response.json({ error: "登录后才能改打卡" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { date?: unknown; step?: unknown; done?: unknown } | null;
  const date = typeof body?.date === "string" ? body.date : "";
  const step = typeof body?.step === "number" ? body.step : Number(body?.step);
  const result = await setCheckin(user.id, date, step, Boolean(body?.done));
  if ("error" in result) return Response.json(result, { status: 400 });
  return Response.json({ ok: true, checkins: await checkinsFor(user.id) });
}
