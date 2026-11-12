import type { Section, ToolResult } from "@/lib/types";
import { cleanText } from "@/lib/export/text";

export type TextBlock =
  | { kind: "heading"; level: 1 | 2; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "break" };

export function documentBlocks(result: ToolResult): TextBlock[] {
  const blocks: TextBlock[] = [{ kind: "heading", level: 1, text: cleanText(result.title) || "文稿" }];
  if (result.subtitle.trim()) blocks.push({ kind: "paragraph", text: cleanText(result.subtitle) });
  if (result.summary.trim()) blocks.push({ kind: "paragraph", text: cleanText(result.summary) });
  const fromHtml = result.docHtml ? htmlBlocks(result.docHtml) : [];
  const seen = new Set<string>();
  for (const block of fromHtml) {
    if (block.kind === "heading") seen.add(block.text);
  }
  if (fromHtml.length) {
    const title = blocks[0];
    const titleText = title?.kind === "heading" ? title.text : "";
    blocks.push(...fromHtml.filter((block) => !(block.kind === "heading" && block.level === 1 && block.text === titleText)));
  }
  if (fromHtml.length && result.sections.length) blocks.push({ kind: "break" });
  for (const section of result.sections) blocks.push(...sectionBlocks(section, seen));
  return blocks.filter((block, index) => block.kind !== "break" || (index > 0 && index < blocks.length - 1));
}

function sectionBlocks(section: Section, seen: Set<string>): TextBlock[] {
  const heading = cleanText(section.heading);
  const blocks: TextBlock[] = [];
  if (heading && !seen.has(heading)) blocks.push({ kind: "heading", level: 2, text: heading });
  for (const paragraph of section.paragraphs ?? []) {
    const text = cleanText(paragraph);
    if (text) blocks.push({ kind: "paragraph", text });
  }
  for (const bullet of section.bullets ?? []) {
    const text = cleanText(bullet);
    if (text) blocks.push({ kind: "bullet", text });
  }
  if (section.table && section.table.headers.length && section.table.rows.length) {
    blocks.push({
      kind: "table",
      headers: section.table.headers.map((cell) => cleanText(cell)),
      rows: section.table.rows.map((row) => row.map((cell) => cleanText(cell))),
    });
  }
  return blocks;
}

export function htmlBlocks(html: string): TextBlock[] {
  const source = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const blocks: TextBlock[] = [];
  let mode: "p" | "h1" | "h2" | "li" | "cell" | "" = "";
  let text = "";
  let row: string[] = [];
  let rows: string[][] = [];
  let index = 0;
  const flushText = () => {
    const value = decode(text).trim();
    text = "";
    if (!value) return;
    if (mode === "h1" || mode === "h2") blocks.push({ kind: "heading", level: mode === "h1" ? 1 : 2, text: value });
    else if (mode === "li") blocks.push({ kind: "bullet", text: value });
    else if (mode === "cell") row.push(value);
    else blocks.push({ kind: "paragraph", text: value });
  };
  while (index < source.length) {
    if (source[index] !== "<") {
      const next = source.indexOf("<", index);
      text += source.slice(index, next < 0 ? source.length : next);
      index = next < 0 ? source.length : next;
      continue;
    }
    const end = source.indexOf(">", index);
    if (end < 0) break;
    const raw = source.slice(index + 1, end);
    index = end + 1;
    const closing = raw.startsWith("/");
    const tag = raw.replace(/^\//, "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    if (!closing && (tag === "p" || tag === "h1" || tag === "h2" || tag === "li" || tag === "td" || tag === "th")) {
      flushText();
      mode = tag === "td" || tag === "th" ? "cell" : tag;
    }
    if (tag === "table" && !closing) rows = [];
    if (tag === "tr" && !closing) row = [];
    if ((tag === "td" || tag === "th") && closing) {
      row.push(decode(text).trim());
      text = "";
      mode = "";
    }
    if (tag === "tr" && closing) {
      if (row.length) rows.push(row);
      row = [];
    }
    if (tag === "table" && closing) {
      if (rows.length) {
        const [headers, ...body] = rows;
        blocks.push({ kind: "table", headers: headers ?? [], rows: body.length ? body : rows });
      }
      rows = [];
    }
    if ((tag === "p" || tag === "h1" || tag === "h2" || tag === "li") && closing) {
      flushText();
      mode = "";
    }
  }
  flushText();
  return blocks;
}

function decode(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
