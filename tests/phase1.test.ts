import assert from "node:assert/strict";
import test from "node:test";
import { isRepairable, ProviderError } from "@/lib/ai/errors";
import { formatLinear, parseLinear, resolveFunctionGraph } from "@/lib/ai/formula";
import { graphSvg, treeSvg, unsupportedGraphSvg } from "@/lib/ai/diagrams";
import { mockGenerate } from "@/lib/ai/mock";
import { presentModelResult } from "@/lib/ai/parse-result";
import { readScheduleMinutes } from "@/lib/ai/schedule";
import { resetGenerationLock, runPaidGeneration } from "@/lib/ai/run-paid";
import { readDraft, writeDraft } from "@/lib/drafts";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { createSingleFlight } from "@/lib/submit-guard";
import { fieldIssues, getTool, normalizeInput, TOOLS } from "@/lib/tools";
import type { GenerationRecord, PublicUser, ToolResult } from "@/lib/types";

// 这些用例使用确定性夹具和本地示例，不调用在线模型。

test("parseLinear keeps a concrete line when the question also says y = 0", () => {
  const parsed = parseLinear("一次函数 y = 2x - 4。\n（2）当 y = 0 时，x 是多少？");
  assert.deepEqual(parsed, { k: 2, b: -4 });
});

test("supported lines keep slope sign and a nonzero intercept", () => {
  const rising = graphSvg("一次函数 y=2x-4", { k: 2, b: -4 });
  assertOnLine(rising, 2, -4);
  assert.equal(attr(rising, "data-k"), "2");
  assert.equal(attr(rising, "data-b"), "-4");
  assert.match(rising, /\(0, -4\)/);
  assert.match(rising, /\(2, 0\)/);
  assert.match(rising, /data-axis="x"/);
  assert.match(rising, /data-axis="y"/);
  assert.match(rising, /data-ticks="x"/);
  assert.equal(attr(rising, "data-exact"), "true");

  const falling = graphSvg("一次函数 y=-2x+6", { k: -2, b: 6 });
  assertOnLine(falling, -2, 6);
  assert.match(falling, /\(0, 6\)/);
  assert.match(falling, /\(3, 0\)/);
  assert.equal(formatLinear({ k: -2, b: 6 }), "y = -2x + 6");
});

test("large intercepts stay inside a finite window and do not invent another line", () => {
  const svg = graphSvg("y=2x+80", { k: 2, b: 80 });
  const box = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  assert.ok(box);
  assert.ok(Number(box[1]) <= 900);
  assert.ok(Number(box[2]) <= 1600);
  assert.doesNotMatch(svg, /NaN|Infinity/);
  if (svg.includes('data-role="function"')) assertOnLine(svg, 2, 80);
  assert.match(svg, /超出当前坐标窗口|纵截距/);
});

test("unsupported or ambiguous formulas are not drawn as an exact line", () => {
  for (const concept of ["一次函数 y=kx+b 的图像", "y=x^2+1", "比较 y=2x+1 与 y=-x+4", "y=1/2x+3"]) {
    const verdict = resolveFunctionGraph(concept);
    assert.equal(verdict.status, "unsupported");
    const svg = unsupportedGraphSvg(concept, verdict.status === "unsupported" ? verdict.reason : "");
    assert.equal(attr(svg, "data-exact"), "false");
    assert.doesNotMatch(svg, /data-role="function"/);
    assert.match(svg, /不能把这个概念画成一条确定的直线/);
    assert.doesNotMatch(svg, /120,340 280,250 460,150 640,70/);
  }
});

