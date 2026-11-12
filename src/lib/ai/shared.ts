import type { GradeBand, Section } from "@/lib/types";

export { flowSvg, compareSvg, graphSvg, treeSvg, timelineSvg, unsupportedGraphSvg } from "@/lib/ai/diagrams";
export { parseLinear, resolveFunctionGraph, formatLinear } from "@/lib/ai/formula";

export function esc(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function clip(value: string, length = 72) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export function val(input: Record<string, string>, key: string, fallback = "") {
  return (input[key] ?? "").trim() || fallback;
}

export function bandOf(grade: string): GradeBand {
  if (grade.startsWith("高")) return "senior";
  if (grade.startsWith("初")) return "junior";
  return "primary";
}

export function voice(grade: string) {
  const band = bandOf(grade);
  if (band === "primary") return { band, learner: "孩子", adult: "家长", check: "孩子能不看稿子说一遍" };
  if (band === "junior") return { band, learner: "学生", adult: "家长", check: "家长只核对错因和明天的第一步" };
  return { band, learner: "学生", adult: "家长", check: "对照评分标准，不重做整套" };
}

export function num(value: string, fallback: number) {
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function section(heading: string, paragraphs: string[] = [], extra?: { bullets?: string[]; table?: Section["table"] }): Section {
  return { heading, paragraphs, bullets: extra?.bullets, table: extra?.table };
}

export function demoScore(answer: string) {
  const text = answer.trim();
  let score = 58;
  if (text.length >= 20) score += 8;
  if (text.length >= 60) score += 8;
  if (text.length >= 140) score += 6;
  if (/因为|所以|首先|然后|因此|步骤|答/.test(text)) score += 8;
  if (/不知道|不会|忘了|不确定/.test(text)) score -= 6;
  if (text.length < 12) score = 50;
  return Math.max(45, Math.min(95, score));
}

export function guessKind(text: string) {
  if (/计算|符号|算错|绝对值/.test(text)) return "计算";
  if (/时间|没写完|来不及/.test(text)) return "时间";
  if (/单位|格式|步骤|答句|规范/.test(text)) return "规范";
  if (/审题|看错|范围|象限|问法/.test(text)) return "审题";
  if (/不会|知识|概念|公式|忘/.test(text)) return "知识";
  return "审题";
}

export function methodLine(subject: string, topic: string) {
  if (subject === "数学") return `做「${topic}」时，先把关系和符号写出来，再计算。`;
  if (subject === "语文") return `写「${topic}」时，答案要能指回原文的一句。`;
  if (subject === "英语") return `做「${topic}」时，先在题干里圈出要找的词。`;
  return `处理「${topic}」时，先写条件，再写结论。`;
}
