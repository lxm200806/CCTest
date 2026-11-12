export function isoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function weekDays(date = new Date()) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

export const WEEKDAY = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function formatStamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${date.getMonth() + 1}月${date.getDate()}日 ${hh}:${mm}`;
}

export function dayCount(checkins: { date: string; done: boolean }[], date: string) {
  return checkins.filter((item) => item.date === date && item.done).length;
}

export function streakFrom(checkins: { date: string; step: number; done: boolean }[], today = new Date()) {
  const qualified = new Set<string>();
  const byDate = new Map<string, number>();
  for (const item of checkins) {
    if (!item.done) continue;
    byDate.set(item.date, (byDate.get(item.date) ?? 0) + 1);
  }
  for (const [date, count] of byDate) {
    if (count >= 4) qualified.add(date);
  }
  const cursor = new Date(today);
  cursor.setHours(12, 0, 0, 0);
  if (!qualified.has(isoDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (qualified.has(isoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
