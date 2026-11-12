import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { commitReserved, generationOwnedBy, recoverStaleReservations, refundReserved, register, requestKey, reserveGeneration, setCheckin } from "@/lib/db/accounts";
import { importStore, tableCounts, validateStore } from "@/lib/db/import-json";
import { migrate } from "@/lib/db/migrate";
import { closePool, getPool, withTransaction } from "@/lib/db/pool";
import { crossOriginResponse } from "@/lib/origin";

if (!process.env.DATABASE_URL && process.env.CI) throw new Error("DATABASE_URL is required in CI");

const enabled = Boolean(process.env.DATABASE_URL);
process.env.ALLOW_REGISTER = "1";

test("database accounts, reservations, import, and backup", { skip: enabled ? false : "DATABASE_URL is not set" }, async () => {
  await migrate();
  await resetTables();
  const origin = crossOriginResponse(new Request("http://app.local/api/generate", { method: "POST", headers: { origin: "https://evil.example", host: "app.local" } }));
  assert.equal(origin?.status, 403);

  const [first, second] = await Promise.all([
    register("sameuser", "password1", "甲"),
    register("sameuser", "password1", "乙"),
  ]);
  const winners = [first, second].filter((item) => !("error" in item));
  assert.equal(winners.length, 1);

  const low = await register("lowuser", "password1", "低");
  assert.ok(!("error" in low));
  await getPool().query("UPDATE users SET credits = 1 WHERE id = $1", [low.user.id]);
  const [left, right] = await Promise.all([
    reserveInProcess(low.user.id, "key-a-enough1"),
    reserveInProcess(low.user.id, "key-b-enough1"),
  ]);
  const heldKey = left.state === "held" ? "key-a-enough1" : right.state === "held" ? "key-b-enough1" : "";
  assert.ok(heldKey);
  assert.equal([left.state, right.state].filter((state) => state === "short").length, 1);

  const again = await reserveGeneration({ userId: low.user.id, cost: 1, toolId: "ai-preview", idempotencyKey: heldKey });
  assert.equal(again.state, "busy");
  const saved = await commitReserved({
    userId: low.user.id,
    requestKey: heldKey,
    toolId: "ai-preview",
    toolName: "AI预习",
    source: "mock",
    fields: { topic: "加法" },
    result: { title: "加法", subtitle: "", summary: "好", sections: [{ heading: "一", paragraphs: ["甲"] }, { heading: "二", paragraphs: ["乙"] }] },
  });
  assert.ok(saved);
  const replay = await reserveGeneration({ userId: low.user.id, cost: 1, toolId: "ai-preview", idempotencyKey: heldKey });
  assert.equal(replay.state, "replay");
  const balance = await credits(low.user.id);
  assert.equal(balance, 0);

  const payer = await register("payer", "password1", "付");
  assert.ok(!("error" in payer));
  await getPool().query("UPDATE users SET credits = 2 WHERE id = $1", [payer.user.id]);
  const reserved = await reserveGeneration({ userId: payer.user.id, cost: 2, toolId: "ai-paper", idempotencyKey: "refund-me" });
  assert.equal(reserved.state, "held");
  await refundReserved(payer.user.id, "refund-me");
  assert.equal(await credits(payer.user.id), 2);

  const crash = await reserveGeneration({ userId: payer.user.id, cost: 2, toolId: "ai-paper", idempotencyKey: "crash-me" });
  assert.equal(crash.state, "held");
  await getPool().query("UPDATE generation_requests SET updated_at = now() - interval '11 minutes' WHERE idempotency_key = 'crash-me'");
  await recoverStaleReservations();
  assert.equal(await credits(payer.user.id), 2);

  await Promise.all([
    setCheckin(payer.user.id, "2026-11-12", 1, true),
    setCheckin(payer.user.id, "2026-11-12", 1, true),
  ]);
  const checks = await getPool().query("SELECT count(*) FROM checkins WHERE user_id = $1", [payer.user.id]);
  assert.equal(Number(checks.rows[0].count), 1);

  assert.equal(await generationOwnedBy(payer.user.id, saved?.record.id ?? ""), null);

  const before = await tableCounts();
  await assert.rejects(withTransaction(async (client) => {
    await client.query("INSERT INTO users (id, username, display_name, password_hash, password_salt, credits, created_at) VALUES ('usr_roll','roll','回','a','b',1,now())");
    throw new Error("rollback");
  }));
  assert.equal((await tableCounts()).users, before.users);

  await closePool();
  assert.equal((await tableCounts()).users, before.users);

  await resetTables();
  const raw = JSON.parse(readFileSync(new URL("./fixtures/migration/synthetic-store.json", import.meta.url), "utf8"));
  const dry = validateStore(raw);
  assert.equal(dry.ok, true);
  assert.equal(dry.sessionsIgnored, true);
  assert.equal((await tableCounts()).users, 0);
  await importStore(raw);
  const dumped = dump();
  await resetTables();
  restore(dumped);
  const after = await tableCounts();
  assert.equal(after.users, 1);
  assert.equal(after.generations, 1);
  assert.equal((await generationOwnedBy("usr_synth", "gen_synth"))?.id, "gen_synth");
  assert.equal(requestKey(null, "usr_synth", "ai-preview", { topic: "加法" }).length, 64);
});

function reserveInProcess(userId: string, key: string) {
  return new Promise<{ state: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--experimental-strip-types", "--import", "./tests/register.mjs", "tests/db-reserve-worker.ts", userId, key], { env: process.env });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err += chunk; });
    child.on("exit", (code) => (code === 0 ? resolve(JSON.parse(out)) : reject(new Error(err || out))));
  });
}

async function resetTables() {
  await getPool().query("TRUNCATE generation_requests, ledger, generations, checkins, students, sessions, rate_limits, users RESTART IDENTITY CASCADE");
}

async function credits(userId: string) {
  const result = await getPool().query<{ credits: number }>("SELECT credits FROM users WHERE id = $1", [userId]);
  return result.rows[0]?.credits ?? -1;
}

function dump() {
  const dir = mkdtempSync(join(tmpdir(), "sw-db-"));
  const sql = execFileSync("pg_dump", ["--data-only", "--inserts", "--no-owner", "--exclude-table=schema_migrations", process.env.DATABASE_URL ?? ""], { encoding: "utf8" })
    .split("\n")
    .filter((line) => !line.startsWith("SET transaction_timeout"))
    .join("\n");
  return { dir, sql };
}

function restore(backup: { dir: string; sql: string }) {
  execFileSync("psql", [process.env.DATABASE_URL ?? "", "-v", "ON_ERROR_STOP=1"], { input: backup.sql });
  rmSync(backup.dir, { recursive: true, force: true });
}

