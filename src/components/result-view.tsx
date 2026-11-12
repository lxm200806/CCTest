"use client";

import { useState } from "react";
import { Copy, Download, FileJson, FileText, Presentation, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadName, sourceLabel, toHtmlDocument, toMarkdown } from "@/lib/format";
import { MOCK_NOTICE } from "@/lib/ai/notice";
import { formatStamp } from "@/lib/dates";
import { showBlanks } from "@/lib/export/text";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import type { PublicGeneration } from "@/lib/types";

function emptyExportCopy(kind: "pptx" | "docx" | null) {
  if (kind === "pptx") return "生成后可以下载 PPTX，也可以打印 HTML。公式按文字放进幻灯片，不是公式对象。下载不另扣点。";
  if (kind === "docx") return "生成后可以下载 DOCX，也可以打印 HTML。公式按普通文字写入。下载不另扣点。";
  return "可以复制 Markdown，或下载 Markdown、JSON、HTML。打印使用 HTML。";
}

function exportCopy(kind: "pptx" | "docx" | null) {
  if (kind === "pptx") return "PPTX 来自这次已保存的分页讲稿，下载不调用模型，也不扣点。公式按文字写入。打印和 HTML 仍然可用。";
  if (kind === "docx") return "DOCX 来自这次已保存的文稿，下载不调用模型，也不扣点。公式按普通文字写入。打印和 HTML 仍然可用。";
  return "复制的是 Markdown。打印和 HTML 下载是同一份页面。";
}

function filenameFromDisposition(header: string) {
  const star = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (star?.[1]) return decodeURIComponent(star[1]);
  const plain = header.match(/filename="([^"]+)"/i);
  return plain?.[1] ?? "";
}