test("model falling flag cannot replace the parsed slope", () => {
  const tool = getTool("ai-visualize");
  assert.ok(tool);
  const concept = "一次函数 y=-3x+6 的图像";
  const result = presentModelResult(tool, { grade: "初二", subject: "数学", concept, visual: "函数图像" }, JSON.stringify(visualPayload(concept, { kind: "graph", falling: false })));
  assert.match(result.diagramSvg ?? "", /data-k="-3"/);
  assert.match(result.diagramSvg ?? "", /data-b="6"/);
  assertOnLine(result.diagramSvg ?? "", -3, 6);

  const symbolic = presentModelResult(
    tool,
    { grade: "初二", subject: "数学", concept: "一次函数 y=kx+b 的图像", visual: "函数图像" },
    JSON.stringify(visualPayload("一次函数 y=kx+b 的图像", { kind: "graph", falling: true })),
  );
  assert.match(symbolic.diagramSvg ?? "", /data-exact="false"/);
  assert.doesNotMatch(symbolic.diagramSvg ?? "", /data-role="function"/);
});

test("structure diagrams keep long titles and more than four branches", () => {
  const title = "一次函数图像与性质中斜率符号、纵截距和坐标轴交点应该怎样读给学生听";
  const leaves = ["斜率为正时向右上", "斜率为负时向右下", "纵截距就是与y轴的交点", "横截距令y等于0", "先写解析式再描点", "最后用一句口语收束"];
  const svg = treeSvg(title, leaves);
  const text = svg.replace(/<[^>]+>/g, "");
  assert.ok(text.includes(title));
  for (const leaf of leaves) assert.ok(text.includes(leaf), leaf);
  assert.doesNotMatch(text, /…/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /class="diagram-tree"/);
  assert.match(svg, /aria-label="/);
  assert.doesNotMatch(svg, /…/);

  const tool = getTool("ai-visualize");
  assert.ok(tool);
  const result = presentModelResult(
    tool,
    { grade: "初二", subject: "数学", concept: title, visual: "结构图" },
    JSON.stringify({
      ...visualPayload(title, { kind: "tree", title, leaves }),
    }),
  );
  const rendered = (result.diagramSvg ?? "").replace(/<[^>]+>/g, "");
  assert.ok(rendered.includes(title));
  assert.equal(leaves.every((leaf) => rendered.includes(leaf)), true);
});

test("exam analysis keeps one wrong-question table and the other analysis", () => {
  const tool = getTool("ai-analysis");
  assert.ok(tool);
  const result = presentModelResult(tool, analysisInput(), JSON.stringify(analysisPayload()));
  const wrongTables = result.sections.filter((section) => section.table && section.table.headers.includes("题号"));
  assert.equal(wrongTables.length, 1);
  const rows = wrongTables[0]?.table?.rows ?? [];
  assert.deepEqual(rows, [
    ["12", "求解析式", "计算"],
    ["15", "图像过象限", "审题"],
    ["18", "方案选择", "知识"],
    ["21", "应用题单位", "规范"],
  ]);
  assert.equal(rows.filter((row) => row[0] === "12").length, 1);
  assert.ok(result.sections.some((section) => section.heading === "得分结构" && section.paragraphs?.some((line) => line.includes("78"))));
  assert.ok(result.sections.some((section) => section.heading === "错因分布" && section.table?.headers.includes("条数")));
  assert.ok(result.sections.some((section) => section.paragraphs?.includes("计算集中在求解析式。")));
  assert.ok(result.sections.some((section) => section.heading === "明天的一步"));
});

test("lesson schedule accepts the real minutes, including a total row, and rejects a mismatch", () => {
  const tool = getTool("ai-lesson");
  assert.ok(tool);
  const topic = "一次函数的图像与性质";
  const input = { grade: "初二", subject: "数学", topic, duration: "40", style: "讲解型" };
  const correct = presentModelResult(tool, input, JSON.stringify(lessonPayload(topic, [
    ["导入", "0–10 分钟", "引出图像"],
    ["探究", "10-25 分钟", "看 k 的符号"],
    ["练习", "25～40 分钟", "求截距"],
    ["合计", "40", "整节"],
  ], [
    ["题号", "分值"],
    ["1", "20"],
    ["2", "25"],
  ])));
  assert.ok(correct.sections.some((section) => section.heading === "时间安排"));

  assert.throws(
    () => presentModelResult(tool, input, JSON.stringify(lessonPayload(topic, [
      ["导入", "10", "引出"],
      ["探究", "10", "观察"],
      ["练习", "10", "上台"],
    ]))),
    (error: unknown) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(isRepairable(error), true);
      assert.match(error.message, /30/);
      assert.match(error.message, /40/);
      assert.match(error.message, /点数未扣除/);
      return true;
    },
  );

  const read = readScheduleMinutes(correct.sections);
  assert.equal(read.ok && read.minutes, 40);
});

