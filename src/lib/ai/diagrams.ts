import { formatLinear, round6, trimNum, type LinearFn } from "@/lib/ai/formula";

function esc(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function wrapText(value: string, maxChars: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return [""];
  const size = Math.max(4, maxChars);
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    current += ch;
    if (current.length >= size) {
      lines.push(current);
      current = "";
    }
  }
  if (current) lines.push(current);
  return lines;
}

function svgText(lines: string[], x: number, y: number, lineHeight: number, attrs: string) {
  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" ${attrs}>${esc(line)}</text>`)
    .join("");
}

function ids(seed: string) {
  let hash = 2166136261;
  for (const ch of seed) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  const id = `g${(hash >>> 0).toString(36)}`;
  return { title: `${id}-t`, desc: `${id}-d` };
}

function n(value: number) {
  return trimNum(round6(value));
}

function px(value: number) {
  return String(Math.round(value * 100) / 100);
}

type Window = { x0: number; x1: number; y0: number; y1: number };

function chooseWindow(fn: LinearFn): Window {
  const xInt = fn.k === 0 ? null : -fn.b / fn.k;
  const yNear = Math.abs(fn.b) <= 16;
  const xNear = xInt !== null && Number.isFinite(xInt) && Math.abs(xInt) <= 16;
  let centerX = 0;
  if (!yNear && xInt !== null && Number.isFinite(xInt)) centerX = xInt;
  else if (xNear && xInt !== null && Math.abs(xInt) > 8 && yNear) centerX = xInt / 2;

  let x0 = centerX - 5;
  let x1 = centerX + 5;
  if (yNear || Math.abs(centerX) <= 8) {
    x0 = Math.min(x0, -1.5);
    x1 = Math.max(x1, 1.5);
  }
  if (xNear && xInt !== null && xInt >= centerX - 10 && xInt <= centerX + 10) {
    x0 = Math.min(x0, xInt - 1.5);
    x1 = Math.max(x1, xInt + 1.5);
  }
  if (x1 - x0 > 20) {
    x0 = centerX - 8;
    x1 = centerX + 8;
  }

  const ySamples = [x0, (x0 + x1) / 2, x1].map((x) => fn.k * x + fn.b);
  let y0 = Math.min(...ySamples);
  let y1 = Math.max(...ySamples);
  if (yNear) {
    y0 = Math.min(y0, fn.b, 0);
    y1 = Math.max(y1, fn.b, 0);
  } else if (y0 > 0 || y1 < 0) {
    y0 = Math.min(y0, 0);
    y1 = Math.max(y1, 0);
  }
  if (y1 - y0 < 6) {
    const mid = (y0 + y1) / 2;
    y0 = mid - 3;
    y1 = mid + 3;
  }
  if (y1 - y0 > 24) {
    const mid = fn.k * centerX + fn.b;
    y0 = mid - 8;
    y1 = mid + 8;
  }
  const padX = (x1 - x0) * 0.08;
  const padY = (y1 - y0) * 0.1;
  return { x0: x0 - padX, x1: x1 + padX, y0: y0 - padY, y1: y1 + padY };
}

function clipSegment(fn: LinearFn, win: Window) {
  const points: { x: number; y: number }[] = [];
  const push = (x: number, y: number) => {
    if (x < win.x0 - 1e-6 || x > win.x1 + 1e-6 || y < win.y0 - 1e-6 || y > win.y1 + 1e-6) return;
    const point = { x: Math.min(win.x1, Math.max(win.x0, x)), y: Math.min(win.y1, Math.max(win.y0, y)) };
    if (!points.some((item) => Math.hypot(item.x - point.x, item.y - point.y) < 1e-4)) points.push(point);
  };
  if (fn.k === 0) {
    if (fn.b >= win.y0 && fn.b <= win.y1) return [{ x: win.x0, y: fn.b }, { x: win.x1, y: fn.b }];
    return null;
  }
  push(win.x0, fn.k * win.x0 + fn.b);
  push(win.x1, fn.k * win.x1 + fn.b);
  push((win.y0 - fn.b) / fn.k, win.y0);
  push((win.y1 - fn.b) / fn.k, win.y1);
  if (points.length < 2) return null;
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  return [points[0], points[points.length - 1]];
}

