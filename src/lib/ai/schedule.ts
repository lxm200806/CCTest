import { ProviderError } from "@/lib/ai/errors";
import { trimNum } from "@/lib/ai/formula";
import type { Section } from "@/lib/types";

const TOTAL_LABEL = /^(合计|总计|总共|共计|一共|小计|总时长|总用时|全程|total)(\d+(?:\.\d+)?)?$/i;

function scheduleScore(section: Section) {
  if (!section.table) return 0;
  const heading = section.heading;
  const headers = section.table.headers.join(" ");
  const blob = `${heading} ${headers}`;
  if (/分值|得分|知识点/.test(headers) && !/分钟|时长|时间安排|时间怎么切/.test(blob)) return 0;
  let score = 0;
  if (/时间安排|时间怎么切|课时安排|教学环节|课堂流程|时间表/.test(heading)) score += 6;
  else if (/时间|节奏|分钟/.test(heading)) score += 3;
  if (/分钟|时长|用时/.test(headers)) score += 4;
  else if (/时间/.test(headers) && /段落|环节|活动|做什么|内容|任务/.test(blob)) score += 3;
  return score;
}

function timeColumn(headers: string[]) {
  const minute = headers.findIndex((header) => /分钟|时长|用时/.test(header));
  if (minute >= 0) return minute;
  return headers.findIndex((header) => /时间/.test(header));
}

function isTotalRow(row: string[]) {
  return row.some((cell) => {
    const text = cell.replace(/\s+/g, "").replace(/分钟|min(?:ute)?s?/gi, "");
    return text.length > 0 && text.length <= 12 && TOTAL_LABEL.test(text);
  });
}

export function parseDurationCell(cell: string) {
  let text = cell.trim();
  if (!text) return null;
  text = text.replace(/分钟|min(?:ute)?s?/gi, "");
  text = text.replace(/[～~—–－至到]/g, "-");
  text = text.replace(/^(约|大约|共|大概|用时)/, "").trim();
  const range = text.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    return end - start;
  }
  const single = text.match(/^(-?\d+(?:\.\d+)?)$/);
  if (!single) return null;
  return Number(single[1]);
}

export function readScheduleMinutes(sections: Section[]) {
  const ranked = sections
    .map((section, index) => ({ section, index, score: scheduleScore(section) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  if (!ranked.length) return { ok: false as const, error: "课堂脚本缺少可核对的时间安排。点数未扣除。" };
  const section = ranked[0].section;
  const table = section.table;
  if (!table) return { ok: false as const, error: "课堂脚本缺少可核对的时间安排。点数未扣除。" };
  const column = timeColumn(table.headers);
  if (column < 0) return { ok: false as const, error: "时间安排里没有分钟或时间列。点数未扣除。" };
  let sum = 0;
  let counted = 0;
  for (const row of table.rows) {
    if (isTotalRow(row)) continue;
    const label = (row.find((cell) => cell.trim()) ?? "这一段").trim();
    const minutes = parseDurationCell(row[column] ?? "");
    if (minutes === null) return { ok: false as const, error: `时间安排里「${label.slice(0, 24)}」没有读出分钟数。点数未扣除。` };
    if (minutes < 0) return { ok: false as const, error: "时间安排出现了负的时长。点数未扣除。" };
    sum += minutes;
    counted += 1;
  }
  if (!counted) return { ok: false as const, error: "时间安排只有合计，没有各段时长。点数未扣除。" };
  return { ok: true as const, minutes: Math.round(sum * 1e6) / 1e6, heading: section.heading };
}

export function assertScheduleMatches(sections: Section[], requested: number) {
  const read = readScheduleMinutes(sections);
  if (!read.ok) throw new ProviderError(read.error, { parseError: true });
  if (Math.abs(read.minutes - requested) > 0.05) {
    throw new ProviderError(`时间安排合计 ${trimNum(read.minutes)} 分钟，与所选课时 ${trimNum(requested)} 分钟不一致。点数未扣除。`, { parseError: true });
  }
  return read.minutes;
}
