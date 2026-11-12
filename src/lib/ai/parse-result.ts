import { ProviderError } from "@/lib/ai/deepseek";
import { compareSvg, esc, flowSvg, graphSvg, section, timelineSvg, treeSvg, val } from "@/lib/ai/shared";
import type { ToolDef } from "@/lib/tools";
import type { Section, Slide, ToolResult } from "@/lib/types";

type Raw = Record<string, unknown>;

export function presentModelResult(tool: ToolDef, input: Record<string, string>, text: string): ToolResult {
  const raw = readObject(text);
  const result = baseResult(raw, tool.name);
  if (tool.id === "ai-ppt") attachSlides(result, raw, Number(val(input, "slides", "8")) || 8);
  if (tool.id === "ai-visualize") result.diagramSvg = diagramFrom(raw, val(input, "visual", "流程图"), val(input, "concept"));
  if (tool.id === "ai-paper") mergeQuestions(result, raw, Number(val(input, "count", "6")) || 6);
  if (tool.id === "ai-variant") mergeVariants(result, raw, Number(val(input, "count", "3")) || 3);
  if (tool.id === "ai-extend") mergeExtend(result, raw);
  if (tool.id === "ai-grade") mergeGrade(result, raw, input);
  if (tool.id === "ai-analysis") mergeAnalysis(result, raw, input);
  if (tool.id === "ai-score-plan") mergePlan(result, raw, Number(val(input, "weeks", "4")) || 4, input);
  if (tool.id === "ai-word") result.docHtml = documentFrom(raw, result, input);
  assertUsable(tool, input, result, raw);
  return result;
}

function readObject(text: string): Raw {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let data: unknown;
  try {
    data = JSON.parse(fenced ? fenced[1] : trimmed);
  } catch {
    throw new ProviderError("模型没有返回可解析的 JSON。点数未扣除。", { parseError: true });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ProviderError("模型结果不是对象。点数未扣除。", { parseError: true });
  }
  return data as Raw;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
}

function baseResult(raw: Raw, fallbackTitle: string): ToolResult {
  const sections = (Array.isArray(raw.sections) ? raw.sections : [])
    .map((item, index) => normalizeSection(item, index))
    .filter((item) => (item.paragraphs?.length || 0) + (item.bullets?.length || 0) + (item.table ? 1 : 0) > 0);
  return {
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : fallbackTitle,
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle.trim() : "",
    summary: typeof raw.summary === "string" ? raw.summary.trim() : "",
    sections,
  };
}

function normalizeSection(item: unknown, index: number): Section {
  const sectionRaw = item && typeof item === "object" ? (item as Raw) : {};
  let table: Section["table"];
  if (sectionRaw.table && typeof sectionRaw.table === "object") {
    const tableRaw = sectionRaw.table as Raw;
    const headers = strings(tableRaw.headers);
    const rows = Array.isArray(tableRaw.rows)
      ? tableRaw.rows
          .filter((row): row is unknown[] => Array.isArray(row))
          .map((row) => row.map((cell) => (typeof cell === "string" || typeof cell === "number" ? String(cell) : "")))
          .filter((row) => row.some((cell) => cell.trim()))
      : [];
    if (headers.length && rows.length) table = { headers, rows };
  }
  const bullets = strings(sectionRaw.bullets);
  return {
    heading: typeof sectionRaw.heading === "string" && sectionRaw.heading.trim() ? sectionRaw.heading.trim() : `部分 ${index + 1}`,
    paragraphs: strings(sectionRaw.paragraphs),
    bullets: bullets.length ? bullets : undefined,
    table,
  };
}