function niceStep(span: number) {
  const raw = Math.max(span / 5, 1e-6);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const scaled = raw / pow;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * pow;
}

function tickValues(min: number, max: number) {
  const step = niceStep(max - min);
  const start = Math.ceil((min + step * 0.2) / step) * step;
  const values: number[] = [];
  for (let value = start; value <= max - step * 0.15 && values.length < 8; value += step) {
    const next = round6(value);
    if (Math.abs(next) < step / 20) continue;
    values.push(next);
  }
  return values;
}

export function graphSvg(title: string, fn: LinearFn) {
  const expression = formatLinear(fn);
  const win = chooseWindow(fn);
  const xInt = fn.k === 0 ? null : round6(-fn.b / fn.k);
  const segment = clipSegment(fn, win);
  const titleLines = wrapText(title, 18);
  const slopeText = fn.k > 0 ? "x 增大时 y 增大" : fn.k < 0 ? "x 增大时 y 减小" : "水平直线，y 不随 x 变化";
  const yIn = fn.b >= win.y0 && fn.b <= win.y1;
  const xIn = xInt !== null && xInt >= win.x0 && xInt <= win.x1;
  const notes = [
    `${expression}。斜率 k=${trimNum(fn.k)}，纵截距 b=${trimNum(fn.b)}。${slopeText}。`,
    yIn ? `纵截距 (0, ${trimNum(fn.b)}) 在坐标窗口内。` : `纵截距 (0, ${trimNum(fn.b)}) 超出当前坐标窗口，可见部分仍按解析式画出。`,
  ];
  if (fn.k !== 0) {
    notes.push(xIn ? `横截距 (${trimNum(xInt ?? 0)}, 0) 在坐标窗口内。` : `横截距 (${trimNum(xInt ?? 0)}, 0) 超出当前坐标窗口。`);
  }
  if (!segment) notes.push("这条直线没有落在安全坐标窗口里，所以窗口内不补一条示意线。");
  const caption = notes.join("");
  const width = 420;
  const plotLeft = 56;
  const plotRight = 400;
  const plotTop = 18 + titleLines.length * 22 + 26;
  const plotBottom = plotTop + 250;
  const height = plotBottom + 16;
  const X = (x: number) => plotLeft + ((x - win.x0) / (win.x1 - win.x0)) * (plotRight - plotLeft);
  const Y = (y: number) => plotBottom - ((y - win.y0) / (win.y1 - win.y0)) * (plotBottom - plotTop);
  const axisY = win.x0 <= 0 && win.x1 >= 0 ? X(0) : plotLeft;
  const axisX = win.y0 <= 0 && win.y1 >= 0 ? Y(0) : plotBottom;
  const label = ids(`${title}|${expression}|${caption}`);
  const ticksX = tickValues(win.x0, win.x1)
    .map((value) => {
      const x = X(value);
      return `<line x1="${px(x)}" y1="${px(axisX)}" x2="${px(x)}" y2="${px(axisX + 5)}" stroke="#5e564c"/><text data-ticks="x" x="${px(x)}" y="${px(axisX + 16)}" text-anchor="middle" font-size="11" fill="#5e564c">${esc(trimNum(value))}</text>`;
    })
    .join("");
  const ticksY = tickValues(win.y0, win.y1)
    .map((value) => {
      const y = Y(value);
      return `<line x1="${px(axisY - 5)}" y1="${px(y)}" x2="${px(axisY)}" y2="${px(y)}" stroke="#5e564c"/><text data-ticks="y" x="${px(axisY - 8)}" y="${px(y + 4)}" text-anchor="end" font-size="11" fill="#5e564c">${esc(trimNum(value))}</text>`;
    })
    .join("");
  const line = segment
    ? `<line data-role="function" x1="${px(X(segment[0].x))}" y1="${px(Y(segment[0].y))}" x2="${px(X(segment[1].x))}" y2="${px(Y(segment[1].y))}" stroke="#1f4d42" stroke-width="3" stroke-linecap="round"/>`
    : "";
  const markers = [
    yIn ? marker(X(0), Y(fn.b), "y", `(0, ${trimNum(fn.b)})`, plotLeft, plotRight, plotTop) : "",
    xIn && xInt !== null ? marker(X(xInt), Y(0), "x", `(${trimNum(xInt)}, 0)`, plotLeft, plotRight, plotTop) : "",
  ].join("");
  const desc = `${expression}。${slopeText}。横轴大约 ${trimNum(win.x0)} 到 ${trimNum(win.x1)}，纵轴大约 ${trimNum(win.y0)} 到 ${trimNum(win.y1)}。${caption}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${px(height)}" role="img" aria-labelledby="${label.title} ${label.desc}" data-exact="true" data-k="${n(fn.k)}" data-b="${n(fn.b)}" data-x0="${n(win.x0)}" data-x1="${n(win.x1)}" data-y0="${n(win.y0)}" data-y1="${n(win.y1)}" data-plot="${plotLeft},${plotTop},${plotRight},${plotBottom}" font-family="PingFang SC, Microsoft YaHei, sans-serif"><title id="${label.title}">${esc(expression)}</title><desc id="${label.desc}">${esc(desc)}</desc><rect width="${width}" height="${px(height)}" fill="#fffdf8"/>${svgText(titleLines, 16, 22, 22, 'font-size="16" fill="#1c1915"')}<text x="16" y="${18 + titleLines.length * 22 + 8}" font-size="14" fill="#1f4d42">${esc(expression)}</text><rect x="${plotLeft}" y="${plotTop}" width="${plotRight - plotLeft}" height="${plotBottom - plotTop}" fill="#fffdf8" stroke="#e3d7c4"/><line data-axis="y" x1="${px(axisY)}" y1="${plotTop}" x2="${px(axisY)}" y2="${plotBottom}" stroke="#1c1915"/><line data-axis="x" x1="${plotLeft}" y1="${px(axisX)}" x2="${plotRight}" y2="${px(axisX)}" stroke="#1c1915"/><text x="${plotRight - 10}" y="${px(axisX - 8)}" text-anchor="end" font-size="13" fill="#1c1915">x</text><text x="${px(axisY + 8)}" y="${plotTop + 14}" font-size="13" fill="#1c1915">y</text>${ticksX}${ticksY}${line}${markers}</svg>`;
  return `<figure class="diagram-figure">${svg}<p class="diagram-note">${esc(caption)}</p></figure>`;
}

