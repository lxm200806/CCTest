export type LinearFn = { k: number; b: number };

export type FormulaVerdict =
  | { status: "exact"; fn: LinearFn; expression: string }
  | { status: "unsupported"; reason: string };

const NUMBER = String.raw`\d+(?:\.\d+)?`;
const FRAC = String.raw`\(${NUMBER}\/${NUMBER}\)`;
const COEF = String.raw`(?:${NUMBER}|${FRAC})`;

export function round6(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

export function trimNum(value: number) {
  const rounded = round6(value);
  if (Object.is(rounded, -0)) return "0";
  return String(rounded);
}

export function sameLinear(a: LinearFn, b: LinearFn) {
  return Math.abs(a.k - b.k) < 1e-6 && Math.abs(a.b - b.b) < 1e-6;
}

export function formatLinear(fn: LinearFn) {
  const k = round6(fn.k);
  const b = round6(fn.b);
  if (k === 0) return `y = ${trimNum(b)}`;
  const kText = k === 1 ? "x" : k === -1 ? "-x" : `${trimNum(k)}x`;
  if (b === 0) return `y = ${kText}`;
  return `y = ${kText} ${b > 0 ? "+" : "-"} ${trimNum(Math.abs(b))}`;
}

function normalizeMath(text: string) {
  return text
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/[－—–−﹣]/g, "-")
    .replace(/＋/g, "+")
    .replace(/＝/g, "=")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/[×·]/g, "*")
    .replace(/\s+/g, "");
}

function parseCoef(raw: string): number | null {
  const text = raw.trim().replace(/^\+/, "");
  const wrapped = text.match(new RegExp(`^(-)?\\((${NUMBER})\\/(${NUMBER})\\)$`));
  if (wrapped) {
    const den = Number(wrapped[3]);
    if (!den) return null;
    return (wrapped[1] ? -1 : 1) * (Number(wrapped[2]) / den);
  }
  const plain = text.match(new RegExp(`^(-)?(${NUMBER})\\/(${NUMBER})$`));
  if (plain) {
    const den = Number(plain[3]);
    if (!den) return null;
    return (plain[1] ? -1 : 1) * (Number(plain[2]) / den);
  }
  if (new RegExp(`^-?${NUMBER}$`).test(text)) return Number(text);
  return null;
}

function splitTopTerms(expr: string) {
  const terms: string[] = [];
  let current = "";
  let depth = 0;
  for (let index = 0; index < expr.length; index += 1) {
    const ch = expr[index];
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    const boundary = depth === 0 && (ch === "+" || ch === "-") && current !== "";
    if (boundary) {
      terms.push(current);
      current = ch === "-" ? "-" : "";
      continue;
    }
    current += ch;
  }
  if (current) terms.push(current);
  return terms;
}

function parseTerm(term: string): { k: number; b: number } | { reason: string } {
  let sign = 1;
  let body = term.trim();
  if (body.startsWith("+")) body = body.slice(1);
  else if (body.startsWith("-")) {
    sign = -1;
    body = body.slice(1);
  }
  if (!body) return { reason: "解析式有一个空项，不能确定直线。" };

  const factor = body.match(new RegExp(`^(${COEF})?\\(x([+-](?:${NUMBER}|${FRAC}))\\)$`, "i"));
  if (factor && body.includes("(x")) {
    const coef = factor[1] ? parseCoef(factor[1]) : 1;
    const inner = parseCoef(factor[2]);
    if (coef === null || inner === null) return { reason: "括号里的系数读不出来，不能确定直线。" };
    return { k: sign * coef, b: sign * coef * inner };
  }

  if (/x/i.test(body)) {
    const matched = body.match(new RegExp(`^(${COEF})?x$`, "i"));
    if (!matched) return { reason: "x 的写法不是一次项，不能确定直线。" };
    const coef = matched[1] ? parseCoef(matched[1]) : 1;
    if (coef === null) return { reason: "斜率读不出来，不能确定直线。" };
    return { k: sign * coef, b: 0 };
  }

  const constant = parseCoef(body);
  if (constant === null) return { reason: "常数项读不出来，不能确定直线。" };
  return { k: 0, b: sign * constant };
}

