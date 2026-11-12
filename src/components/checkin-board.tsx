"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STEPS } from "@/lib/content";
import { WEEKDAY, dayCount, isoDate, startOfWeek, streakFrom, weekDays } from "@/lib/dates";
import { useSession } from "@/components/session-provider";
import type { CheckinsResponse } from "@/lib/types";

export function CheckinBoard() {
  const { user } = useSession();
  return <CheckinBoardInner key={user?.id ?? "guest"} />;
}

function CheckinBoardInner() {
  const [data, setData] = useState<CheckinsResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/checkins", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("fail");
        return (await response.json()) as CheckinsResponse;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setData(payload);
        setToday(isoDate(new Date()));
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, []);

  async function reload() {
    setMessage("");
    setState("loading");
    try {
      const response = await fetch("/api/checkins", { cache: "no-store" });
      if (!response.ok) throw new Error("fail");
      setData((await response.json()) as CheckinsResponse);
      setToday(isoDate(new Date()));
      setState("ready");
    } catch {
      setState("error");
    }
  }

  async function toggle(date: string, step: number, done: boolean) {
    if (!data || data.readonly) return;
    setMessage("");
    const previous = data;
    const next = data.checkins.filter((item) => !(item.date === date && item.step === step));
    if (done) next.push({ date, step, done: true });
    setData({ ...data, checkins: next });
    const response = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, step, done }),
    });
    if (!response.ok) {
      setData(previous);
      setMessage("这一格没有记下，请再点一次。");
    }
  }

  if (state === "error") {
    return (
      <div className="mt-6 rounded-2xl border border-clay/30 bg-accent p-4 text-sm text-clay">
        打卡板没有加载出来。
        <button className="ml-3 underline" onClick={() => void reload()} type="button">
          再试一次
        </button>
      </div>
    );
  }
  if (state !== "ready" || !data || !today) return <div className="mt-6 h-64 animate-pulse rounded-2xl bg-secondary" />;

  const anchor = startOfWeek(dateFromIso(today));
  const days = weekDays(anchor);
  const weekDone = days.reduce((sum, day) => sum + dayCount(data.checkins, isoDate(day)), 0);

  return (
    <div className="mt-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="本周已勾" value={`${weekDone}/42`} />
        <Stat label="连续达标" value={`${streakFrom(data.checkins, anchor)} 天`} hint="一天勾满 4 步算达标" />
        <Stat label="档案" value={data.student.name} hint={data.readonly ? "登录后才能改" : data.student.grade} />
      </div>
      {data.readonly ? (
        <p className="mt-4 text-sm text-muted-foreground">
          现在是只读预览。
          <Link href="/login?next=/checkin" className="ml-1 text-pine">登录演示账号</Link>
          后可以勾选。
        </p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-clay">{message}</p> : null}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[7rem_repeat(7,minmax(0,1fr))] border-b border-border text-sm">
            <div className="px-3 py-3 text-muted-foreground">步骤</div>
            {days.map((day, index) => {
              const key = isoDate(day);
              return (
                <div key={key} className={`px-2 py-3 text-center ${key === today ? "bg-secondary" : ""}`}>
                  <div className="font-medium">{WEEKDAY[index]}</div>
                  <div className="text-xs text-muted-foreground">{day.getMonth() + 1}/{day.getDate()}</div>
                </div>
              );
            })}
          </div>
          {STEPS.map((step) => (
            <div key={step.id} className="grid grid-cols-[7rem_repeat(7,minmax(0,1fr))] border-b border-border last:border-b-0">
              <div className="px-3 py-3">
                <p className="text-sm font-medium">{step.id}. {step.name}</p>
              </div>
              {days.map((day) => {
                const key = isoDate(day);
                const on = data.checkins.some((item) => item.date === key && item.step === step.id && item.done);
                return (
                  <div key={`${step.id}-${key}`} className={`flex items-center justify-center ${key === today ? "bg-secondary/60" : ""}`}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`${key} ${step.name}`}
                      disabled={data.readonly}
                      onClick={() => void toggle(key, step.id, !on)}
                      className={`size-8 rounded-md border text-sm ${on ? "border-pine bg-pine text-primary-foreground" : "border-border bg-card text-transparent"} disabled:cursor-not-allowed disabled:opacity-70`}
                    >
                      {on ? "✓" : "·"}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function dateFromIso(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
