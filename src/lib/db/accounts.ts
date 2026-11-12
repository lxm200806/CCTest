import { createHash, randomBytes } from "node:crypto";
import type pg from "pg";
import { withTransaction } from "@/lib/db/pool";
import { hashPassword, passwordsMatch } from "@/lib/passwords";
import type { GenerationRecord, LedgerItem, PublicUser, Student, ToolResult } from "@/lib/types";

export const SESSION_DAYS = 14;
export const RESERVATION_TTL_MS = 10 * 60 * 1000;
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const OCR_LIMIT = 20;
const OCR_WINDOW_SECONDS = 10 * 60;

type RequestRow = { status: string; cost: number; generation_id: string | null; updated_at: Date };

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function requestKey(header: string | null, userId: string, toolId: string, input: Record<string, string>) {
  if (header && /^[\w-]{8,80}$/.test(header)) return header;
  const canonical = JSON.stringify(Object.keys(input).sort().map((key) => [key, input[key]]));
  return createHash("sha256").update(`${userId}\n${toolId}\n${canonical}`).digest("hex");
}

function nid(prefix: string) {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

function userOf(row: { id: string; username: string; display_name: string; credits: number }): PublicUser {
  return { id: row.id, username: row.username, displayName: row.display_name, credits: row.credits };
}

function generationOf(row: { id: string; user_id: string; tool_id: string; tool_name: string; source: GenerationRecord["source"]; created_at: Date; input: Record<string, string>; result: ToolResult }): GenerationRecord {
  return { id: row.id, userId: row.user_id, toolId: row.tool_id, toolName: row.tool_name, source: row.source, createdAt: row.created_at.toISOString(), input: row.input, result: row.result };
}

export async function findUserByToken(token: string) {
  return withTransaction(async (client) => {
    const found = await client.query<{ id: string; username: string; display_name: string; credits: number }>(
      `SELECT u.id, u.username, u.display_name, u.credits
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
      [tokenHash(token)],
    );
    return found.rows[0] ? userOf(found.rows[0]) : null;
  });
}

export async function allowRate(bucket: string, limit: number, windowSeconds: number) {
  return withTransaction(async (client) => {
    const row = await client.query<{ count: number }>(
      `INSERT INTO rate_limits (bucket, count, window_start) VALUES ($1, 1, now())
       ON CONFLICT (bucket) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN 1 ELSE rate_limits.count + 1 END,
         window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN now() ELSE rate_limits.window_start END
       RETURNING count`,
      [bucket, windowSeconds],
    );
    return (row.rows[0]?.count ?? 1) <= limit;
  });
}

export async function login(username: string, password: string) {
  const allowed = await allowRate(`login:${username.trim()}`, LOGIN_LIMIT, LOGIN_WINDOW_SECONDS);
  if (!allowed) return { error: "尝试太多次，请稍后再登录" as const };
  return withTransaction(async (client) => {
    const found = await client.query<{ id: string; username: string; display_name: string; credits: number; password_hash: string; password_salt: string }>(
      "SELECT id, username, display_name, credits, password_hash, password_salt FROM users WHERE username = $1",
      [username.trim()],
    );
    const user = found.rows[0];
    if (!user || !passwordsMatch(password, user.password_salt, user.password_hash)) return null;
    const token = randomBytes(24).toString("hex");
    await client.query(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, now(), now() + make_interval(days => $3))",
      [tokenHash(token), user.id, SESSION_DAYS],
    );
    return { token, user: userOf(user) };
  });
}

export async function logout(token: string) {
  await withTransaction(async (client) => {
    await client.query("UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [tokenHash(token)]);
  });
}

export async function register(username: string, password: string, displayName: string, credits = 20) {
  if (process.env.ALLOW_REGISTER !== "1") return { error: "请使用邀请账号" };
  const name = username.trim();
  const shown = displayName.trim();
  if (!/^[\w\u4e00-\u9fa5]{2,20}$/.test(name)) return { error: "账号用 2 到 20 位字母、数字或中文" };
  if (password.length < 6) return { error: "密码至少 6 位" };
  if (shown.length < 1 || shown.length > 20) return { error: "显示名称请控制在 20 字以内" };
  const { salt, hash } = hashPassword(password);
  const userId = nid("usr");
  const token = randomBytes(24).toString("hex");
  try {
    return await withTransaction(async (client) => {
      await client.query(
        "INSERT INTO users (id, username, display_name, password_hash, password_salt, credits, created_at) VALUES ($1,$2,$3,$4,$5,$6,now())",
        [userId, name, shown, hash, salt, credits],
      );
      await client.query(
        `INSERT INTO students (id, user_id, name, grade_band, grade, school, guardian, goal, weekly_minutes, focus, subjects)
         VALUES ($1,$2,$3,'junior','初二','未填写学校',$3,'先定一个两周内能看到的小目标',30,'先从一门学科开始',$4::jsonb)`,
        [nid("stu"), userId, shown, JSON.stringify([
          { name: "数学", level: "稳定", note: "待观察" },
          { name: "语文", level: "稳定", note: "待观察" },
          { name: "英语", level: "稳定", note: "待观察" },
        ])],
      );
      await client.query(
        "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1,$2,now(), now() + make_interval(days => $3))",
        [tokenHash(token), userId, SESSION_DAYS],
      );
      await client.query(
        "INSERT INTO ledger (id, user_id, delta, balance_after, note, created_at) VALUES ($1,$2,$3,$3,'新账号初始点数',now())",
        [nid("led"), userId, credits],
      );
      return { token, user: { id: userId, username: name, displayName: shown, credits } satisfies PublicUser };
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return { error: "这个账号已经有了" };
    throw error;
  }
}

export async function createInvitedUser(username: string, password: string, displayName: string, credits: number) {
  const previous = process.env.ALLOW_REGISTER;
  process.env.ALLOW_REGISTER = "1";
  try {
    return await register(username, password, displayName, credits);
  } finally {
    if (previous === undefined) delete process.env.ALLOW_REGISTER;
    else process.env.ALLOW_REGISTER = previous;
  }
}

export async function studentFor(userId: string): Promise<Student | null> {
  return withTransaction(async (client) => {
    const found = await client.query<{ id: string; user_id: string; name: string; grade_band: Student["gradeBand"]; grade: string; school: string; guardian: string; goal: string; weekly_minutes: number; focus: string; subjects: Student["subjects"] }>(
      "SELECT * FROM students WHERE user_id = $1",
      [userId],
    );
    const row = found.rows[0];
    if (!row) return null;
    return { id: row.id, userId: row.user_id, name: row.name, gradeBand: row.grade_band, grade: row.grade, school: row.school, guardian: row.guardian, goal: row.goal, weeklyMinutes: row.weekly_minutes, focus: row.focus, subjects: row.subjects };
  });
}

export async function recentLedger(userId: string, limit = 8): Promise<LedgerItem[]> {
  return withTransaction(async (client) => {
    const found = await client.query<{ id: string; delta: number; balance_after: number; note: string; tool_id: string | null; created_at: Date }>(
      "SELECT id, delta, balance_after, note, tool_id, created_at FROM ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
      [userId, limit],
    );
    return found.rows.map((row) => ({ id: row.id, delta: row.delta, balanceAfter: row.balance_after, note: row.note, toolId: row.tool_id ?? undefined, createdAt: row.created_at.toISOString() }));
  });
}

export async function checkinsFor(userId: string) {
  return withTransaction(async (client) => {
    const found = await client.query<{ day: Date; step: number }>("SELECT day, step FROM checkins WHERE user_id = $1 AND done ORDER BY day, step", [userId]);
    return found.rows.map((row) => ({ date: row.day.toISOString().slice(0, 10), step: row.step, done: true }));
  });
}

export async function setCheckin(userId: string, date: string, step: number, done: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || step < 1 || step > 6) return { error: "打卡日期或步骤不对" };
  await withTransaction(async (client) => {
    if (!done) {
      await client.query("DELETE FROM checkins WHERE user_id = $1 AND day = $2 AND step = $3", [userId, date, step]);
      return;
    }
    await client.query(
      `INSERT INTO checkins (id, user_id, day, step, done) VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (user_id, day, step) DO UPDATE SET done = true`,
      [nid("chk"), userId, date, step],
    );
  });
  return { ok: true as const };
}

export async function generationOwnedBy(userId: string, generationId: string) {
  return withTransaction(async (client) => loadOwned(client, userId, generationId));
}

export async function latestGeneration(userId: string, toolId: string) {
  return withTransaction(async (client) => {
    const found = await client.query("SELECT * FROM generations WHERE user_id = $1 AND tool_id = $2 ORDER BY created_at DESC LIMIT 1", [userId, toolId]);
    return found.rows[0] ? generationOf(found.rows[0]) : null;
  });
}

export async function allowOcr(userId: string) {
  return allowRate(`ocr:${userId}`, OCR_LIMIT, OCR_WINDOW_SECONDS);
}

export type Reservation =
  | { state: "replay"; balance: number; record: GenerationRecord }
  | { state: "held"; requestKey: string }
  | { state: "busy" }
  | { state: "short"; balance: number };

export async function reserveGeneration(input: { userId: string; cost: number; toolId: string; idempotencyKey: string }): Promise<Reservation> {
  await recoverStaleReservations();
  return withTransaction(async (client) => {
    const existing = await client.query<RequestRow>(
      "SELECT status, cost, generation_id, updated_at FROM generation_requests WHERE user_id = $1 AND idempotency_key = $2 FOR UPDATE",
      [input.userId, input.idempotencyKey],
    );
    const row = existing.rows[0];
    if (row?.status === "completed" && row.generation_id) {
      const record = await loadOwned(client, input.userId, row.generation_id);
      const balance = await creditBalance(client, input.userId);
      if (record) return { state: "replay", balance, record };
    }
    if (row?.status === "reserved") return { state: "busy" };
    const charged = await client.query<{ credits: number }>(
      "UPDATE users SET credits = credits - $2 WHERE id = $1 AND credits >= $2 RETURNING credits",
      [input.userId, input.cost],
    );
    if (!charged.rows[0]) {
      const balance = await creditBalance(client, input.userId);
      return { state: "short", balance };
    }
    await client.query(
      "INSERT INTO ledger (id, user_id, delta, balance_after, note, tool_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,now())",
      [nid("led"), input.userId, -input.cost, charged.rows[0].credits, "生成预留", input.toolId],
    );
    if (row) {
      await client.query(
        "UPDATE generation_requests SET status = 'reserved', cost = $3, tool_id = $4, generation_id = NULL, updated_at = now() WHERE user_id = $1 AND idempotency_key = $2",
        [input.userId, input.idempotencyKey, input.cost, input.toolId],
      );
    } else {
      await client.query(
        "INSERT INTO generation_requests (user_id, idempotency_key, status, cost, tool_id, created_at, updated_at) VALUES ($1,$2,'reserved',$3,$4,now(),now())",
        [input.userId, input.idempotencyKey, input.cost, input.toolId],
      );
    }
    return { state: "held", requestKey: input.idempotencyKey };
  });
}

export async function commitReserved(input: { userId: string; requestKey: string; toolId: string; toolName: string; source: GenerationRecord["source"]; fields: Record<string, string>; result: ToolResult }) {
  return withTransaction(async (client) => {
    const existing = await client.query<RequestRow>("SELECT status, cost, generation_id, updated_at FROM generation_requests WHERE user_id = $1 AND idempotency_key = $2 FOR UPDATE", [input.userId, input.requestKey]);
    const row = existing.rows[0];
    if (!row) return null;
    if (row.status === "completed" && row.generation_id) {
      const record = await loadOwned(client, input.userId, row.generation_id);
      if (!record) return null;
      return { balance: await creditBalance(client, input.userId), record };
    }
    if (row.status !== "reserved") return null;
    const record = generationOf({
      id: nid("gen"),
      user_id: input.userId,
      tool_id: input.toolId,
      tool_name: input.toolName,
      source: input.source,
      created_at: new Date(),
      input: input.fields,
      result: input.result,
    });
    await client.query(
      "INSERT INTO generations (id, user_id, tool_id, tool_name, source, created_at, input, result) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)",
      [record.id, record.userId, record.toolId, record.toolName, record.source, record.createdAt, JSON.stringify(record.input), JSON.stringify(record.result)],
    );
    await client.query(
      "UPDATE ledger SET note = $3, generation_id = $4 WHERE id = (SELECT id FROM ledger WHERE user_id = $1 AND note = '生成预留' AND tool_id = $2 ORDER BY created_at DESC LIMIT 1)",
      [input.userId, input.toolId, `${input.toolName} −${row.cost}`, record.id],
    );
    await client.query("UPDATE generation_requests SET status = 'completed', generation_id = $3, updated_at = now() WHERE user_id = $1 AND idempotency_key = $2", [input.userId, input.requestKey, record.id]);
    return { balance: await creditBalance(client, input.userId), record };
  });
}

export async function refundReserved(userId: string, requestKey: string) {
  await withTransaction(async (client) => {
    await refundLocked(client, userId, requestKey);
  });
}

export async function recoverStaleReservations(now = Date.now()) {
  const cutoff = new Date(now - RESERVATION_TTL_MS);
  await withTransaction(async (client) => {
    const stale = await client.query<{ user_id: string; idempotency_key: string }>(
      "SELECT user_id, idempotency_key FROM generation_requests WHERE status = 'reserved' AND updated_at < $1 FOR UPDATE",
      [cutoff],
    );
    for (const row of stale.rows) await refundLocked(client, row.user_id, row.idempotency_key);
  });
}

async function refundLocked(client: pg.PoolClient, userId: string, requestKey: string) {
  const existing = await client.query<RequestRow>("SELECT status, cost, generation_id, updated_at FROM generation_requests WHERE user_id = $1 AND idempotency_key = $2 FOR UPDATE", [userId, requestKey]);
  const row = existing.rows[0];
  if (!row || row.status !== "reserved") return;
  const credited = await client.query<{ credits: number }>("UPDATE users SET credits = credits + $2 WHERE id = $1 RETURNING credits", [userId, row.cost]);
  await client.query(
    "INSERT INTO ledger (id, user_id, delta, balance_after, note, created_at) VALUES ($1,$2,$3,$4,'生成失败退回',now())",
    [nid("led"), userId, row.cost, credited.rows[0]?.credits ?? row.cost],
  );
  await client.query("UPDATE generation_requests SET status = 'refunded', updated_at = now() WHERE user_id = $1 AND idempotency_key = $2", [userId, requestKey]);
}

async function loadOwned(client: pg.PoolClient, userId: string, generationId: string) {
  const found = await client.query("SELECT * FROM generations WHERE user_id = $1 AND id = $2", [userId.trim(), generationId.trim()]);
  return found.rows[0] ? generationOf(found.rows[0]) : null;
}

async function creditBalance(client: pg.PoolClient, userId: string) {
  const found = await client.query<{ credits: number }>("SELECT credits FROM users WHERE id = $1", [userId]);
  return found.rows[0]?.credits ?? 0;
}
