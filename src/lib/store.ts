import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import { presentLedger } from "@/lib/present";
import type { GenerationRecord, LedgerItem, PublicUser, Student, SubjectNote } from "@/lib/types";

type UserRow = PublicUser & {
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
};

type SessionRow = { token: string; userId: string; createdAt: string };
type CheckinRow = { id: string; userId: string; date: string; step: number; done: boolean };
type LedgerRow = LedgerItem & { userId: string };

type Db = {
  version: 1;
  users: UserRow[];
  sessions: SessionRow[];
  students: Student[];
  checkins: CheckinRow[];
  ledger: LedgerRow[];
  generations: GenerationRecord[];
};

const FILE = path.join(process.cwd(), "data", "store.json");
export const DEMO_USER_ID = "usr_demo";
export const DEMO_USERNAME = "demo";
export const DEMO_PASSWORD = "demo123";

let memory: Db | null = null;
let queue: Promise<unknown> = Promise.resolve();

function nid(prefix: string) {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 32).toString("hex") };
}

function isoOffset(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function demoStudent(userId: string): Student {
  const subjects: SubjectNote[] = [
    { name: "数学", level: "需加强", note: "图像与待定系数" },
    { name: "英语", level: "稳定", note: "阅读细节题" },
    { name: "语文", level: "稳定", note: "说明文概括" },
    { name: "物理", level: "入门", note: "速度的计算" },
  ];
  return {
    id: "stu_lin",
    userId,
    name: "林晓禾",
    gradeBand: "junior",
    grade: "初二",
    school: "澄明实验中学（演示）",
    guardian: "林老师",
    goal: "期中数学从 78 分提到 88 分，只盯一次函数。",
    weeklyMinutes: 40,
    focus: "一次函数的图像和解析式",
    subjects,
  };
}

function seed(): Db {
  const { salt, hash } = hashPassword(DEMO_PASSWORD);
  const createdAt = new Date().toISOString();
  const checkins: CheckinRow[] = [];
  const plan: [number, number][] = [
    [-3, 6],
    [-2, 6],
    [-1, 5],
    [0, 2],
  ];
  for (const [offset, steps] of plan) {
    const date = isoOffset(offset);
    for (let step = 1; step <= steps; step += 1) {
      checkins.push({ id: `chk_${offset}_${step}`, userId: DEMO_USER_ID, date, step, done: true });
    }
  }
  return {
    version: 1,
    users: [
      {
        id: DEMO_USER_ID,
        username: DEMO_USERNAME,
        displayName: "林老师",
        credits: 36,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt,
      },
    ],
    sessions: [],
    students: [demoStudent(DEMO_USER_ID)],
    checkins,
    ledger: [
      {
        id: "led_seed",
        userId: DEMO_USER_ID,
        delta: 36,
        balanceAfter: 36,
        note: "演示账号初始点数",
        createdAt,
      },
    ],
    generations: [],
  };
}

function load(): Db {
  if (memory) return memory;
  if (!fs.existsSync(FILE)) {
    memory = seed();
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(memory, null, 2));
    return memory;
  }
  memory = JSON.parse(fs.readFileSync(FILE, "utf8")) as Db;
  return memory;
}

