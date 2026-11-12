import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { handleExport } from "@/lib/export/handle";
import { ownedGeneration } from "@/lib/export/owned";
import { buildDocx } from "@/lib/export/docx";
import { buildPptx } from "@/lib/export/pptx";
import { contentDisposition, splitPreserving } from "@/lib/export/text";
import { mockGenerate } from "@/lib/ai/mock";
import { getTool } from "@/lib/tools";
import type { GenerationRecord, PublicUser, ToolResult } from "@/lib/types";

function user(id: string): PublicUser {
  return { id, username: id, displayName: "测试", credits: 12 };
}

function record(partial: Partial<GenerationRecord> & Pick<GenerationRecord, "id" | "userId" | "toolId" | "result">): GenerationRecord {
  return {
    toolName: partial.toolId,
    source: "mock",
    createdAt: "2026-11-12T05:45:00.000Z",
    input: {},
    ...partial,
  };
}

function zipText(buf: Buffer) {
  const dir = mkdtempSync(join(tmpdir(), "sw-zip-"));
  const file = join(dir, "file.bin");
  writeFileSync(file, buf);
  const names = execFileSync("python3", ["-c", "import zipfile,sys; print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))", file], { encoding: "utf8" }).trim().split(/\n/);
  const read = (name: string) => execFileSync("python3", ["-c", "import zipfile,sys; sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))", file, name]);
  return { names, read, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function xmlText(xml: string) {
  return [...xml.matchAll(/<(?:a:t|w:t)[^>]*>([^<]*)<\/(?:a:t|w:t)>/g)]
    .map((match) => match[1] ?? "")
    .join("")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"');
}

test("filenames stay on one header line and keep Unicode", () => {
  const header = contentDisposition("pptx", "一次函数\r\nSet-Cookie: evil");
  assert.equal(header.includes("\r"), false);
  assert.equal(header.includes("\n"), false);
  assert.match(header, /filename\*=UTF-8''/);
  assert.match(decodeURIComponent(header.split("filename*=UTF-8''")[1] ?? ""), /一次函数/);
  const joined = "课堂先看斜率。".repeat(40);
  assert.equal(splitPreserving(joined, 80).join(""), joined);
});

test("ownership matches both user and id", () => {
  const rows = [
    record({ id: "gen_mine", userId: "usr_me", toolId: "ai-ppt", result: samplePpt() }),
    record({ id: "gen_other", userId: "usr_other", toolId: "ai-ppt", result: samplePpt() }),
  ];
  assert.equal(ownedGeneration(rows, "usr_me", "gen_other"), null);
  assert.equal(ownedGeneration(rows, "usr_me", "gen_mine")?.id, "gen_mine");
  assert.equal(ownedGeneration(rows, " ", "gen_mine"), null);
});

test("export auth, missing records, and the wrong tool do not return a file", async () => {
  const ppt = record({ id: "gen_ppt", userId: "usr_me", toolId: "ai-ppt", result: samplePpt() });
  const word = record({ id: "gen_word", userId: "usr_me", toolId: "ai-word", result: sampleDoc() });
  const find = (userId: string, id: string) => ownedGeneration([ppt, word], userId, id);
  const anon = await handleExport({ user: null, format: "pptx", generationId: "gen_ppt", find });
  assert.equal(anon.status, 401);
  const missing = await handleExport({ user: user("usr_me"), format: "pptx", generationId: "gen_missing", find });
  assert.equal(missing.status, 404);
  const other = await handleExport({ user: user("usr_me"), format: "pptx", generationId: "gen_other", find });
  assert.equal(other.status, 404);
  const wrong = await handleExport({ user: user("usr_me"), format: "pptx", generationId: "gen_word", find });
  assert.equal(wrong.status, 400);
  const wrongBody = (await wrong.json()) as { error?: string; balance?: number };
  assert.match(wrongBody.error ?? "", /不扣点/);
  assert.equal(wrongBody.balance, undefined);
});

test("pptx and docx are real packages, keep text, and can be built twice", async () => {
  const pptResult = longPpt();
  const docResult = longDoc();
  const pptx = await buildPptx(pptResult);
  const pptxAgain = await buildPptx(pptResult);
  const docx = await buildDocx(docResult);
  const docxAgain = await buildDocx(docResult);
  assert.equal(pptx.subarray(0, 2).toString(), "PK");
  assert.equal(docx.subarray(0, 2).toString(), "PK");
  assert.equal(pptxAgain.subarray(0, 2).toString(), "PK");
  assert.equal(docxAgain.subarray(0, 2).toString(), "PK");
  const pptZip = zipText(pptx);
  const docZip = zipText(docx);
  try {
    assert.ok(pptZip.names.includes("[Content_Types].xml"));
    assert.ok(pptZip.names.some((name) => name.startsWith("ppt/slides/slide")));
    assert.ok(pptZip.names.some((name) => name.includes("notesSlide")));
    const types = pptZip.read("[Content_Types].xml").toString("utf8");
    assert.match(types, /presentationml\.presentation/);
    const slideXml = pptZip.names.filter((name) => /ppt\/slides\/slide\d+\.xml$/.test(name)).map((name) => pptZip.read(name).toString("utf8")).join("\n");
    const notesXml = pptZip.names.filter((name) => name.includes("notesSlide")).map((name) => pptZip.read(name).toString("utf8")).join("\n");
    const visible = xmlText(slideXml);
    const notes = xmlText(notesXml);
    assert.ok(visible.includes("一次函数 y = 2x - 4"));
    assert.ok(visible.includes("a < b & c"));
    assert.equal(slideXml.includes("<script"), false);
    const longBullet = pptResult.slides?.[0]?.bullets[1] ?? "";
    for (const part of splitPreserving(longBullet, 180)) assert.ok(visible.includes(part));
    assert.ok(notes.includes("讲者备注：先停三秒"));
    assert.ok(visible.includes("表头甲"));
    const docTypes = docZip.read("[Content_Types].xml").toString("utf8");
    assert.match(docTypes, /wordprocessingml\.document/);
    const documentXml = docZip.read("word/document.xml").toString("utf8");
    const documentText = xmlText(documentXml);
    assert.ok(documentText.includes("本周焦点：一次函数的图像和解析式。"));
    assert.ok(documentText.includes("y = 2x - 4"));
    assert.ok(documentText.includes("a < b & c"));
    assert.equal(documentXml.includes("<script"), false);
    assert.ok(documentText.includes(docResult.sections[1]?.paragraphs?.[0] ?? ""));
    assert.match(documentXml, /w:type="page"/);
  } finally {
    pptZip.cleanup();
    docZip.cleanup();
  }
});

test("saved mock lesson decks and word sheets export without calling a model", async () => {
  const pptTool = getTool("ai-ppt");
  const wordTool = getTool("ai-word");
  assert.ok(pptTool && wordTool);
  const ppt = record({ id: "gen_ppt", userId: "usr_me", toolId: "ai-ppt", result: mockGenerate("ai-ppt", pptTool.example) });
  const word = record({ id: "gen_word", userId: "usr_me", toolId: "ai-word", result: mockGenerate("ai-word", wordTool.example) });
  const find = (userId: string, id: string) => ownedGeneration([ppt, word], userId, id);
  const pptRes = await handleExport({ user: user("usr_me"), format: "pptx", generationId: "gen_ppt", find });
  const docRes = await handleExport({ user: user("usr_me"), format: "docx", generationId: "gen_word", find });
  assert.equal(pptRes.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  assert.equal(docRes.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(pptRes.headers.get("x-export-charged"), "0");
  assert.equal(docRes.headers.get("x-export-charged"), "0");
  const pptBuf = Buffer.from(await pptRes.arrayBuffer());
  const docBuf = Buffer.from(await docRes.arrayBuffer());
  const pptZip = zipText(pptBuf);
  const docZip = zipText(docBuf);
  try {
    const slides = pptZip.names.filter((name) => /ppt\/slides\/slide\d+\.xml$/.test(name));
    assert.ok(slides.length >= 8);
    const text = xmlText(slides.map((name) => pptZip.read(name).toString("utf8")).join("\n"));
    assert.ok(text.includes("一次函数图像怎么读"));
    const body = xmlText(docZip.read("word/document.xml").toString("utf8"));
    assert.ok(body.includes("林晓禾数学周报"));
    assert.ok(body.includes("请家长只看这一句"));
    assert.equal(body.includes("study-sheet"), false);
    assert.equal(body.includes("</article>"), false);
  } finally {
    pptZip.cleanup();
    docZip.cleanup();
  }
});

function samplePpt(): ToolResult {
  return longPpt();
}

function longPpt(): ToolResult {
  const long = "课堂先看斜率，再看截距，最后让学生自己说一遍。".repeat(30);
  return {
    title: "一次函数怎么读",
    subtitle: "初二 数学",
    summary: "今天只处理这一件事。",
    slides: [
      { kicker: "概念", title: "一次函数 y = 2x - 4", bullets: ["a < b & c", long], notes: "讲者备注：先停三秒" },
    ],
    sections: [
      { heading: "对照表", table: { headers: ["表头甲", "表头乙"], rows: [["左", "右"], ["k", "正"]] } },
    ],
  };
}

function sampleDoc(): ToolResult {
  return longDoc();
}

function longDoc(): ToolResult {
  const long = "这一段要完整留在文档里，不能因为换页丢掉。".repeat(40);
  return {
    title: "数学周报",
    subtitle: "初二 数学",
    summary: "公式 y = 2x - 4 按文字保存。",
    docHtml: `<article><h1>数学周报</h1><p>本周焦点：一次函数的图像和解析式。</p><p>a &lt; b &amp; c</p><p>${long}</p></article>`,
    sections: [{ heading: "排版说明", paragraphs: ["打印前看有没有一段被拦腰截断。"] }],
  };
}