function marker(x: number, y: number, kind: "x" | "y", label: string, left: number, right: number, top: number) {
  const textX = x > right - 70 ? x - 6 : x + 6;
  const anchor = x > right - 70 ? "end" : "start";
  const textY = y < top + 22 ? y + 16 : y - 8;
  return `<circle data-intercept="${kind}" cx="${px(x)}" cy="${px(y)}" r="4.5" fill="#9a3e22"/><text x="${px(textX)}" y="${px(textY)}" text-anchor="${anchor}" font-size="12" fill="#9a3e22">${esc(label)}</text>`;
}

export function unsupportedGraphSvg(title: string, reason: string) {
  const heading = "不能把这个概念画成一条确定的直线";
  const detail = `${heading}。${reason}`;
  return `<figure class="diagram-figure" role="img" aria-label="${esc(detail)}" data-exact="false"><p class="diagram-title">${esc(title)}</p><p class="diagram-warning">${esc(detail)}</p></figure>`;
}

export function treeSvg(title: string, leaves: string[]) {
  const desc = `结构图。标题：${title}。分支共 ${leaves.length} 项：${leaves.join("；")}`;
  const items = leaves.map((leaf) => `<li>${esc(leaf)}</li>`).join("");
  return `<figure class="diagram-tree" role="img" aria-label="${esc(desc)}"><p class="diagram-tree-root">${esc(title)}</p><ul>${items}</ul></figure>`;
}

