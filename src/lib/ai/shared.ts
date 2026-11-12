import type { GradeBand, Section } from "@/lib/types";

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

export function parseLinear(text: string) {
  const compact = text.replace(/\s+/g, "");
  const matched = compact.match(/y=([+-]?\d*)x([+-]\d+)?/i);
  if (!matched) return null;
  const raw = matched[1];
  const k = raw === "" || raw === "+" ? 1 : raw === "-" ? -1 : Number(raw);
  const b = matched[2] ? Number(matched[2]) : 0;
  if (!Number.isFinite(k) || !Number.isFinite(b) || k === 0) return null;
  return { k, b };
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

export function flowSvg(title: string, nodes: string[]) {
  const boxes = nodes
    .map((node, index) => {
      const x = 36 + index * 172;
      const arrow = index < nodes.length - 1 ? `<path d="M${x + 132} 168 H${x + 160}" stroke="#9a3e22" stroke-width="2"/>` : "";
      return `<rect x="${x}" y="132" width="128" height="72" rx="10" fill="#fffdf8" stroke="#1f4d42"/><text x="${x + 64}" y="174" text-anchor="middle" font-size="15" fill="#1c1915">${esc(node)}</text>${arrow}`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 420" role="img"><rect width="720" height="420" fill="#f7f3ea"/><text x="36" y="56" font-size="22" fill="#1c1915">${esc(clip(title, 28))}</text><text x="36" y="86" font-size="14" fill="#5e564c">从左到右读，一次只停在一个格子</text>${boxes}</svg>`;
}

export function compareSvg(title: string, left: string, right: string, rows: [string, string, string][]) {
  const body = rows
    .map((row, index) => {
      const y = 150 + index * 48;
      return `<text x="48" y="${y}" font-size="14" fill="#5e564c">${esc(row[0])}</text><text x="220" y="${y}" font-size="15" fill="#1c1915">${esc(row[1])}</text><text x="470" y="${y}" font-size="15" fill="#1c1915">${esc(row[2])}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 420" role="img"><rect width="720" height="420" fill="#f7f3ea"/><text x="36" y="52" font-size="22" fill="#1c1915">${esc(clip(title, 26))}</text><rect x="190" y="78" width="220" height="40" rx="8" fill="#1f4d42"/><rect x="440" y="78" width="220" height="40" rx="8" fill="#9a3e22"/><text x="300" y="104" text-anchor="middle" font-size="16" fill="#f6f1e6">${esc(left)}</text><text x="550" y="104" text-anchor="middle" font-size="16" fill="#f6f1e6">${esc(right)}</text>${body}</svg>`;
}

export function graphSvg(title: string, falling: boolean) {
  const line = falling ? "120,70 280,180 460,280 640,360" : "120,340 280,250 460,150 640,70";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 420" role="img"><rect width="720" height="420" fill="#fffdf8"/><text x="36" y="42" font-size="20" fill="#1c1915">${esc(clip(title, 32))}</text><line x1="70" y1="40" x2="70" y2="360" stroke="#1c1915"/><line x1="70" y1="360" x2="680" y2="360" stroke="#1c1915"/><polyline points="${line}" fill="none" stroke="#1f4d42" stroke-width="3"/><text x="36" y="398" font-size="13" fill="#5e564c">${falling ? "线向右下，y 随 x 增大而减小" : "线向右上，y 随 x 增大而增大"}</text></svg>`;
}

export function treeSvg(title: string, leaves: string[]) {
  const nodes = leaves
    .map((leaf, index) => {
      const x = 70 + index * 160;
      return `<line x1="360" y1="150" x2="${x + 60}" y2="230" stroke="#e0d3be"/><rect x="${x}" y="230" width="130" height="52" rx="8" fill="#fffdf8" stroke="#1f4d42"/><text x="${x + 65}" y="262" text-anchor="middle" font-size="14" fill="#1c1915">${esc(leaf)}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 420" role="img"><rect width="720" height="420" fill="#f7f3ea"/><rect x="250" y="96" width="220" height="54" rx="10" fill="#1f4d42"/><text x="360" y="129" text-anchor="middle" font-size="16" fill="#f6f1e6">${esc(clip(title, 14))}</text>${nodes}</svg>`;
}

export function timelineSvg(title: string, events: string[]) {
  const dots = events
    .map((event, index) => {
      const x = 90 + index * 155;
      return `<circle cx="${x}" cy="180" r="7" fill="#9a3e22"/><text x="${x}" y="220" text-anchor="middle" font-size="13" fill="#1c1915">${esc(event)}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 420" role="img"><rect width="720" height="420" fill="#fffdf8"/><text x="36" y="56" font-size="22" fill="#1c1915">${esc(clip(title, 28))}</text><line x1="70" y1="180" x2="660" y2="180" stroke="#1f4d42" stroke-width="2"/>${dots}</svg>`;
}

export function methodLine(subject: string, topic: string) {
  if (subject === "数学") return `做「${topic}」时，先把关系和符号写出来，再计算。`;
  if (subject === "语文") return `写「${topic}」时，答案要能指回原文的一句。`;
  if (subject === "英语") return `做「${topic}」时，先在题干里圈出要找的词。`;
  return `处理「${topic}」时，先写条件，再写结论。`;
}
