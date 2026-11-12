import "server-only";

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OCR_SETUP, OcrError, inspectImage, type ImageKind } from "@/lib/ocr/image";

const TIMEOUT_MS = 20_000;
const MAX_OUTPUT = 200_000;

export type OcrEngineStatus = {
  available: boolean;
  version: string | null;
  languages: string[];
  detail: string;
};

export async function describeTesseract(): Promise<OcrEngineStatus> {
  try {
    const versionText = await run(["--version"], 5_000);
    const langsText = await run(["--list-langs"], 5_000);
    const version = versionText.split(/\r?\n/).find((line) => line.startsWith("tesseract "))?.trim() ?? null;
    const languages = langsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[a-z][a-z0-9_+]+$/i.test(line));
    const ready = languages.includes("chi_sim") && languages.includes("eng");
    return {
      available: ready,
      version,
      languages,
      detail: ready
        ? `${version ?? "Tesseract"} 已就绪，语言有 chi_sim 和 eng。只适合印刷体；手写和公式可能不准。识别不扣点，确认写入后才参与生成。`
        : `已找到 Tesseract，但缺少 chi_sim 或 eng。${OCR_SETUP}`,
    };
  } catch {
    return { available: false, version: null, languages: [], detail: OCR_SETUP };
  }
}

export async function recognizeImageBytes(bytes: Buffer, declaredType: string, signal?: AbortSignal) {
  if (signal?.aborted) throw new OcrError("识别已取消。这次不扣点。", 499);
  const status = await describeTesseract();
  if (signal?.aborted) throw new OcrError("识别已取消。这次不扣点。", 499);
  if (!status.available) throw new OcrError(status.detail, 503);
  const image = inspectImage(bytes, declaredType);
  if (signal?.aborted) throw new OcrError("识别已取消。这次不扣点。", 499);
  const text = await runOnImage(bytes, image.kind, signal);
  const trimmed = text.replace(/\u0000/g, "").trim();
  if (!trimmed) {
    return { text: "", warning: "没有识别出文字。空白或对比度太低时会这样。请换一张更清晰的印刷体图片。这次不扣点。" };
  }
  if (trimmed.length > 8000) {
    return { text: trimmed.slice(0, 8000), warning: "识别结果超过 8000 字，只保留前面一部分。请核对。这次不扣点。" };
  }
  return { text: trimmed, warning: "" };
}

async function runOnImage(bytes: Buffer, kind: ImageKind, signal?: AbortSignal) {
  const dir = await mkdtemp(join(tmpdir(), "sw-ocr-"));
  const extension = kind === "jpeg" ? "jpg" : kind;
  const imagePath = join(dir, `page.${extension}`);
  try {
    await writeFile(imagePath, bytes, { mode: 0o600 });
    return await run([imagePath, "stdout", "-l", "chi_sim+eng", "--oem", "1", "--psm", "6"], TIMEOUT_MS, signal);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function run(args: string[], timeoutMs: number, signal?: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new OcrError("识别已取消。这次不扣点。", 499));
      return;
    }
    const child = spawn("tesseract", args, {
      env: tesseractEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = Buffer.alloc(0);
    let settled = false;
    const finish = (error: Error | null, value = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new OcrError("识别超时，已停止。这次不扣点。", 504));
    }, timeoutMs);
    const abort = () => {
      child.kill("SIGKILL");
      finish(new OcrError("识别已取消。这次不扣点。", 499));
    };
    signal?.addEventListener("abort", abort, { once: true });
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = Buffer.concat([stdout, chunk]);
      if (stdout.length > MAX_OUTPUT) {
        child.kill("SIGKILL");
        finish(new OcrError("识别输出过长，已停止。这次不扣点。", 413));
      }
    });
    child.stderr?.on("data", () => undefined);
    child.on("error", () => finish(new OcrError(OCR_SETUP, 503)));
    child.on("close", (code) => {
      if (settled) return;
      if (code === 0) finish(null, stdout.toString("utf8"));
      else finish(new OcrError("Tesseract 识别失败。这次不扣点。", 502));
    });
  });
}

function tesseractEnv() {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? "",
    LANG: "C.UTF-8",
    OMP_THREAD_LIMIT: "1",
    NODE_ENV: process.env.NODE_ENV,
  };
  if (process.env.TESSDATA_PREFIX) env.TESSDATA_PREFIX = process.env.TESSDATA_PREFIX;
  return env;
}