export function flowSvg(title: string, nodes: string[]) {
  const width = 400;
  const titleLines = wrapText(title, 16);
  let cursor = 24 + titleLines.length * 22;
  const boxes = nodes.map((node) => {
    const lines = wrapText(node, 16);
    const h = 16 + lines.length * 20;
    const top = cursor;
    cursor += h + 28;
    return { lines, top, h };
  });
  const height = cursor + 8;
  const label = ids(`flow|${title}|${nodes.join("|")}`);
  const body = boxes
    .map((box, index) => {
      const arrow = index < boxes.length - 1 ? `<path d="M200 ${box.top + box.h} V${box.top + box.h + 22}" stroke="#9a3e22" stroke-width="2"/>` : "";
      return `<rect x="36" y="${box.top}" width="328" height="${box.h}" rx="10" fill="#fffdf8" stroke="#1f4d42"/>${svgText(box.lines, 48, box.top + 22, 20, 'font-size="15" fill="#1c1915"')}${arrow}`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${label.title} ${label.desc}" font-family="PingFang SC, Microsoft YaHei, sans-serif"><title id="${label.title}">${esc(title)}</title><desc id="${label.desc}">${esc(`流程图。${title}。顺序：${nodes.join("，")}`)}</desc><rect width="${width}" height="${height}" fill="#f7f3ea"/>${svgText(titleLines, 16, 24, 22, 'font-size="16" fill="#1c1915"')}${body}</svg>`;
}

export function compareSvg(title: string, left: string, right: string, rows: [string, string, string][]) {
  const width = 420;
  const titleLines = wrapText(title, 16);
  const headY = 20 + titleLines.length * 22;
  const body = rows
    .map((row, index) => {
      const y = headY + 58 + index * 36;
      return `<text x="16" y="${y}" font-size="13" fill="#5e564c">${esc(row[0])}</text><text x="120" y="${y}" font-size="14" fill="#1c1915">${esc(row[1])}</text><text x="270" y="${y}" font-size="14" fill="#1c1915">${esc(row[2])}</text>`;
    })
    .join("");
  const height = headY + 70 + rows.length * 36;
  const label = ids(`compare|${title}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${label.title} ${label.desc}" font-family="PingFang SC, Microsoft YaHei, sans-serif"><title id="${label.title}">${esc(title)}</title><desc id="${label.desc}">${esc(`对比表。${title}。${left} 与 ${right}`)}</desc><rect width="${width}" height="${height}" fill="#f7f3ea"/>${svgText(titleLines, 16, 24, 22, 'font-size="16" fill="#1c1915"')}<rect x="110" y="${headY}" width="140" height="32" rx="8" fill="#1f4d42"/><rect x="260" y="${headY}" width="140" height="32" rx="8" fill="#9a3e22"/><text x="180" y="${headY + 21}" text-anchor="middle" font-size="14" fill="#f6f1e6">${esc(left)}</text><text x="330" y="${headY + 21}" text-anchor="middle" font-size="14" fill="#f6f1e6">${esc(right)}</text>${body}</svg>`;
}

export function timelineSvg(title: string, events: string[]) {
  const width = 400;
  const titleLines = wrapText(title, 16);
  let cursor = 36 + titleLines.length * 22;
  const rows = events.map((event) => {
    const lines = wrapText(event, 18);
    const top = cursor;
    cursor += lines.length * 20 + 16;
    return { lines, top };
  });
  const height = cursor + 12;
  const label = ids(`time|${title}|${events.join("|")}`);
  const body = rows
    .map((row) => `<circle cx="28" cy="${row.top}" r="6" fill="#9a3e22"/>${svgText(row.lines, 48, row.top + 4, 20, 'font-size="14" fill="#1c1915"')}`)
    .join("");
  const spine = rows.length > 1 ? `<line x1="28" y1="${rows[0].top}" x2="28" y2="${rows[rows.length - 1].top}" stroke="#1f4d42" stroke-width="2"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${label.title} ${label.desc}" font-family="PingFang SC, Microsoft YaHei, sans-serif"><title id="${label.title}">${esc(title)}</title><desc id="${label.desc}">${esc(`时间线。${title}。${events.join("，")}`)}</desc><rect width="${width}" height="${height}" fill="#fffdf8"/>${svgText(titleLines, 16, 24, 22, 'font-size="16" fill="#1c1915"')}${spine}${body}</svg>`;
}