function OfficeButton({ recordId, kind }: { recordId: string; kind: "pptx" | "docx" }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  async function download() {
    setState("loading");
    setMessage("");
    try {
      const response = await fetch(`/api/export/${kind}?id=${encodeURIComponent(recordId)}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(payload?.error || "没有下载成功。这次不扣点。");
        setState("error");
        return;
      }
      const blob = await response.blob();
      const name = filenameFromDisposition(response.headers.get("Content-Disposition") ?? "") || downloadName(kind === "pptx" ? "ai-ppt" : "ai-word", kind);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch {
      setMessage("下载中断。可以再试。这次不扣点。");
      setState("error");
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" className="h-11 min-h-11" disabled={state === "loading"} onClick={() => void download()}>
        <Presentation /> {state === "loading" ? "正在准备" : kind === "pptx" ? "PPTX" : "DOCX"}
      </Button>
      {state === "error" ? (
        <span className="text-sm leading-6 text-clay" role="alert">
          {message}{" "}
          <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => void download()}>再试一次</Button>
        </span>
      ) : null}
    </div>
  );
}

function saveFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.title = "打印预览";
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow.focus();
  frame.contentWindow.print();
  window.setTimeout(() => frame.remove(), 1000);
  return true;
}

export function ResultView({
  record,
  pending,
  error,
  empty,
  live = null,
  cost,
  loadedPast = false,
  balanceNote = null,
  onRetry,
  onRestoreInput,
  exportKind = null,
}: {
  record: PublicGeneration | null;
  pending: boolean;
  error: string;
  empty: string;
  live?: boolean | null;
  cost?: number;
  loadedPast?: boolean;
  balanceNote?: number | null;
  onRetry?: () => void;
  onRestoreInput?: (input: Record<string, string>) => void;
  exportKind?: "pptx" | "docx" | null;
}) {
  const [copied, setCopied] = useState("");
  const pendingText = live === false ? "正在生成本地示例，没有调用模型。成功后才会扣点。" : "正在生成。成功后才会扣点。";

  async function copyMarkdown(current: PublicGeneration) {
    const markdown = toMarkdown(current);
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied("已复制 Markdown");
    } catch {
      setCopied("没有复制成功，可以改用 Markdown 下载。");
    }
    window.setTimeout(() => setCopied(""), 2500);
  }

  return (
    <div className="space-y-5">
      {pending ? (
        <div className="rounded-xl border border-border bg-secondary/60 px-4 py-4" role="status" aria-live="polite">
          <p className="text-base leading-7 text-pine">{pendingText}</p>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-clay/30 bg-accent px-4 py-4 text-base leading-7 text-clay" role="alert">
          <p>{error}</p>
          {onRetry ? (
            <Button type="button" variant="outline" className="mt-3 h-11 min-h-11" disabled={pending} onClick={onRetry}>
              再试一次
            </Button>
          ) : null}
        </div>
      ) : null}
      {!record && !pending ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-base leading-7 text-muted-foreground">
          <p className="font-medium text-foreground">结果会显示在这里</p>
          <p className="mt-2">{empty}</p>
          <p className="mt-2">{emptyExportCopy(exportKind)}</p>
        </div>
      ) : null}
      {record ? <ResultBody record={record} loadedPast={loadedPast} cost={cost} balanceNote={balanceNote} copied={copied} exportKind={exportKind} onCopy={() => void copyMarkdown(record)} onPrint={() => printHtml(toHtmlDocument(record))} onRestoreInput={onRestoreInput} /> : null}
    </div>
  );
}

function ResultBody({
  record,
  loadedPast,
  cost,
  balanceNote,
  copied,
  onCopy,
  onPrint,
  onRestoreInput,
  exportKind,
}: {
  record: PublicGeneration;
  loadedPast: boolean;
  cost?: number;
  balanceNote: number | null;
  copied: string;
  exportKind: "pptx" | "docx" | null;
  onCopy: () => void;
  onPrint: () => void;
  onRestoreInput?: (input: Record<string, string>) => void;
}) {
  const { result } = record;
  return (
    <div className="space-y-5">
      {loadedPast ? (
        <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm leading-6 text-muted-foreground">
          <p>这是本机保存的上一次结果（{formatStamp(record.createdAt)}，{sourceLabel(record.source)}）。打开页面不会再次扣点。</p>
          {onRestoreInput ? (
            <Button type="button" variant="outline" className="mt-2 h-11 min-h-11" onClick={() => onRestoreInput(record.input)}>
              把上次的输入填回表单
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{sourceLabel(record.source)} · {formatStamp(record.createdAt)}</p>
          {record.source === "mock" ? <p className="mt-1 text-sm leading-6 text-clay">{MOCK_NOTICE}</p> : null}
          {!loadedPast && cost ? <p className="mt-1 text-sm leading-6 text-foreground">这次已扣 {cost} 点{balanceNote !== null ? `，余额 ${balanceNote}` : ""}。</p> : null}
          <h2 className="mt-1 text-xl font-semibold leading-snug">{result.title}</h2>
          <p className="mt-1 text-base text-muted-foreground">{result.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 min-h-11" onClick={onCopy}><Copy /> 复制</Button>
          <Button variant="outline" className="h-11 min-h-11" onClick={onPrint}><Printer /> 打印</Button>
          <Button variant="outline" className="h-11 min-h-11" onClick={() => saveFile(downloadName(record.toolId, "md"), toMarkdown(record), "text/markdown")}><FileText /> Markdown</Button>
          <Button variant="outline" className="h-11 min-h-11" onClick={() => saveFile(downloadName(record.toolId, "json"), JSON.stringify(record, null, 2), "application/json")}><FileJson /> JSON</Button>
          <Button variant="outline" className="h-11 min-h-11" onClick={() => saveFile(downloadName(record.toolId, "html"), toHtmlDocument(record), "text/html")}><Download /> HTML</Button>
          {exportKind ? <OfficeButton recordId={record.id} kind={exportKind} /> : null}
        </div>
      </div>
      {copied ? <p className="text-sm text-pine" role="status">{copied}</p> : null}
      <p className="text-sm leading-6 text-muted-foreground">{exportCopy(exportKind)}</p>
      <p className="text-base leading-7">{result.summary}</p>
      {result.sections.map((section, sectionIndex) => (
        <section key={`${section.heading}-${sectionIndex}`} className="space-y-2">
          <h3 className="text-lg font-semibold">{section.heading}</h3>
          {section.paragraphs?.map((paragraph, index) => <p key={`${sectionIndex}-p-${index}`} className="whitespace-pre-wrap text-base leading-7">{showBlanks(paragraph)}</p>)}
          {section.bullets ? <ul className="list-disc space-y-1 pl-5 text-base leading-7">{section.bullets.map((bullet, index) => <li key={`${sectionIndex}-b-${index}`}>{showBlanks(bullet)}</li>)}</ul> : null}
          {section.table ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-base">
                <thead className="bg-secondary">
                  <tr>{section.table.headers.map((header, index) => <th key={`${sectionIndex}-h-${index}`} className="px-3 py-2 text-left font-medium">{header}</th>)}</tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row, index) => (
                    <tr key={`${sectionIndex}-r-${index}`} className="border-t border-border">
                      {row.map((cell, cellIndex) => <td key={`${sectionIndex}-${index}-${cellIndex}`} className="px-3 py-2 align-top break-words">{showBlanks(cell)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ))}
      {result.diagramSvg ? (
        <section aria-label="图示">
          <h3 className="mb-2 text-lg font-semibold">图示</h3>
          <div className="diagram-frame overflow-x-auto rounded-xl border border-border bg-card p-2" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(result.diagramSvg) }} />
        </section>
      ) : null}
      {result.slides?.length ? (
        <section>
          <h3 className="mb-2 text-lg font-semibold">分页讲稿</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {result.slides.map((slide, index) => (
              <article key={`${slide.title}-${index}`} className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-clay">{slide.kicker} · {index + 1}</p>
                <h4 className="mt-1 text-lg font-semibold">{slide.title}</h4>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-base leading-7">{slide.bullets.map((bullet, bulletIndex) => <li key={`${index}-${bulletIndex}`}>{showBlanks(bullet)}</li>)}</ul>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">讲者备注：{showBlanks(slide.notes)}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {result.docHtml ? (
        <section>
          <h3 className="mb-2 text-lg font-semibold">版面预览</h3>
          <div dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(result.docHtml) }} />
        </section>
      ) : null}
    </div>
  );
}
