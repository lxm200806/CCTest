import { connection } from "next/server";
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
  const user = await currentUser();
  return handleOcrPost(request, user, recognizeImageBytes);
}
