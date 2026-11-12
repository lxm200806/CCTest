import assert from "node:assert/strict";
import test from "node:test";
import { readScheduleMinutes } from "@/lib/ai/schedule";
import { mockGenerate } from "@/lib/ai/mock";
import { presentModelResult } from "@/lib/ai/parse-result";
import { runPaidGeneration, resetGenerationLock } from "@/lib/ai/run-paid";
import { resolveFunctionGraph } from "@/lib/ai/formula";
import { ownedGeneration } from "@/lib/export/owned";
import { TOOLS, getTool, normalizeInput } from "@/lib/tools";
import type { GenerationRecord, ToolResult } from "@/lib/types";

// 夹具和本地示例。不调用在线模型，也不把通过当成教学正确。

test("every tool rejects an empty required field and an overlong field", () => {
  for (const tool of TOOLS) {
    const field = tool.fields.find((item) => item.required && item.type !== "select");
    assert.ok(field, tool.id);
    const missing = { ...tool.example, [field.name]: "   " };
    const tooLong = { ...tool.example, [field.name]: "字".repeat(8001) };
    assert.equal(normalizeInput(tool, missing).ok, false, tool.id);
    assert.equal(normalizeInput(tool, tooLong).ok, false, tool.id);
    assert.equal(normalizeInput(tool, tool.example).ok, true, tool.id);
  }
});

test("primary local examples stay short for Chinese, English, and math", () => {
  const lesson = mockGenerate("ai-lesson", { grade: "二年级", subject: "语文", topic: "比喻句", duration: "20", style: "讲解型" });
  assert.match(JSON.stringify(lesson.sections), /用一句话说「比喻句」/);
  const schedule = readScheduleMinutes(lesson.sections);
  assert.equal(schedule.ok && schedule.minutes, 20);

  const math = mockGenerate("ai-paper", { grade: "一年级", subject: "数学", scope: "10以内加法", count: "6", difficulty: "基础为主", minutes: "20" });
  const mathText = JSON.stringify(math);
  assert.equal(/y\s*=/.test(mathText), false);
  assert.match(mathText, /加/);
  assert.match(math.subtitle, /100 分/);
  assert.equal(math.sections.find((item) => item.heading === "试题")?.paragraphs?.length, 6);

  const handout = mockGenerate("ai-handout", { grade: "一年级", subject: "数学", topic: "加法", depth: "基础" });
  assert.equal(/y\s*=/.test(JSON.stringify(handout)), false);
  const extend = mockGenerate("ai-extend", { grade: "一年级", subject: "数学", wrong: "3 加 2 写成了 1。", reason: "把加号看成了减号" });
  assert.equal(/y\s*=/.test(JSON.stringify(extend)), false);
  const aid = mockGenerate("ai-teaching-aid", { grade: "一年级", subject: "数学", chapter: "加法", pages: "1", answers: "印在页内" });
  assert.equal(aid.sections.some((item) => item.heading.includes("练习")), false);

  const english = mockGenerate("ai-paper", { grade: "三年级", subject: "英语", scope: "animals", count: "6", difficulty: "基础为主", minutes: "20" });
  assert.equal(/evidence/.test(JSON.stringify(english)), false);

  const chinese = mockGenerate("ai-paper", { grade: "一年级", subject: "语文", scope: "春天", count: "6", difficulty: "基础为主", minutes: "20" });
  assert.match(JSON.stringify(chinese), /用一句话|读一读/);

  const preview = mockGenerate("ai-preview", { grade: "一年级", subject: "语文", topic: "春天", minutes: "10" });
  assert.match(preview.summary, /家长/);
  assert.match(JSON.stringify(preview), /10/);
});