function attachSlides(result: ToolResult, raw: Raw, count: number) {
  const slides = (Array.isArray(raw.slides) ? raw.slides : [])
    .map((item, index) => {
      const slide = item && typeof item === "object" ? (item as Raw) : {};
      const built: Slide = {
        kicker: typeof slide.kicker === "string" ? slide.kicker.trim() : `第 ${index + 1} 页`,
        title: typeof slide.title === "string" ? slide.title.trim() : "",
        bullets: strings(slide.bullets).slice(0, 6),
        notes: typeof slide.notes === "string" ? slide.notes.trim() : "",
      };
      return built;
    })
    .filter((slide) => slide.title && slide.bullets.length);
  if (slides.length !== count) {
    throw new ProviderError(`分页讲稿需要 ${count} 页，模型返回了 ${slides.length} 页。点数未扣除。`, { parseError: true });
  }
  result.slides = slides;
}

function diagramFrom(raw: Raw, visual: string, concept: string) {
  const diagram = raw.diagram && typeof raw.diagram === "object" ? (raw.diagram as Raw) : null;
  if (!diagram) throw new ProviderError("模型没有返回图的数据。点数未扣除。", { parseError: true });
  const title = typeof diagram.title === "string" && diagram.title.trim() ? diagram.title.trim() : concept;
  const kind = typeof diagram.kind === "string" ? diagram.kind : "";
  const expected = visual === "对比表" ? "compare" : visual === "函数图像" ? "graph" : visual === "结构图" ? "tree" : visual === "时间线" ? "timeline" : "flow";
  if (kind && kind !== expected) {
    throw new ProviderError(`图的类型应为 ${expected}，模型返回了 ${kind}。点数未扣除。`, { parseError: true });
  }
  if (expected === "graph") return graphSvg(title, Boolean(diagram.falling));
  if (expected === "compare") {
    const rows = Array.isArray(diagram.rows)
      ? diagram.rows
          .filter((row): row is unknown[] => Array.isArray(row) && row.length >= 3)
          .map((row) => [String(row[0]), String(row[1]), String(row[2])] as [string, string, string])
          .slice(0, 5)
      : [];
    if (rows.length < 2) throw new ProviderError("对比表至少需要两行。点数未扣除。", { parseError: true });
    return compareSvg(title, "先看", "再判断", rows);
  }
  if (expected === "tree") {
    const leaves = strings(diagram.leaves).slice(0, 4);
    if (leaves.length < 3) throw new ProviderError("结构图至少需要三个分支。点数未扣除。", { parseError: true });
    return treeSvg(title, leaves);
  }
  if (expected === "timeline") {
    const events = strings(diagram.events).slice(0, 4);
    if (events.length < 3) throw new ProviderError("时间线至少需要三个节点。点数未扣除。", { parseError: true });
    return timelineSvg(title, events);
  }
  const nodes = strings(diagram.nodes).slice(0, 4);
  if (nodes.length < 3) throw new ProviderError("流程图至少需要三个节点。点数未扣除。", { parseError: true });
  return flowSvg(title, nodes);
}

function mergeQuestions(result: ToolResult, raw: Raw, count: number) {
  const questions = objects(raw.questions);
  if (questions.length !== count) {
    throw new ProviderError(`试卷需要 ${count} 题，模型返回了 ${questions.length} 题。点数未扣除。`, { parseError: true });
  }
  const stems = questions.map((item, index) => {
    const options = strings(item.options);
    const points = Number(item.points) || 0;
    const type = text(item.type) || "解答";
    const stem = text(item.stem);
    if (!stem || !text(item.answer)) throw new ProviderError(`第 ${index + 1} 题缺少题干或答案。点数未扣除。`, { parseError: true });
    return `${index + 1}.（${points || "?"} 分，${type}）${stem}${options.length ? `\n${options.join("  ")}` : ""}`;
  });
  const answers = questions.map((item, index) => {
    const explanation = text(item.explanation);
    return `${index + 1}. ${text(item.answer)}${explanation ? ` ${explanation}` : ""}`;
  });
  result.sections = [
    ...result.sections.filter((item) => !/试题|参考答案/.test(item.heading)),
    section("试题", stems),
    section("参考答案", answers),
  ];
}