function save(db: Db) {
  memory = db;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export function updateStore<T>(mutator: (db: Db) => T): Promise<T> {
  const job = queue.then(() => {
    const db = structuredClone(load());
    const result = mutator(db);
    save(db);
    return result;
  });
  queue = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

export function readStore() {
  return structuredClone(load());
}

function passwordsMatch(password: string, salt: string, hash: string) {
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

export function toPublicUser(user: UserRow): PublicUser {
  return { id: user.id, username: user.username, displayName: user.displayName, credits: user.credits };
}

export function findUserByToken(token: string): PublicUser | null {
  const db = readStore();
  const session = db.sessions.find((item) => item.token === token);
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.userId);
  return user ? toPublicUser(user) : null;
}

export function studentFor(userId: string) {
  return readStore().students.find((item) => item.userId === userId) ?? null;
}

export function recentLedger(userId: string, limit = 8): LedgerItem[] {
  return readStore()
    .ledger.filter((item) => item.userId === userId)
    .slice(-limit)
    .reverse()
    .map((item) => presentLedger(item));
}

export async function login(username: string, password: string) {
  const db = readStore();
  const user = db.users.find((item) => item.username === username.trim());
  if (!user || !passwordsMatch(password, user.passwordSalt, user.passwordHash)) return null;
  const token = randomBytes(24).toString("hex");
  await updateStore((draft) => {
    draft.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
    const own = draft.sessions.filter((item) => item.userId === user.id);
    const rest = draft.sessions.filter((item) => item.userId !== user.id);
    draft.sessions = [...rest, ...own.slice(-8)];
  });
  return { token, user: toPublicUser(user) };
}

export async function logout(token: string) {
  await updateStore((draft) => {
    draft.sessions = draft.sessions.filter((item) => item.token !== token);
  });
}

export async function register(username: string, password: string, displayName: string) {
  const name = username.trim();
  const shown = displayName.trim();
  if (!/^[\w\u4e00-\u9fa5]{2,20}$/.test(name)) return { error: "账号用 2 到 20 位字母、数字或中文" };
  if (password.length < 6) return { error: "密码至少 6 位" };
  if (shown.length < 1 || shown.length > 20) return { error: "显示名称请控制在 20 字以内" };
  if (readStore().users.some((item) => item.username === name)) return { error: "这个账号已经有了" };
  const { salt, hash } = hashPassword(password);
  const userId = nid("usr");
  const createdAt = new Date().toISOString();
  const token = randomBytes(24).toString("hex");
  const student: Student = {
    id: nid("stu"),
    userId,
    name: shown,
    gradeBand: "junior",
    grade: "初二",
    school: "未填写学校",
    guardian: shown,
    goal: "先定一个两周内能看到的小目标",
    weeklyMinutes: 30,
    focus: "先从一门学科开始",
    subjects: [
      { name: "数学", level: "稳定", note: "待观察" },
      { name: "语文", level: "稳定", note: "待观察" },
      { name: "英语", level: "稳定", note: "待观察" },
    ],
  };
  await updateStore((draft) => {
    draft.users.push({
      id: userId,
      username: name,
      displayName: shown,
      credits: 20,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt,
    });
    draft.students.push(student);
    draft.sessions.push({ token, userId, createdAt });
    draft.ledger.push({
      id: nid("led"),
      userId,
      delta: 20,
      balanceAfter: 20,
      note: "新账号初始点数",
      createdAt,
    });
  });
  return { token, user: { id: userId, username: name, displayName: shown, credits: 20 } satisfies PublicUser };
}

export function checkinsFor(userId: string) {
  return readStore()
    .checkins.filter((item) => item.userId === userId && item.done)
    .map((item) => ({ date: item.date, step: item.step, done: true }));
}

export async function setCheckin(userId: string, date: string, step: number, done: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || step < 1 || step > 6) return { error: "打卡日期或步骤不对" };
  await updateStore((draft) => {
    draft.checkins = draft.checkins.filter((item) => !(item.userId === userId && item.date === date && item.step === step));
    if (done) draft.checkins.push({ id: nid("chk"), userId, date, step, done: true });
  });
  return { ok: true as const };
}

export async function spendAndSave(input: {
  userId: string;
  cost: number;
  toolId: string;
  toolName: string;
  source: GenerationRecord["source"];
  fields: Record<string, string>;
  result: GenerationRecord["result"];
}) {
  return updateStore((draft) => {
    const user = draft.users.find((item) => item.id === input.userId);
    if (!user || user.credits < input.cost) return null;
    user.credits -= input.cost;
    const createdAt = new Date().toISOString();
    const record: GenerationRecord = {
      id: nid("gen"),
      userId: input.userId,
      toolId: input.toolId,
      toolName: input.toolName,
      source: input.source,
      createdAt,
      input: input.fields,
      result: input.result,
    };
    draft.ledger.push({
      id: nid("led"),
      userId: user.id,
      delta: -input.cost,
      balanceAfter: user.credits,
      note: `${input.toolName} −${input.cost}`,
      toolId: input.toolId,
      createdAt,
    });
    const own = draft.generations.filter((item) => item.userId === user.id);
    const others = draft.generations.filter((item) => item.userId !== user.id);
    draft.generations = [...others, ...own.slice(-39), record];
    return { balance: user.credits, record };
  });
}

export function latestGeneration(userId: string, toolId: string) {
  return readStore().generations.filter((item) => item.userId === userId && item.toolId === toolId).at(-1) ?? null;
}