test("local lesson examples sum to the requested minutes", () => {
  const tool = getTool("ai-lesson");
  assert.ok(tool);
  for (const duration of ["20", "40", "45"]) {
    const result = mockGenerate("ai-lesson", { ...tool.example, duration });
    const read = readScheduleMinutes(result.sections);
    assert.equal(read.ok, true, duration);
    if (read.ok) assert.equal(read.minutes, Number(duration));
  }
});

test("local visualize example plots y=2x-4 instead of a generic rising line", () => {
  const tool = getTool("ai-visualize");
  assert.ok(tool);
  const result = mockGenerate("ai-visualize", tool.example);
  assert.match(result.diagramSvg ?? "", /data-k="2"/);
  assert.match(result.diagramSvg ?? "", /data-b="-4"/);
  assertOnLine(result.diagramSvg ?? "", 2, -4);
});

test("invalid generation does not spend credits, including schedule mismatch and provider failure", async () => {
  resetGenerationLock();
  const lesson = getTool("ai-lesson");
  assert.ok(lesson);
  const spend = tracker();
  const mismatch = await runPaidGeneration({
    user: user("u-mismatch", 10),
    body: { toolId: "ai-lesson", input: { ...lesson.example, duration: "40" } },
    generate: async (tool, input) => {
      presentModelResult(tool, input, JSON.stringify(lessonPayload(input.topic, [["导入", "10", "只讲了十分钟"]])));
      return { result: emptyResult(), source: "mock" };
    },
    spend: spend.spend,
    present: (record) => record,
  });
  assert.equal(mismatch.status, 502);
  assert.match((await mismatch.json()).error, /点数未扣除/);
  assert.equal(spend.calls, 0);

  const failed = await runPaidGeneration({
    user: user("u-down", 10),
    body: { toolId: "ai-lesson", input: lesson.example },
    generate: async () => {
      throw new ProviderError("模型接口没有连上。点数未扣除。");
    },
    spend: spend.spend,
    present: (record) => record,
  });
  assert.equal(failed.status, 502);
  assert.equal(spend.calls, 0);

  const broken = await runPaidGeneration({
    user: user("u-broken", 10),
    body: { toolId: "ai-lesson", input: lesson.example },
    generate: async () => {
      throw new Error("意外中断");
    },
    spend: spend.spend,
    present: (record) => record,
  });
  assert.equal(broken.status, 500);
  assert.match((await broken.json()).error, /点数未扣除/);
  assert.equal(spend.calls, 0);
});

test("input validation and a second submit do not call the model twice or spend twice", async () => {
  resetGenerationLock();
  const lesson = getTool("ai-lesson");
  assert.ok(lesson);
  let generates = 0;
  const spend = tracker();
  const missing = await runPaidGeneration({
    user: user("u-missing", 8),
    body: { toolId: "ai-lesson", input: { ...lesson.example, topic: "  " } },
    generate: async () => {
      generates += 1;
      return { result: emptyResult(), source: "mock" };
    },
    spend: spend.spend,
    present: (record) => record,
  });
  assert.equal(missing.status, 400);
  assert.match((await missing.json()).error, /课题/);
  assert.equal(generates, 0);

  const poor = await runPaidGeneration({
    user: user("u-poor", 1),
    body: { toolId: "ai-lesson", input: lesson.example },
    generate: async () => {
      generates += 1;
      return { result: emptyResult(), source: "mock" };
    },
    spend: spend.spend,
    present: (record) => record,
  });
  assert.equal(poor.status, 402);
  assert.equal(generates, 0);

  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const running = runPaidGeneration({
    user: user("u-double", 8),
    body: { toolId: "ai-lesson", input: lesson.example },
    generate: async () => {
      generates += 1;
      await gate;
      return { result: lessonResult(), source: "mock" };
    },
    spend: spend.spend,
    present: (record) => ({ id: record.id }),
  });
  const duplicate = await runPaidGeneration({
    user: user("u-double", 8),
    body: { toolId: "ai-preview", input: getTool("ai-preview")?.example },
    generate: async () => {
      generates += 1;
      return { result: emptyResult(), source: "mock" };
    },
    spend: spend.spend,
    present: (record) => record,
  });
  assert.equal(duplicate.status, 409);
  assert.match((await duplicate.json()).error, /没有重复提交/);
  release();
  const first = await running;
  assert.equal(first.status, 200);
  assert.equal(generates, 1);
  assert.equal(spend.calls, 1);
});

