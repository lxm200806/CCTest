import assert from "node:assert/strict";
import test from "node:test";
import { alignChoiceAnswer, labelChoices } from "@/lib/ai/choices";
import { presentModelResult } from "@/lib/ai/parse-result";
import { numberedVariantHeadings } from "@/lib/ai/variant-count";
import { buildDocx } from "@/lib/export/docx";
import { toHtmlDocument } from "@/lib/format";
import { getTool } from "@/lib/tools";

test("bare numeric choices gain letters without changing the numbers", () => {
  const labeled = labelChoices(["6", "7", "8", "9"]);
  assert.deepEqual(labeled, ["A. 6", "B. 7", "C. 8", "D. 9"]);
  assert.equal(alignChoiceAnswer("选 B", labeled), "选 B（7）");
  assert.deepEqual(labelChoices(["6 7 8 9"]), ["A. 6", "B. 7", "C. 8", "D. 9"]);
});

test("existing ascii, fullwidth, and wrapped labels are not labeled again", () => {
  assert.deepEqual(labelChoices(["A. 6", "B. 7"]), ["A. 6", "B. 7"]);
  assert.deepEqual(labelChoices(["Ａ．6", "Ｂ．7"]), ["Ａ．6", "Ｂ．7"]);
  assert.deepEqual(labelChoices(["（C）9", "D、10"]), ["（C）9", "D、10"]);
  assert.equal(alignChoiceAnswer("选 B（7）", ["A. 6", "B. 7"]), "选 B（7）");
  assert.equal(alignChoiceAnswer("7", ["A. 6", "B. 7"]), "B. 7");
});

test("unlabeled choices after a label continue the alphabet, and extras are kept", () => {
  assert.deepEqual(labelChoices(["B. 7", "8"]), ["B. 7", "C. 8"]);
  const many = Array.from({ length: 30 }, (_, index) => String(index + 1));
  const labeled = labelChoices(many);
  assert.equal(labeled.length, 30);
  assert.equal(labeled[0], "A. 1");
  assert.equal(labeled[25], "Z. 26");
  assert.equal(labeled[26], "27. 27");
  assert.equal(labeled[29], "30. 30");
  assert.deepEqual(labelChoices([]), []);
  assert.deepEqual(labelChoices(["6"]), ["A. 6"]);
});

test("a year-1 paper shows the letter and the number in the question and the answer", () => {
  const tool = getTool("ai-paper");
  assert.ok(tool);
  const questions = [
    { type: "选择", stem: "6 加 1 是多少？", options: ["6", "7", "8", "9"], answer: "选 B", points: 16, explanation: "6 加 1 是 7。" },
    ...Array.from({ length: 5 }, (_, index) => ({ type: "填空", stem: `${index + 1} 加 1`, options: [], answer: String(index + 2), points: 16, explanation: "" })),
  ];
  const result = presentModelResult(tool, tool.example, JSON.stringify({
    title: tool.example.scope,
    summary: "建议 20 分钟。",
    sections: [
      { heading: "作答说明", paragraphs: ["先做再对。"] },
      { heading: "范围", paragraphs: [tool.example.scope] },
    ],
    questions,
  }));
  const stem = result.sections.find((item) => item.heading === "试题")?.paragraphs?.[0] ?? "";
  const answer = result.sections.find((item) => item.heading === "参考答案")?.paragraphs?.[0] ?? "";
  assert.match(stem, /A\. 6\nB\. 7\nC\. 8\nD\. 9/);
  assert.match(answer, /选 B（7）/);
  const html = toHtmlDocument({ toolName: "AI组卷", source: "mock", createdAt: "2026-11-12T05:45:00.000Z", result });
  assert.match(html, /A\. 6<br>B\. 7<br>C\. 8<br>D\. 9/);
});

test("docx keeps each choice on its own line", async () => {
  const docx = await buildDocx({
    title: "选择题",
    subtitle: "",
    summary: "",
    sections: [{ heading: "试题", paragraphs: ["1. 6 加 1\nA. 6\nB. 7"] }],
  });
  assert.equal(docx.subarray(0, 2).toString(), "PK");
  const xml = await documentXml(docx);
  assert.match(xml, /A\. 6/);
  assert.match(xml, /<w:br\/>/);
  assert.match(xml, /B\. 7/);
});

test("variant count ignores a summary heading and rejects a missing or extra numbered variant", () => {
  const summary = { heading: "变式安排与验收" };
  assert.equal(numberedVariantHeadings([summary, { heading: "变式 1" }, { heading: "变式 2" }, { heading: "变式 3" }]).length, 3);
  assert.equal(numberedVariantHeadings([summary, { heading: "变式 1" }, { heading: "变式 2" }]).length, 2);
  assert.equal(numberedVariantHeadings([summary, { heading: "变式 1" }, { heading: "变式 2" }, { heading: "变式 3" }, { heading: "变式 4" }]).length, 4);
});

async function documentXml(buf: Buffer) {
  const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "sw-docx-"));
  const file = join(dir, "file.docx");
  writeFileSync(file, buf);
  try {
    return execFileSync("python3", ["-c", "import zipfile,sys; sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read('word/document.xml'))", file]).toString("utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
