import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resetOcrLock, handleOcrPost } from "@/lib/ocr/handle";
import { OcrError, inspectImage, isImagePayload, placeConfirmedText } from "@/lib/ocr/image";
import { describeTesseract, recognizeImageBytes } from "@/lib/ocr/tesseract";
import { readDraft, writeDraft } from "@/lib/drafts";
import { getTool, normalizeInput } from "@/lib/tools";
import type { PublicUser } from "@/lib/types";

const root = join(process.cwd(), "tests/fixtures/ocr");
const zh = "今天的作业是阅读短文并写出两个关键词。";
const en = "Read the paragraph and write two key words.";

function fixture(name: string) {
  return readFileSync(join(root, name));
}

function user(id: string): PublicUser {
  return { id, username: id, displayName: "测试", credits: 20 };
}

function formRequest(bytes: Buffer, type: string, extra?: Record<string, string>) {
  const form = new FormData();
  form.set("image", new File([Uint8Array.from(bytes)], "synthetic.png", { type }));
  for (const [key, value] of Object.entries(extra ?? {})) form.set(key, value);
  return new Request("http://local/api/ocr", { method: "POST", body: form });
}

test("image checks reject svg, wrong MIME, oversize, and huge dimensions", () => {
  const png = fixture("synthetic-blank.png");
  assert.equal(inspectImage(png, "image/png").kind, "png");
  assert.throws(() => inspectImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"), "image/svg+xml"), /SVG/);
  assert.throws(() => inspectImage(png, "text/plain"), /不一致/);
  assert.throws(() => inspectImage(png, "image/png", 20), /超过/);
  const bomb = Buffer.alloc(32);
  bomb.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bomb.writeUInt32BE(13, 8);
  bomb.write("IHDR", 12, "ascii");
  bomb.writeUInt32BE(10000, 16);
  bomb.writeUInt32BE(10000, 20);
  assert.throws(() => inspectImage(bomb, "image/png"), /尺寸太大/);
  const shortSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
  assert.throws(() => inspectImage(shortSig, "image/png"), /不是 PNG/);
});

test("confirmed text is editable and is not applied until the caller places it", () => {
  const grade = getTool("ai-grade");
  assert.ok(grade);
  const original = grade.example.answer ?? "";
  const edited = "今天的作业是阅读短文并写出两个关键字。";
  assert.equal(original.includes(edited), false);
  const placed = placeConfirmedText(original, edited);
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  assert.match(placed.value, /关键字/);
  assert.equal(original.includes("关键字"), false);
  const empty = placeConfirmedText("已有", "   ");
  assert.equal(empty.ok, false);
  const normalized = normalizeInput(grade, {
    ...grade.example,
    answer: placed.value,
    attachment: "synthetic-printed-zh.png",
    attachmentText: "图片未交给模型。批改只使用题目和作答里已经确认的文字。",
  });
  assert.equal(normalized.ok, true);
  if (!normalized.ok) return;
  assert.match(normalized.input.answer ?? "", /关键字/);
  assert.equal(JSON.stringify(normalized.input).includes("data:image"), false);
});

test("drafts and saved inputs drop image payloads", () => {
  const storage = new Map<string, string>();
  const memory = {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
  };
  writeDraft(memory, "ai-grade", { answer: "data:image/png;base64,AAAA", prompt: "普通文字" });
  const saved = readDraft(memory, "ai-grade");
  assert.equal(saved?.answer, "");
  assert.equal(saved?.prompt, "普通文字");
  assert.equal(isImagePayload("data:image/jpeg;base64,AAAA"), true);
  const grade = getTool("ai-grade");
  assert.ok(grade);
  const rejected = normalizeInput(grade, { ...grade.example, answer: "data:image/png;base64,AAAA" });
  assert.equal(rejected.ok, false);
});

test("ocr failures and rejected uploads do not recognize or report a charge", async () => {
  resetOcrLock();
  let calls = 0;
  const recognize = async () => {
    calls += 1;
    return { text: "不应出现", warning: "" };
  };
  const svg = await handleOcrPost(
    formRequest(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"), "image/svg+xml"),
    user("ocr-svg"),
    recognize,
  );
  assert.equal(svg.headers.get("content-type")?.includes("application/json"), true);
  const svgBody = (await svg.json()) as { error?: string; balance?: number };
  assert.equal(calls, 0);
  assert.equal(svgBody.balance, undefined);
  assert.match(svgBody.error ?? "", /不扣点/);

  const wrong = await handleOcrPost(formRequest(fixture("synthetic-blank.png"), "text/plain"), user("ocr-mime"), recognize);
  const wrongBody = (await wrong.json()) as { error?: string; balance?: number };
  assert.equal(calls, 0);
  assert.equal(wrongBody.balance, undefined);
  assert.match(wrongBody.error ?? "", /不一致|不扣点/);

  const anonymous = await handleOcrPost(formRequest(fixture("synthetic-blank.png"), "image/png"), null, recognize);
  assert.equal(anonymous.status, 401);
  assert.equal(calls, 0);
});

test("cancelling recognition aborts the worker and releases the lock", async () => {
  resetOcrLock();
  let aborted = false;
  const response = await handleOcrPost(formRequest(fixture("synthetic-blank.png"), "image/png"), user("ocr-cancel"), async (_bytes, _type, signal) => {
    await new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        reject(new OcrError("识别已取消。这次不扣点。", 499));
      }, { once: true });
    });
    return { text: "", warning: "" };
  });
  const reader = response.body?.getReader();
  assert.ok(reader);
  await reader.read();
  await reader.cancel();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(aborted, true);
  const again = await handleOcrPost(formRequest(fixture("synthetic-blank.png"), "image/png"), user("ocr-cancel"), async () => ({ text: "第二回", warning: "" }));
  const raw = await again.text();
  assert.match(raw, /第二回/);
  assert.equal(raw.includes("上一次识别还没结束"), false);
});