test("field checks name the missing or invalid input and accept every tool example", () => {
  const lesson = getTool("ai-lesson");
  assert.ok(lesson);
  assert.deepEqual(fieldIssues(lesson, { ...lesson.example, topic: "" }).map((issue) => issue.message), ["请填写课题"]);
  const analysis = getTool("ai-analysis");
  assert.ok(analysis);
  assert.match(fieldIssues(analysis, { ...analysis.example, score: "七十八" })[0]?.message ?? "", /得分/);
  assert.equal(normalizeInput(lesson, { ...lesson.example, style: "不存在" }).ok, false);
  for (const tool of TOOLS) {
    const normalized = normalizeInput(tool, tool.example);
    assert.equal(normalized.ok, true, tool.id);
  }
});

test("drafts round-trip and a second click is ignored while the first is running", () => {
  const storage = new Map<string, string>();
  const memory = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  };
  writeDraft(memory, "ai-lesson", { topic: "一次函数", note: "x".repeat(9000) });
  const saved = readDraft(memory, "ai-lesson");
  assert.equal(saved?.topic, "一次函数");
  assert.equal(saved?.note?.length, 8000);
  assert.equal(readDraft({ getItem: () => "{" }, "ai-lesson"), null);

  const flight = createSingleFlight();
  assert.equal(flight.start(), true);
  assert.equal(flight.start(), false);
  flight.finish();
  assert.equal(flight.start(), true);
});

test("rendered svg and html drop scripts but keep the graph", () => {
  const svg = graphSvg("y=2x-4", { k: 2, b: -4 });
  const dirty = `${svg}<script>alert(1)</script><p onclick="alert(1)" href="javascript:alert(1)">说明</p>`;
  const clean = sanitizeRichHtml(dirty);
  assert.match(clean, /data-role="function"/);
  assert.doesNotMatch(clean, /script|onclick|javascript:/i);
});

function attr(svg: string, name: string) {
  const matched = svg.match(new RegExp(`${name}="([^"]*)"`));
  assert.ok(matched, name);
  return matched[1];
}

function assertOnLine(svg: string, k: number, b: number) {
  const line = svg.match(/data-role="function" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/);
  assert.ok(line, svg.slice(0, 180));
  const [x1, y1, x2, y2] = line.slice(1).map(Number);
  const x0 = Number(attr(svg, "data-x0"));
  const x1w = Number(attr(svg, "data-x1"));
  const y0 = Number(attr(svg, "data-y0"));
  const y1w = Number(attr(svg, "data-y1"));
  const [left, top, right, bottom] = attr(svg, "data-plot").split(",").map(Number);
  const mathX = (px: number) => x0 + ((px - left) / (right - left)) * (x1w - x0);
  const mathY = (py: number) => y0 + ((bottom - py) / (bottom - top)) * (y1w - y0);
  for (const [px, py] of [
    [x1, y1],
    [x2, y2],
  ]) {
    assert.ok(Math.abs(mathY(py) - (k * mathX(px) + b)) < 0.05, `${mathY(py)} vs ${k * mathX(px) + b}`);
  }
  const pixelSlope = (y2 - y1) / (x2 - x1);
  if (k > 0) assert.ok(pixelSlope < 0, `pixel slope ${pixelSlope}`);
  if (k < 0) assert.ok(pixelSlope > 0, `pixel slope ${pixelSlope}`);
}

