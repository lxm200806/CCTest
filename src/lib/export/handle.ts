import { buildDocx } from "@/lib/export/docx";
import { ownedGeneration } from "@/lib/export/owned";
import { buildPptx } from "@/lib/export/pptx";
import { contentDisposition } from "@/lib/export/text";
import type { GenerationRecord, PublicUser } from "@/lib/types";

const MIME = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export async function handleExport(options: {
  user: PublicUser | null;
  format: string;
  generationId: string;
  find: (userId: string, generationId: string) => GenerationRecord | null;
}) {
  if (!options.user?.id?.trim()) return json({ error: "请先登录" }, 401);
  const format = options.format === "pptx" || options.format === "docx" ? options.format : "";
  if (!format) return json({ error: "只能下载 PPTX 或 DOCX。这次不扣点。" }, 400);
  if (!options.generationId.trim()) return json({ error: "缺少要下载的结果。这次不扣点。" }, 400);
  const record = options.find(options.user.id, options.generationId);
  if (!record) return json({ error: "没有找到这次生成，或它不属于当前账号。这次不扣点。" }, 404);
  const expected = format === "pptx" ? "ai-ppt" : "ai-word";
  if (record.toolId !== expected) return json({ error: format === "pptx" ? "只有 AIPPT 的结果可以下载 PPTX。这次不扣点。" : "只有 AIWORD 的结果可以下载 DOCX。这次不扣点。" }, 400);
  const body = format === "pptx" ? await buildPptx(record.result) : await buildDocx(record.result);
  const filename = contentDisposition(format, record.result.title);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": MIME[format],
      "Content-Disposition": filename,
      "Cache-Control": "no-store",
      "X-Export-Charged": "0",
    },
  });
}

export function findOwned(records: GenerationRecord[], userId: string, generationId: string) {
  return ownedGeneration(records, userId, generationId);
}

function json(data: unknown, status: number) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
