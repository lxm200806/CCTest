import { getPool, withTransaction } from "@/lib/db/pool";
import type { Student } from "@/lib/types";

type JsonUser = { id?: string; username?: string; displayName?: string; passwordHash?: string; passwordSalt?: string; credits?: number; createdAt?: string };
type JsonStore = { users?: JsonUser[]; students?: Student[]; checkins?: { id?: string; userId?: string; date?: string; step?: number; done?: boolean }[]; ledger?: { id?: string; userId?: string; delta?: number; balanceAfter?: number; note?: string; toolId?: string; createdAt?: string }[]; generations?: { id?: string; userId?: string; toolId?: string; toolName?: string; source?: string; createdAt?: string; input?: Record<string, string>; result?: unknown }[] };

export function validateStore(raw: unknown) {
  const errors: string[] = [];
  const store = raw && typeof raw === "object" ? (raw as JsonStore) : {};
  const users = store.users ?? [];
  const ids = new Set<string>();
  for (const user of users) {
    if (!user.id || !user.username || !user.passwordHash || !user.passwordSalt) errors.push(`用户 ${user.username ?? user.id ?? "?"} 缺少 id、账号或密码散列`);
    if (!Number.isInteger(user.credits) || (user.credits ?? -1) < 0) errors.push(`用户 ${user.username ?? "?"} 点数不是非负整数`);
    if (user.id && ids.has(user.id)) errors.push(`用户 id 重复 ${user.id}`);
    if (user.id) ids.add(user.id);
  }
  for (const generation of store.generations ?? []) {
    if (!generation.userId || !ids.has(generation.userId)) errors.push(`生成 ${generation.id ?? "?"} 的用户不在这份数据里`);
  }
  return {
    ok: errors.length === 0,
    errors,
    counts: { users: users.length, students: store.students?.length ?? 0, checkins: store.checkins?.length ?? 0, ledger: store.ledger?.length ?? 0, generations: store.generations?.length ?? 0 },
    sessionsIgnored: true,
  };
}

export async function importStore(raw: unknown) {
  const report = validateStore(raw);
  if (!report.ok) return report;
  const store = raw as JsonStore;
  await withTransaction(async (client) => {
    for (const user of store.users ?? []) {
      await client.query(
        `INSERT INTO users (id, username, display_name, password_hash, password_salt, credits, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [user.id, user.username, user.displayName || user.username, user.passwordHash, user.passwordSalt, user.credits, user.createdAt || new Date().toISOString()],
      );
    }
    for (const student of store.students ?? []) {
      await client.query(
        `INSERT INTO students (id, user_id, name, grade_band, grade, school, guardian, goal, weekly_minutes, focus, subjects)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) ON CONFLICT (id) DO NOTHING`,
        [student.id, student.userId, student.name, student.gradeBand, student.grade, student.school, student.guardian, student.goal, student.weeklyMinutes, student.focus, JSON.stringify(student.subjects)],
      );
    }
    for (const item of store.checkins ?? []) {
      if (!item.done) continue;
      await client.query(
        `INSERT INTO checkins (id, user_id, day, step, done) VALUES ($1,$2,$3,$4,true) ON CONFLICT (id) DO NOTHING`,
        [item.id, item.userId, item.date, item.step],
      );
    }
    for (const item of store.ledger ?? []) {
      await client.query(
        `INSERT INTO ledger (id, user_id, delta, balance_after, note, tool_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [item.id, item.userId, item.delta, item.balanceAfter, item.note, item.toolId ?? null, item.createdAt],
      );
    }
    for (const item of store.generations ?? []) {
      await client.query(
        `INSERT INTO generations (id, user_id, tool_id, tool_name, source, created_at, input, result)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) ON CONFLICT (id) DO NOTHING`,
        [item.id, item.userId, item.toolId, item.toolName, item.source, item.createdAt, JSON.stringify(item.input ?? {}), JSON.stringify(item.result ?? {})],
      );
    }
  });
  return report;
}

export async function tableCounts() {
  const pool = getPool();
  const names = ["users", "students", "checkins", "ledger", "generations"];
  const counts: Record<string, number> = {};
  for (const name of names) {
    const result = await pool.query<{ count: string }>(`SELECT count(*) FROM ${name}`);
    counts[name] = Number(result.rows[0]?.count ?? 0);
  }
  return counts;
}
