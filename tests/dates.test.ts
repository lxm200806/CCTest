import assert from "node:assert/strict";
import test from "node:test";
import { fileStamp, formatStamp } from "@/lib/dates";
import { downloadName, toHtmlDocument, toMarkdown } from "@/lib/format";
import type { ToolResult } from "@/lib/types";

const instant = "2026-11-12T05:45:00.000Z";
const shanghai = "11月12日 13:45（北京时间）";

test("generation stamps use Asia/Shanghai even when the process clock is not", () => {
  assert.equal(formatStamp(instant), shanghai);
  assert.equal(formatStamp("2026-11-12T16:30:00.000Z"), "11月13日 00:30（北京时间）");
  assert.equal(formatStamp("not-a-date"), "not-a-date");
  assert.equal(fileStamp(new Date(instant)), "202611121345");
  assert.equal(downloadName("ai-grade", "html", new Date(instant)), "ai-grade-202611121345.html");
});

test("markdown and html exports show the Shanghai generation time", () => {
  const result: ToolResult = {
    title: "作业批改",
    subtitle: "初二 数学",
    summary: "按文字批改。",
    sections: [{ heading: "批注", paragraphs: ["先看符号。"] }],
  };
  const record = { toolName: "AI作业批改", source: "mock" as const, createdAt: instant, result };
  const markdown = toMarkdown(record);
  const html = toHtmlDocument(record);
  assert.match(markdown, new RegExp(shanghai));
  assert.match(html, new RegExp(shanghai));
  assert.equal(markdown.includes("05:45"), false);
  assert.equal(html.includes("05:45"), false);
  assert.equal(markdown.includes(instant), false);
});