test("an empty session id is not authorized, and a form user id is ignored", async () => {
  resetOcrLock();
  const empty = await handleOcrPost(formRequest(fixture("synthetic-blank.png"), "image/png"), { ...user("usr_demo"), id: "  " }, async () => {
    throw new Error("should not run");
  });
  assert.equal(empty.status, 401);
  const form = new FormData();
  form.set("userId", "usr_other");
  form.set("url", "http://127.0.0.1/secret");
  form.set("image", new File([Uint8Array.from(fixture("synthetic-blank.png"))], "synthetic.png", { type: "image/png" }));
  let seen = 0;
  const response = await handleOcrPost(new Request("http://local/api/ocr", { method: "POST", body: form }), user("usr_demo"), async () => {
    seen += 1;
    return { text: "只属于当前登录账号", warning: "" };
  });
  assert.match(await response.text(), /只属于当前登录账号/);
  assert.equal(seen, 1);
});

test("a failed recognizer still does not include a point balance", async () => {
  resetOcrLock();
  const response = await handleOcrPost(formRequest(fixture("synthetic-printed-en.png"), "image/png"), user("ocr-fail"), async () => {
    throw new OcrError("识别失败。这次不扣点。", 502);
  });
  const raw = await response.text();
  assert.match(raw, /识别失败/);
  assert.match(raw, /不扣点/);
  assert.equal(raw.includes("balance"), false);
});

test("aborting recognition does not leave a temporary image directory", async () => {
  const before = new Set(readdirSync(tmpdir()).filter((name) => name.startsWith("sw-ocr-")));
  const controller = new AbortController();
  const pending = recognizeImageBytes(fixture("synthetic-printed-zh.png"), "image/png", controller.signal);
  const timer = setTimeout(() => controller.abort(), 60);
  try {
    await pending;
  } catch (error) {
    assert.match(error instanceof Error ? error.message : "", /不扣点/);
  } finally {
    clearTimeout(timer);
  }
  await new Promise((resolve) => setTimeout(resolve, 40));
  const leftover = readdirSync(tmpdir()).filter((name) => name.startsWith("sw-ocr-") && !before.has(name));
  assert.deepEqual(leftover, []);
});

test("synthetic printed fixtures: actual Tesseract output", async () => {
  const engine = await describeTesseract();
  assert.equal(engine.available, true, engine.detail);
  assert.ok(engine.languages.includes("chi_sim"));
  assert.ok(engine.languages.includes("eng"));
  const before = new Set(readdirSync(tmpdir()).filter((name) => name.startsWith("sw-ocr-")));

  const chinese = (await recognizeImageBytes(fixture("synthetic-printed-zh.png"), "image/png")).text.trim();
  const english = (await recognizeImageBytes(fixture("synthetic-printed-en.png"), "image/png")).text.trim();
  const math = (await recognizeImageBytes(fixture("synthetic-printed-math.png"), "image/png")).text.trim();
  const small = (await recognizeImageBytes(fixture("synthetic-printed-zh-small.png"), "image/png")).text.trim();
  const blank = await recognizeImageBytes(fixture("synthetic-blank.png"), "image/png");

  assert.equal(chinese, zh);
  assert.equal(english, en);
  assert.equal(math.replace(/\r/g, ""), "y=2x-4\n12+7=19");
  // Tesseract 5.3.4 chi_sim at 48px: 关 was read as 天. 18 of 19 characters match.
  assert.equal(small, "今天的作业是阅读短文并写出两个天键词。");
  assert.equal(blank.text, "");
  assert.match(blank.warning, /没有识别出文字/);

  const leftover = readdirSync(tmpdir()).filter((name) => name.startsWith("sw-ocr-") && !before.has(name));
  assert.deepEqual(leftover, []);
});