function parseMath(expr: string): { fn: LinearFn; hasX: boolean } | { reason: string } {
  let source = expr.toLowerCase();
  if (!source) return { reason: "没有读到可以计算的解析式，不能画成一条确定的直线。" };
  if (new RegExp(`${NUMBER}\\/${NUMBER}x`).test(source)) {
    return { reason: "1/2x 这类写法有歧义。请写成 (1/2)x 或 0.5x。这里不猜一条直线。" };
  }
  source = source.replace(new RegExp(`x\\/(${NUMBER})(?!\\d)`, "gi"), "(1/$1)x");
  source = source.replace(new RegExp(`(${NUMBER})\\*(?=x)`, "gi"), "$1");
  source = source.replace(new RegExp(`x\\*(${NUMBER})`, "gi"), "$1x");
  if (source.includes("*")) return { reason: "式子里的乘号无法确定，不能画成一条确定的直线。" };
  if (/[()]/.test(source.replace(new RegExp(FRAC, "g"), ""))) {
    const expanded = source;
    if (!new RegExp(`\\(x[+-]`).test(expanded) && /\(/.test(expanded)) {
      return { reason: "括号的含义不确定，不能画成一条确定的直线。" };
    }
  }
  const terms = splitTopTerms(source);
  let k = 0;
  let b = 0;
  for (const term of terms) {
    const part = parseTerm(term);
    if ("reason" in part) return part;
    k += part.k;
    b += part.b;
  }
  if (!Number.isFinite(k) || !Number.isFinite(b) || Math.abs(k) > 1e6 || Math.abs(b) > 1e6) {
    return { reason: "系数不是可以安全作图的有限数，不能画成一条确定的直线。" };
  }
  return { fn: { k: round6(k), b: round6(b) }, hasX: /x/.test(source) };
}

function equationHead(raw: string) {
  return raw.match(/^[^,，。；;、\n]*/)?.[0] ?? "";
}

function readEquation(raw: string): { fn: LinearFn; hasX: boolean } | { reason: string } {
  const head = equationHead(raw);
  if (/[\^²³₂]/.test(head) || /x\d/i.test(head)) {
    return { reason: "式子含有高于一次的项，不是一次函数直线，这里不另画一条示意线。" };
  }
  if (/\/x/i.test(head)) {
    return { reason: "x 在分母上，不是一次函数直线，这里不另画一条示意线。" };
  }
  if (/[a-wyz]/i.test(head)) {
    return { reason: "解析式里还有字母参数（例如 k、b），没有具体数值，不能画成一条确定的直线。" };
  }
  const math = head.match(/^[-+0-9xX*/().]+/)?.[0] ?? "";
  if (!math) return { reason: "没有读到可以计算的解析式，不能画成一条确定的直线。" };
  return parseMath(math);
}

export function resolveFunctionGraph(concept: string): FormulaVerdict {
  const normalized = normalizeMath(concept);
  const marks = [...normalized.matchAll(/(?:y|f\(x\))=/gi)];
  if (!marks.length) {
    return { status: "unsupported", reason: "概念里没有 y= 或 f(x)= 这样的解析式，不能把它画成一条确定的直线。" };
  }
  const found: { fn: LinearFn; hasX: boolean }[] = [];
  const problems: string[] = [];
  for (const mark of marks) {
    const start = (mark.index ?? 0) + mark[0].length;
    const result = readEquation(normalized.slice(start));
    if ("fn" in result) found.push(result);
    else problems.push(result.reason);
  }
  const usable = found.some((item) => item.hasX) ? found.filter((item) => item.hasX) : found;
  const unique: LinearFn[] = [];
  for (const item of usable) {
    if (!unique.some((fn) => sameLinear(fn, item.fn))) unique.push(item.fn);
  }
  if (unique.length > 1) {
    return {
      status: "unsupported",
      reason: `概念里有 ${unique.length} 个不同的一次函数（${unique.map((fn) => formatLinear(fn)).join("、")}），不能画成一条确定的直线。`,
    };
  }
  if (unique.length === 1 && problems.length > 0) {
    return { status: "unsupported", reason: "概念里还有另一处无法确定的式子，所以不把其中一条画成准确图像。" };
  }
  if (unique.length === 1) return { status: "exact", fn: unique[0], expression: formatLinear(unique[0]) };
  return { status: "unsupported", reason: problems[0] ?? "这个式子不能确定成一条直线。" };
}

export function parseLinear(text: string): LinearFn | null {
  const verdict = resolveFunctionGraph(text);
  if (verdict.status !== "exact" || verdict.fn.k === 0) return null;
  return verdict.fn;
}
