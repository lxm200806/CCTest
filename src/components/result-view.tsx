"use client";

import { Download, FileJson, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadName, sourceLabel, toHtmlDocument, toMarkdown } from "@/lib/format";
import { formatStamp } from "@/lib/dates";
import type { PublicGeneration } from "@/lib/types";

function saveFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ResultView({
  record,
  pending,
  error,
  empty,
}: {
  record: PublicGeneration | null;
  pending: boolean;
  error: string;
  empty: string;
}) {
  if (pending) {
    return (
      <div className="space-y-3" aria-live="polite">
        <p className="text-sm text-pine">正在按学段整理内容…</p>
        <div className="h-6 w-2/3 animate-pulse rounded bg-secondary" />
        <div className="h-24 animate-pulse rounded-xl bg-secondary" />
      </div>
    );
  }
  if (error) {
    return <div className="rounded-xl border border-clay/30 bg-accent px-4 py-4 text-sm leading-6 text-clay" role="alert">{error}</div>;
  }
  if (!record) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-sm leading-7 text-muted-foreground">
        <p className="font-medium text-foreground">结果会显示在这里</p>
        <p className="mt-2">{empty}</p>
        <p className="mt-2">可以下载 Markdown、JSON，需要打印时下载 HTML。</p>
      </div>
    );
  }
  const { result } = record;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{sourceLabel(record.source)} · {formatStamp(record.createdAt)}</p>
          <h2 className="mt-1 text-xl font-semibold leading-snug">{result.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{result.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => saveFile(downloadName(record.toolId, "md"), toMarkdown(record), "text/markdown")}><FileText /> Markdown</Button>
          <Button variant="outline" size="sm" onClick={() => saveFile(downloadName(record.toolId, "json"), JSON.stringify(record, null, 2), "application/json")}><FileJson /> JSON</Button>
          <Button variant="outline" size="sm" onClick={() => saveFile(downloadName(record.toolId, "html"), toHtmlDocument(record), "text/html")}><Download /> HTML</Button>
        </div>
      </div>
      <p className="text-sm leading-7">{result.summary}</p>
      {result.sections.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h3 className="text-base font-semibold">{section.heading}</h3>
          {section.paragraphs?.map((paragraph) => <p key={paragraph} className="whitespace-pre-wrap text-sm leading-7">{paragraph}</p>)}
          {section.bullets ? <ul className="list-disc space-y-1 pl-5 text-sm leading-7">{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
          {section.table ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[28rem] border-collapse text-sm">
                <thead className="bg-secondary"><tr>{section.table.headers.map((header) => <th key={header} className="px-3 py-2 text-left font-medium">{header}</th>)}</tr></thead>
                <tbody>
                  {section.table.rows.map((row, index) => (
                    <tr key={`${section.heading}-${index}`} className="border-t border-border">
                      {row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`} className="px-3 py-2 align-top">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ))}
      {result.diagramSvg ? (
        <section>
          <h3 className="mb-2 text-base font-semibold">图示</h3>
          <div className="overflow-x-auto rounded-xl border border-border bg-card p-2" dangerouslySetInnerHTML={{ __html: result.diagramSvg }} />
        </section>
      ) : null}
      {result.slides?.length ? (
        <section>
          <h3 className="mb-2 text-base font-semibold">分页讲稿</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {result.slides.map((slide, index) => (
              <article key={`${slide.title}-${index}`} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-clay">{slide.kicker} · {index + 1}</p>
                <h4 className="mt-1 font-semibold">{slide.title}</h4>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6">{slide.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">讲者备注：{slide.notes}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {result.docHtml ? (
        <section>
          <h3 className="mb-2 text-base font-semibold">版面预览</h3>
          <div dangerouslySetInnerHTML={{ __html: result.docHtml }} />
        </section>
      ) : null}
    </div>
  );
}
