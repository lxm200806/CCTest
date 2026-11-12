import { OCR_MAX_BYTES, OcrError, inspectImage } from "@/lib/ocr/image";
import type { PublicUser } from "@/lib/types";

export type OcrOutcome = { text: string; warning: string };
export type OcrEvent = { stage: "recognize" } | { stage: "done"; text: string; warning: string } | { stage: "error"; error: string };

const inflight = new Set<string>();

export function resetOcrLock() {
  inflight.clear();
}

export async function handleOcrPost(
  request: Request,
  user: PublicUser | null,
  recognize: (bytes: Buffer, declaredType: string, signal: AbortSignal) => Promise<OcrOutcome>,
) {
  if (!user) return json({ error: "请先登录" }, 401);
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > OCR_MAX_BYTES + 256 * 1024) {
    return json({ error: "上传超过大小限制。这次不扣点。" }, 413);
  }
  if (inflight.has(user.id)) return json({ error: "上一次识别还没结束。这次不扣点。" }, 409);
  inflight.add(user.id);
  try {
    const file = await readImage(request);
    inspectImage(file.bytes, file.type);
    return streamRecognition(user.id, file, request.signal, recognize);
  } catch (error) {
    inflight.delete(user.id);
    const message = error instanceof Error && error.message ? error.message : "识别失败。这次不扣点。";
    const status = error instanceof OcrError ? error.status : 400;
    return json({ error: message.includes("不扣点") ? message : `${message}这次不扣点。` }, status);
  }
}

function streamRecognition(
  userId: string,
  file: { bytes: Buffer; type: string },
  signal: AbortSignal,
  recognize: (bytes: Buffer, declaredType: string, signal: AbortSignal) => Promise<OcrOutcome>,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: OcrEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        send({ stage: "recognize" });
        const outcome = await recognize(file.bytes, file.type, signal);
        send({ stage: "done", text: outcome.text, warning: outcome.warning });
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : "识别失败。这次不扣点。";
        send({ stage: "error", error: message.includes("不扣点") ? message : `${message}这次不扣点。` });
      } finally {
        inflight.delete(userId);
        controller.close();
      }
    },
    cancel() {
      inflight.delete(userId);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function readImage(request: Request) {
  const header = request.headers.get("content-type") ?? "";
  if (!header.toLowerCase().includes("multipart/form-data")) {
    throw new OcrError("请用表单上传图片。网址不会被读取。这次不扣点。");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new OcrError("没有上传内容。这次不扣点。");
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > OCR_MAX_BYTES + 256 * 1024) {
      await reader.cancel();
      throw new OcrError("上传超过大小限制。这次不扣点。", 413);
    }
    chunks.push(value);
  }
  const form = await new Request("http://local/ocr", {
    method: "POST",
    body: Buffer.concat(chunks),
    headers: { "Content-Type": header },
  }).formData();
  const file = form.get("image");
  if (!(file instanceof File)) throw new OcrError("请上传一张图片。网址不会被读取。这次不扣点。");
  return { bytes: Buffer.from(await file.arrayBuffer()), type: file.type };
}

function json(data: unknown, status: number) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
