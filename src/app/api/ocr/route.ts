import { connection } from "next/server";
import { allowOcr } from "@/lib/db/accounts";
import { crossOriginResponse } from "@/lib/origin";
import { handleOcrPost } from "@/lib/ocr/handle";
import { describeTesseract, recognizeImageBytes } from "@/lib/ocr/tesseract";
import { currentUser } from "@/lib/session";

export async function GET() {
  await connection();
  const user = await currentUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  return Response.json(await describeTesseract(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  await connection();
  const blocked = crossOriginResponse(request);
  if (blocked) return blocked;
  const user = await currentUser();
  if (user && !(await allowOcr(user.id))) return Response.json({ error: "识别太频繁，请稍后再试。这次不扣点。" }, { status: 429 });
  return handleOcrPost(request, user, recognizeImageBytes);
}
