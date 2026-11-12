import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildPptx } from "@/lib/export/pptx";
import { showBlanks } from "@/lib/export/text";
import { toHtmlDocument, toMarkdown } from "@/lib/format";
import type { ToolResult } from "@/lib/types";

const blank = "（　　）";

test("fill-in underscores become a visible blank and single-underscore identifiers stay", () => {
  const source = "每条旁边写一句：b=__，k__0，比 y=x 更陡还是更缓";
  const shown = showBlanks(source);
  assert.equal(shown, `每条旁边写一句：b=${blank}，k${blank}0，比 y=x 更陡还是更缓`);
  assert.equal(shown.includes("k>0") || shown.includes("k<0"), false);
  assert.equal(showBlanks("交点 (0,__)"), `交点 (0,${blank})`);
  assert.equal(showBlanks("y_1 与 k_0 保持原样，k≠0 也保持"), "y_1 与 k_0 保持原样，k≠0 也保持");
  assert.equal(showBlanks("结果增加 ____。"), `结果增加 ${blank}。`);
});

test("replay of the live 8-page deck keeps teaching slides and shows the blank", async () => {
  const saved = JSON.parse(readFileSync(new URL("./fixtures/live/ai-ppt-replay.json", import.meta.url), "utf8")) as {
    response: { result: ToolResult };
  };
  const result = saved.response.result;
  assert.equal(result.slides?.length, 8);
  const pptx = await buildPptx(result);
  const zip = zipText(pptx);
  try {
    const slides = zip.names.filter((name) => /ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
    assert.equal(slides.length, 9);
    const visible = xmlText(slides.map((name) => zip.read(name).toString("utf8")).join("\n"));
    const notes = xmlText(zip.names.filter((name) => name.includes("notesSlide")).map((name) => zip.read(name).toString("utf8")).join("\n"));
    assert.match(visible, /要求 8 页/);
    assert.match(visible, /本文件共 9 页/);
    assert.ok(visible.includes(`k${blank}0`));
    assert.equal(visible.includes("k__0"), false);
    assert.equal(visible.includes("k_0"), false);
    assert.ok(visible.includes("比 y=x 更陡还是更缓"));
    assert.ok(notes.includes("这节课的读图主线"));
    assert.ok(notes.length > 1400);
  } finally {
    zip.cleanup();
  }
});

test("a crafted long slide paginates, discloses the count, and keeps every character", async () => {
  const sentence = "长句甲乙丙丁必须整段保留。";
  const copies = 40;
  const long = sentence.repeat(copies);
  const appendix = `附录起点${"说明文字".repeat(370)}附录终点`;
  assert.ok(appendix.length >= 1487);
  const pptx = await buildPptx({
    title: "长页验收",
    subtitle: "",
    summary: "",
    slides: [{ kicker: "概念", title: "一次函数 y = 2x - 4", bullets: [long], notes: "讲者备注保留" }],
    sections: [{ heading: "使用说明", paragraphs: [appendix] }],
  });
  const zip = zipText(pptx);
  try {
    const slides = zip.names.filter((name) => /ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
    const visible = xmlText(slides.map((name) => zip.read(name).toString("utf8")).join("\n"));
    const notes = xmlText(zip.names.filter((name) => name.includes("notesSlide")).map((name) => zip.read(name).toString("utf8")).join("\n"));
    assert.ok(slides.length > 2);
    assert.match(visible, /要求 1 页/);
    assert.match(visible, new RegExp(`正文拆成了 ${slides.length - 1} 页`));
    assert.match(visible, /续/);
    assert.equal(visible.split(sentence).length - 1, copies);
    assert.ok(notes.includes(appendix));
    assert.ok(notes.includes("讲者备注保留"));
    assert.ok(notes.includes("附录起点") && notes.includes("附录终点"));
  } finally {
    zip.cleanup();
  }
});

test("replay of the live primary paper keeps labeled choices in print HTML", () => {
  const saved = JSON.parse(readFileSync(new URL("./fixtures/live/primary-math-paper-replay.json", import.meta.url), "utf8")) as {
    response: { result: ToolResult; toolName: string; source: "deepseek"; createdAt: string };
  };
  const record = saved.response;
  const html = toHtmlDocument(record);
  const markdown = toMarkdown(record);
  for (const choice of ["A. 4", "B. 5", "C. 6", "D. 7", "A. 5", "B. 6", "C. 7", "D. 8"]) {
    assert.ok(html.includes(choice));
    assert.ok(markdown.includes(choice));
  }
  assert.match(html, /A\. 4<br>B\. 5<br>C\. 6<br>D\. 7/);
  assert.ok(html.includes("1. B. 5"));
  assert.ok(html.includes("2. C. 7"));
  assert.ok(html.includes("6. 5+4=9"));
  assert.equal(html.includes("k__0"), false);
});

function zipText(buf: Buffer) {
  const dir = mkdtempSync(join(tmpdir(), "sw-replay-"));
  const file = join(dir, "file.pptx");
  writeFileSync(file, buf);
  const names = execFileSync("python3", ["-c", "import zipfile,sys; print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))", file], { encoding: "utf8" }).trim().split(/\n/);
  const read = (name: string) => execFileSync("python3", ["-c", "import zipfile,sys; sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))", file, name]);
  return { names, read, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function xmlText(xml: string) {
  return [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((match) => match[1] ?? "").join("");
}
