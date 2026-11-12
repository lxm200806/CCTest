import { fileStamp, formatStamp } from "@/lib/dates";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import type { GenerationRecord, ToolResult } from "@/lib/types";

export function sourceLabel(source: string) {
  if (source === "openai") return "OpenAI";
  if (source === "deepseek") return "DeepSeek";
  return "本地示例";
}

function esc(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function toMarkdown(record: Pick<GenerationRecord, "toolName" | "source" | "createdAt" | "result">) {
  const { result } = record;
  const lines: string[] = [
    `# ${result.title}`,
    "",
    result.subtitle,
    "",
    result.summary,
    "",
    `> ${record.toolName} · ${sourceLabel(record.source)} · ${formatStamp(record.createdAt)}`,
    "",
  ];
  for (const section of result.sections) {
    lines.push(`## ${section.heading}`, "");
    for (const paragraph of section.paragraphs ?? []) lines.push(paragraph, "");
    for (const bullet of section.bullets ?? []) lines.push(`- ${bullet}`);
    if (section.bullets?.length) lines.push("");
    if (section.table) {
      lines.push(`| ${section.table.headers.join(" | ")} |`);
      lines.push(`| ${section.table.headers.map(() => "---").join(" | ")} |`);
      for (const row of section.table.rows) lines.push(`| ${row.join(" | ")} |`);
      lines.push("");
    }
  }
  if (result.slides?.length) {
    lines.push("## 分页讲稿", "");
    result.slides.forEach((slide, index) => {
      lines.push(`### ${index + 1}. ${slide.title}`, "", slide.kicker, "");
      for (const bullet of slide.bullets) lines.push(`- ${bullet}`);
      lines.push("", `讲者备注：${slide.notes}`, "");
    });
  }
  if (result.diagramSvg) lines.push("## 图示", "", "图示包含在 HTML 下载里。", "");
  return `${lines.join("\n").trim()}\n`;
}

export function toHtmlDocument(record: Pick<GenerationRecord, "toolName" | "source" | "createdAt" | "result">) {
  const { result } = record;
  const sections = result.sections
    .map((section) => {
      const paragraphs = (section.paragraphs ?? []).map((paragraph) => `<p>${esc(paragraph).replaceAll("\n", "<br>")}</p>`).join("");
      const bullets = section.bullets?.length
        ? `<ul>${section.bullets.map((bullet) => `<li>${esc(bullet)}</li>`).join("")}</ul>`
        : "";
      const table = section.table
        ? `<table><thead><tr>${section.table.headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${section.table.rows
            .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`
        : "";
      return `<section><h2>${esc(section.heading)}</h2>${paragraphs}${bullets}${table}</section>`;
    })
    .join("");
  const slides = result.slides?.length
    ? `<section><h2>分页讲稿</h2>${result.slides
        .map(
          (slide, index) =>
            `<article class="slide"><p class="kicker">${esc(slide.kicker)} · ${index + 1}</p><h3>${esc(slide.title)}</h3><ul>${slide.bullets
              .map((bullet) => `<li>${esc(bullet)}</li>`)
              .join("")}</ul><p class="notes">讲者备注：${esc(slide.notes)}</p></article>`,
        )
        .join("")}</section>`
    : "";
  const diagram = result.diagramSvg ? `<section><h2>图示</h2>${sanitizeRichHtml(result.diagramSvg)}</section>` : "";
  const doc = result.docHtml ? `<section><h2>版面</h2>${sanitizeRichHtml(result.docHtml)}</section>` : "";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${esc(result.title)}</title>
<style>
  body { margin: 0; background: #f3efe6; color: #1c1915; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }
  main { max-width: 880px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 28px; line-height: 1.35; margin: 0 0 8px; }
  h2 { font-size: 18px; margin: 28px 0 8px; }
  p, li { line-height: 1.75; font-size: 15px; }
  .sub, .meta, .kicker, .notes { color: #5e564c; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; background: #fffdf8; }
  th, td { border: 1px solid #e3d7c4; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #efe6d6; }
  .slide { background: #fffdf8; border: 1px solid #e3d7c4; border-radius: 12px; padding: 16px 18px; margin: 0 0 12px; }
  svg { width: 100%; max-width: 40rem; height: auto; background: #fffdf8; }
  .diagram-note, .diagram-warning, .diagram-title, .diagram-tree-root, .diagram-tree li { font-size: 16px; line-height: 1.7; }
  .diagram-note { color: #5e564c; }
  .diagram-warning { color: #9a3e22; }
  .diagram-tree { margin: 0; }
  .diagram-tree-root { margin: 0; border-radius: 10px; background: #1f4d42; color: #f6f1e6; padding: 12px 16px; }
  .diagram-tree ul { margin: 12px 0 0; padding: 0 0 0 18px; list-style: none; border-left: 2px solid #e0d3be; }
  .diagram-tree li { margin: 8px 0; border: 1px solid #1f4d42; border-radius: 8px; background: #fffdf8; padding: 10px 12px; }
</style>
</head>
<body>
<main>
  <p class="meta">${esc(record.toolName)} · ${esc(sourceLabel(record.source))} · ${esc(formatStamp(record.createdAt))}</p>
  <h1>${esc(result.title)}</h1>
  <p class="sub">${esc(result.subtitle)}</p>
  <p>${esc(result.summary)}</p>
  ${sections}${slides}${diagram}${doc}
</main>
</body>
</html>
`;
}

export function downloadName(toolId: string, ext: string, now = new Date()) {
  return `${toolId}-${fileStamp(now)}.${ext}`;
}

export function resultHasPrintableFigure(result: ToolResult) {
  return Boolean(result.diagramSvg || result.docHtml || result.slides?.length);
}