function visualPayload(concept: string, diagram: Record<string, unknown>) {
  return {
    title: concept,
    subtitle: "初二 数学",
    summary: `先看${concept}。`,
    sections: [
      { heading: "怎么读", paragraphs: [`围绕${concept}读图。`] },
      { heading: "讲的时候停在哪", paragraphs: ["停在截距。"] },
    ],
    diagram,
  };
}

function analysisInput() {
  return {
    grade: "初二",
    subject: "数学",
    paper: "期中数学",
    score: "78",
    total: "100",
    usedMinutes: "90",
    wrongs: "12|求解析式|计算",
  };
}

function analysisPayload() {
  return {
    title: "期中数学分析",
    subtitle: "初二 数学",
    summary: "卷面得分 78，先处理计算。",
    sections: [
      { heading: "得分结构", paragraphs: ["卷面得分 78，满分 100。"] },
      {
        heading: "错题表",
        paragraphs: ["计算集中在求解析式。"],
        table: {
          headers: ["题号", "知识点", "错因"],
          rows: [
            ["12", "求解析式", "计算"],
            ["15", "图像过象限", "审题"],
            ["21", "应用题单位", "规范"],
          ],
        },
      },
      { heading: "错因分布", paragraphs: ["计算出现得最多。"], table: { headers: ["错因", "条数"], rows: [["计算", "1"], ["审题", "1"]] } },
      { heading: "明天的一步", paragraphs: ["先订正第 12 题的符号。"] },
    ],
    items: [
      { no: "12", point: "求解析式", kind: "计算" },
      { no: "15", point: "图像过象限", kind: "审题" },
      { no: "18", point: "方案选择", kind: "知识" },
    ],
    priorities: ["先处理计算"],
  };
}

function lessonPayload(topic: string, rows: string[][], unrelated?: string[][]) {
  return {
    title: `${topic}课堂脚本`,
    subtitle: "初二 数学",
    summary: `这一节讲${topic}。`,
    sections: [
      { heading: "学习目标", paragraphs: [`课题是${topic}。`] },
      ...(unrelated ? [{ heading: "练习分值", paragraphs: ["这些分数不是课时。"], table: { headers: unrelated[0], rows: unrelated.slice(1) } }] : []),
      { heading: "时间安排", table: { headers: ["段落", "分钟", "做什么"], rows } },
      { heading: "教师口述", paragraphs: [`今天只看${topic}。`] },
      { heading: "检查题", paragraphs: [`解释${topic}。`] },
    ],
  };
}

function user(id: string, credits: number): PublicUser {
  return { id, username: id, displayName: "测试", credits };
}

function tracker() {
  const state = { calls: 0 };
  return {
    get calls() {
      return state.calls;
    },
    async spend(input: { result: ToolResult; userId: string; cost: number; toolId: string; toolName: string; source: GenerationRecord["source"]; fields: Record<string, string> }) {
      state.calls += 1;
      const record: GenerationRecord = {
        id: "gen_test",
        userId: input.userId,
        toolId: input.toolId,
        toolName: input.toolName,
        source: input.source,
        createdAt: "2026-01-01T00:00:00.000Z",
        input: input.fields,
        result: input.result,
      };
      return { balance: 6, record };
    },
  };
}

function emptyResult(): ToolResult {
  return { title: "空", subtitle: "", summary: "空", sections: [] };
}

function lessonResult(): ToolResult {
  return {
    title: "一次函数的图像与性质",
    subtitle: "初二 数学",
    summary: "可以上课。",
    sections: [
      { heading: "目标", paragraphs: ["说出截距。"] },
      { heading: "时间安排", table: { headers: ["段落", "分钟", "做什么"], rows: [["整节", "40", "讲完"]] } },
    ],
  };
}