test("validators reject empty, inconsistent, and unsupported fixture outputs", () => {
  const lesson = getTool("ai-lesson");
  const handout = getTool("ai-handout");
  const aid = getTool("ai-teaching-aid");
  const preview = getTool("ai-preview");
  const paper = getTool("ai-paper");
  const word = getTool("ai-word");
  const extend = getTool("ai-extend");
  const analysis = getTool("ai-analysis");
  const plan = getTool("ai-score-plan");
  assert.ok(lesson && handout && aid && preview && paper && word && extend && analysis && plan);

  assert.throws(() => presentModelResult(lesson, lesson.example, JSON.stringify({ title: "空", summary: "", sections: [] })), /点数未扣除/);
  assert.throws(() => presentModelResult(handout, handout.example, base(handout.example.topic ?? "", [
    section("概念", "一次函数的解析式先看条件。"),
    section("答案", "先写了答案。"),
    section("练习", "再写练习。"),
  ])), /练习/);
  assert.throws(() => presentModelResult(aid, { ...aid.example, pages: "1" }, base(aid.example.chapter ?? "", [
    section("分页", "一页。", { headers: ["页", "作用", "内容"], rows: [["第 1 页", "练习页", "做题"]] }),
    section("知识页正文", "只讲定义。"),
  ])), /练习页/);
  assert.throws(() => presentModelResult(preview, preview.example, base(preview.example.topic ?? "", [
    section("先知道的三件事", "先看课题。"),
    section("带到课堂上的一句", "我还不知道。"),
  ])), /分钟/);
  assert.throws(() => presentModelResult(paper, paper.example, JSON.stringify({
    title: paper.example.scope,
    summary: "建议 20 分钟。",
    sections: [section("作答说明", "先做再对。"), section("范围", paper.example.scope ?? "")],
    questions: [question("太少")],
  })), /6 题|需要 6/);
  assert.throws(() => presentModelResult(word, { ...word.example, source: "最近一次小练 78 分。\n\n请看这一句。" }, JSON.stringify({
    title: word.example.title,
    summary: "排好了。",
    sections: [section("正文", "最近一次小练 80 分。"), section("附记", "请看这一句。")],
    paragraphs: ["最近一次小练 80 分。", "请看这一句。"],
  })), /78/);
  assert.throws(() => presentModelResult(extend, extend.example, base(extend.example.wrong ?? "", [
    section("错因", "另外一个错法。"),
    section("方法", "先重做。"),
  ], { items: [{ level: "同构", stem: "新题", answer: "1" }, { level: "变条件", stem: "新题", answer: "2" }, { level: "综合", stem: "新题", answer: "3" }] })), /错法/);
  assert.throws(() => presentModelResult(analysis, { ...analysis.example, score: "90", total: "80" }, base("90", [
    section("得分结构", "得分 90，满分 80。"),
    section("错因分布", "计算较多。"),
    section("明天的一步", "先订正。"),
  ], { items: [{ no: "1", point: "计算", kind: "计算" }] })), /异常/);
  assert.throws(() => presentModelResult(plan, { ...plan.example, recent: "40", target: "80", weeks: "4" }, base("40", [
    section("缺口", "四周提到 80。"),
    section("说明", "按周执行。"),
  ], { plan: weeks("计算") })), /改近/);
  assert.equal(resolveFunctionGraph("一次函数 y=kx+b 的图像").status, "unsupported");
});

test("a failed analysis fixture does not charge, and another user cannot own the record", async () => {
  resetGenerationLock();
  const analysis = getTool("ai-analysis");
  assert.ok(analysis);
  let spent = 0;
  const response = await runPaidGeneration({
    user: { id: "usr_matrix", username: "matrix", displayName: "测试", credits: 8 },
    body: { toolId: analysis.id, input: { ...analysis.example, score: "90", total: "80" } },
    generate: async (tool, input) => {
      presentModelResult(tool, input, base("90", [
        section("得分结构", "得分 90，满分 80。"),
        section("错因分布", "计算较多。"),
        section("明天的一步", "先订正。"),
      ], { items: [{ no: "1", point: "计算", kind: "计算" }] }));
      return { result: emptyResult(), source: "mock" };
    },
    spend: async () => {
      spent += 1;
      return null;
    },
    present: (record) => record,
  });
  assert.equal(response.status, 502);
  assert.equal(spent, 0);
  const mine = ownedGeneration([sampleRecord("usr_me"), sampleRecord("usr_other")], "usr_me", "gen_other");
  assert.equal(mine, null);
});

function section(heading: string, text: string, extra?: { headers?: string[]; rows?: string[][]; items?: unknown; plan?: unknown }) {
  return {
    heading,
    paragraphs: [text],
    ...(extra?.headers ? { table: { headers: extra.headers, rows: extra.rows ?? [] } } : {}),
  };
}

function base(topic: string, sections: ReturnType<typeof section>[], extra: Record<string, unknown> = {}) {
  return JSON.stringify({ title: topic, subtitle: "测试", summary: `围绕${topic}。`, sections, ...extra });
}

function question(stem: string) {
  return { type: "解答", stem, options: [], answer: "1", points: 10, explanation: "一步。" };
}

function weeks(focus: string) {
  return [1, 2, 3, 4].map((week) => ({ week: `第 ${week} 周`, focus, step: "精讲过关", check: "能讲清" }));
}

function emptyResult(): ToolResult {
  return { title: "空", subtitle: "", summary: "空", sections: [] };
}

function sampleRecord(userId: string): GenerationRecord {
  return { id: userId === "usr_me" ? "gen_me" : "gen_other", userId, toolId: "ai-ppt", toolName: "AIPPT", source: "mock", createdAt: "2026-11-12T05:45:00.000Z", input: {}, result: emptyResult() };
}