function mergeVariants(result: ToolResult, raw: Raw, count: number) {
  const variants = objects(raw.variants);
  if (variants.length !== count) {
    throw new ProviderError(`变式需要 ${count} 道，模型返回了 ${variants.length} 道。点数未扣除。`, { parseError: true });
  }
  const blocks = variants.map((item, index) => {
    const stem = text(item.stem);
    const answer = text(item.answer);
    if (!stem || !answer) throw new ProviderError(`变式 ${index + 1} 缺少题目或答案。点数未扣除。`, { parseError: true });
    return section(`变式 ${index + 1}`, [stem, `答案：${answer}`], { bullets: [`改了什么：${text(item.changed) || "未说明"}`] });
  });
  result.sections = [...result.sections, ...blocks];
}

function mergeExtend(result: ToolResult, raw: Raw) {
  const items = objects(raw.items);
  if (items.length !== 3) throw new ProviderError("举一反三需要正好 3 道题。点数未扣除。", { parseError: true });
  const blocks = items.map((item, index) => {
    const stem = text(item.stem);
    const answer = text(item.answer);
    if (!stem || !answer) throw new ProviderError(`第 ${index + 1} 道递进题不完整。点数未扣除。`, { parseError: true });
    return section(`${text(item.level) || ["同构", "变条件", "综合"][index]}`, [stem, `答案：${answer}`]);
  });
  result.sections = [...result.sections, ...blocks];
}

function mergeGrade(result: ToolResult, raw: Raw, input: Record<string, string>) {
  const score = Number(raw.score);
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new ProviderError("批改结果缺少 0 到 100 的整数分数。点数未扣除。", { parseError: true });
  }
  const comments = strings(raw.comments);
  const rewrite = text(raw.rewrite);
  const kind = text(raw.errorKind);
  if (comments.length < 2 || !rewrite || !/知识|审题|计算|时间|规范/.test(kind)) {
    throw new ProviderError("批改结果缺少错因、两条批注或改写。点数未扣除。", { parseError: true });
  }
  const anchor = anchorOf(val(input, "answer"));
  const blob = `${comments.join("\n")}\n${rewrite}\n${result.sections.map(flatten).join("\n")}`;
  if (anchor && !blob.includes(anchor)) {
    throw new ProviderError("批改没有引用学生作答。点数未扣除。", { parseError: true });
  }
  result.subtitle = `${result.subtitle} · ${score}/100 · ${kind}`.replace(/^ · /, "");
  result.sections = [
    section("批注", comments),
    section("错因与改写", [`错因：${kind}`, rewrite]),
    ...result.sections,
  ];
}

function mergeAnalysis(result: ToolResult, raw: Raw, input: Record<string, string>) {
  const items = objects(raw.items);
  if (!items.length) throw new ProviderError("试卷分析没有错题条目。点数未扣除。", { parseError: true });
  const rows = items.map((item) => [text(item.no) || "?", text(item.point) || "未标知识点", text(item.kind) || "审题"]);
  const priorities = strings(raw.priorities);
  result.sections = [
    ...result.sections,
    section("错题条目", [], { table: { headers: ["题号", "知识点", "错因"], rows } }),
    ...(priorities.length ? [section("优先处理", priorities)] : []),
  ];
  const score = val(input, "score");
  if (score && !flattenResult(result).includes(score)) {
    throw new ProviderError("分析没有使用卷面得分。点数未扣除。", { parseError: true });
  }
}

