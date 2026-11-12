"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { OCR_MAX_BYTES, isImagePayload } from "@/lib/ocr/image";

type EngineStatus = { available: boolean; detail: string };
type OcrEvent = { stage: "recognize" } | { stage: "done"; text: string; warning: string } | { stage: "error"; error: string };

export function OcrPanel({
  file,
  previewUrl,
  targets,
  disabled,
  onRemove,
  onPlace,
}: {
  file: File;
  previewUrl: string;
  targets: { name: string; label: string }[];
  disabled: boolean;
  onRemove: () => void;
  onPlace: (field: string, text: string) => string;
}) {
  const [engine, setEngine] = useState<EngineStatus | null>(null);
  const [phase, setPhase] = useState<"idle" | "checking" | "recognizing" | "ready" | "failed">("idle");
  const [status, setStatus] = useState("");
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ocr", { cache: "no-store", signal: controller.signal })
      .then(async (response) => (await response.json()) as EngineStatus & { error?: string })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setEngine({ available: Boolean(payload.available), detail: payload.detail || payload.error || "没有识别到本机 OCR。" });
      })
      .catch(() => {
        if (!controller.signal.aborted) setEngine({ available: false, detail: "没有连上识别服务。这次不扣点。" });
      });
    return () => controller.abort();
  }, []);

  async function recognize() {
    if (file.size > OCR_MAX_BYTES) {
      setPhase("failed");
      setStatus("图片超过 4MB，没有开始识别。这次不扣点。");
      return;
    }
    setPhase("checking");
    setStatus("正在检查文件类型和大小。");
    setNotice("");
    setText("");
    const body = new FormData();
    body.set("image", file);
    try {
      const response = await fetch("/api/ocr", { method: "POST", body });
      const type = response.headers.get("content-type") ?? "";
      if (type.includes("application/json")) {
        const payload = (await response.json()) as { error?: string };
        setPhase("failed");
        setStatus(payload.error || "识别失败。这次不扣点。");
        return;
      }
      await readEvents(response, (event) => {
        if (event.stage === "recognize") {
          setPhase("recognizing");
          setStatus("正在用本机 Tesseract 识别。这一步没有百分比。");
        }
        if (event.stage === "error") {
          setPhase("failed");
          setStatus(event.error);
        }
        if (event.stage === "done") {
          setText(event.text);
          setNotice(event.warning);
          setPhase("ready");
          setStatus(event.text.trim() ? "识别完成。请核对，确认后才会写入题目或作答。" : "没有识别出可写入的文字。");
        }
      });
    } catch {
      setPhase("failed");
      setStatus("识别请求中断。这次不扣点。");
    }
  }

  function place(field: string, label: string) {
    const message = onPlace(field, text);
    setNotice(message || `已写入${label}。生成时才会扣点。`);
  }

  const busy = phase === "checking" || phase === "recognizing";

  return (
    <div id="ocr-panel" className="space-y-3 rounded-xl border border-border bg-background p-3">
      <p className="text-sm leading-6 text-muted-foreground">
        印刷体中文和英文用本机 Tesseract 识别，不把图片发给模型，也不扣点。手写和公式可能不准。确认写入之前不会批改。
      </p>
      {/* Blob preview stays in the browser; the image optimizer would copy it elsewhere. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={previewUrl} alt="待识别图片预览" className="max-h-60 w-full rounded-lg border border-border object-contain" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11 min-h-11" disabled={disabled || busy || engine?.available === false} onClick={() => void recognize()}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          识别图中的文字
        </Button>
        <Button type="button" variant="outline" className="h-11 min-h-11" disabled={disabled || busy} onClick={onRemove}>
          移除图片
        </Button>
      </div>
      {engine && !engine.available ? <p className="text-sm leading-6 text-clay">{engine.detail}</p> : null}
      {status ? (
        <p className="text-sm leading-6" role="status" aria-live="polite" aria-busy={busy}>
          {status}
        </p>
      ) : null}
      {phase === "ready" || text ? (
        <div className="space-y-2">
          <label htmlFor="ocr-text" className="text-sm font-medium">
            识别结果，可修改
          </label>
          <Textarea id="ocr-text" className="min-h-28 text-base md:text-base" value={text} onChange={(event) => setText(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            {targets.map((target) => (
              <Button
                key={target.name}
                type="button"
                variant="outline"
                className="h-11 min-h-11"
                disabled={disabled || !text.trim() || isImagePayload(text)}
                onClick={() => place(target.name, target.label)}
              >
                写入{target.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      {notice ? <p className="text-sm leading-6 text-muted-foreground">{notice}</p> : null}
    </div>
  );
}

async function readEvents(response: Response, onEvent: (event: OcrEvent) => void) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as OcrEvent);
    }
  }
}