function mergePlan(result: ToolResult, raw: Raw, weeks: number, input: Record<string, string>) {
  const plan = objects(raw.plan);
  if (plan.length !== weeks) throw new ProviderError(`提分计划需要 ${weeks} 周，模型返回了 ${plan.length} 周。点数未扣除。`, { parseError: true });
  const rows = plan.map((item, index) => [text(item.week) || `第 ${index + 1} 周`, text(item.focus), text(item.step), text(item.check)]);
  if (rows.some((row) => row.some((cell) => !cell.trim()))) {
    throw new ProviderError("某一周的焦点、步骤或验收是空的。点数未扣除。", { parseError: true });
  }
  result.sections = [...result.sections, section("每周安排", [], { table: { headers: ["周", "焦点", "六步", "验收"], rows } })];
  const recent = val(input, "recent");
  const target = val(input, "target");
  const blob = flattenResult(result);
  if ((recent && !blob.includes(recent)) || (target && !blob.includes(target))) {
    throw new ProviderError("提分计划没有使用最近分数或目标分。点数未扣除。", { parseError: true });
  }
}

function documentFrom(raw: Raw, result: ToolResult, input: Record<string, string>) {
  const paragraphs = strings(raw.paragraphs);
  const fromSections = result.sections.flatMap((item) => item.paragraphs ?? []);
  const body = paragraphs.length ? paragraphs : fromSections;
  if (body.length < 2) throw new ProviderError("排版正文不足两段。点数未扣除。", { parseError: true });
  const anchor = anchorOf(val(input, "source"));
  if (anchor && !body.join("\n").includes(anchor)) {
    throw new ProviderError("排版没有保留用户正文中的内容。点数未扣除。", { parseError: true });
  }
  const layout = val(input, "layout") === "双栏" ? "columns-2" : "";
  const html = body.map((line) => `<p>${esc(line)}</p>`).join("");
  return `<article class="study-sheet"><p class="meta">${esc(val(input, "grade"))} · ${esc(val(input, "subject"))} · ${esc(val(input, "docType"))}</p><h1>${esc(result.title)}</h1><div class="${layout}">${html}</div><p class="foot">学习工作台 · 可打印</p></article>`;
}

function assertUsable(tool: ToolDef, input: Record<string, string>, result: ToolResult, raw: Raw) {
  if (result.sections.length < 2 || !result.summary) {
    throw new ProviderError("模型结果太短，不能当教学材料用。点数未扣除。", { parseError: true });
  }
  const blob = flattenResult(result);
  const topic = val(input, "topic") || val(input, "concept") || val(input, "scope") || val(input, "chapter") || val(input, "question") || val(input, "original") || val(input, "wrong");
  const anchor = anchorOf(topic);
  if (anchor && tool.id !== "ai-word" && tool.id !== "ai-grade" && !blob.includes(anchor) && !JSON.stringify(raw).includes(anchor)) {
    throw new ProviderError("结果没有贴住用户给出的课题或题目。点数未扣除。", { parseError: true });
  }
  if (tool.id === "ai-lesson" && !result.sections.some((item) => item.table)) {
    throw new ProviderError("课堂脚本缺少时间表。点数未扣除。", { parseError: true });
  }
  if (tool.id === "ai-explain") {
    const questionAnchor = anchorOf(val(input, "question"));
    if (questionAnchor && !blob.includes(questionAnchor)) {
      throw new ProviderError("讲题稿没有对照原题。点数未扣除。", { parseError: true });
    }
  }
}

function objects(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Raw => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function flatten(item: Section) {
  return [item.heading, ...(item.paragraphs ?? []), ...(item.bullets ?? []), ...(item.table?.rows.flat() ?? [])].join("\n");
}

function flattenResult(result: ToolResult) {
  return [result.title, result.subtitle, result.summary, ...result.sections.map(flatten), ...(result.slides ?? []).flatMap((slide) => [slide.title, ...slide.bullets, slide.notes])].join("\n");
}

function anchorOf(value: string) {
  const chunks = value.match(/[\u4e00-\u9fa5A-Za-z0-9]{4,12}/g);
  if (!chunks?.length) return "";
  return [...chunks].sort((left, right) => right.length - left.length)[0].slice(0, 8);
}
