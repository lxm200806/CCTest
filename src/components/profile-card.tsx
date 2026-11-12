"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dayCount, isoDate, streakFrom, weekDays } from "@/lib/dates";
import { useSession } from "@/components/session-provider";
import type { CheckinsResponse } from "@/lib/types";

export function ProfileCard() {
  const { user } = useSession();
  return <ProfileCardInner key={user?.id ?? "guest"} />;
}

function ProfileCardInner() {
  const [data, setData] = useState<CheckinsResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

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
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, []);

  if (state === "loading") {
    return (
      <aside className="rounded-2xl border border-border bg-card p-5">
        <div className="h-4 w-24 animate-pulse rounded bg-secondary" />
        <div className="mt-4 h-8 w-40 animate-pulse rounded bg-secondary" />
      </aside>
    );
  }
  if (state === "error" || !data) {
    return (
      <aside className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium">演示档案暂时没读到</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">刷新页面再试。方法页本身不依赖这份档案。</p>
      </aside>
    );
  }
  const days = weekDays();
  const done = days.reduce((sum, day) => sum + dayCount(data.checkins, isoDate(day)), 0);
  return (
    <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs tracking-wide text-pine">当前档案{data.readonly ? " · 只读预览" : ""}</p>
      <h2 className="mt-2 text-2xl font-semibold">{data.student.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{data.student.grade} · {data.student.school}</p>
      <p className="mt-4 text-sm leading-6">{data.student.goal}</p>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-secondary px-2 py-2"><dt className="text-[11px] text-muted-foreground">本周步骤</dt><dd className="text-lg font-semibold">{done}/42</dd></div>
        <div className="rounded-lg bg-secondary px-2 py-2"><dt className="text-[11px] text-muted-foreground">连续达标</dt><dd className="text-lg font-semibold">{streakFrom(data.checkins)} 天</dd></div>
        <div className="rounded-lg bg-secondary px-2 py-2"><dt className="text-[11px] text-muted-foreground">单科时长</dt><dd className="text-lg font-semibold">{data.student.weeklyMinutes}′</dd></div>
      </dl>
      <ul className="mt-4 space-y-2">
        {data.student.subjects.map((subject) => (
          <li key={subject.name} className="flex items-baseline justify-between gap-3 text-sm">
            <span>{subject.name}<span className="ml-2 text-muted-foreground">{subject.note}</span></span>
            <span className={subject.level === "需加强" ? "text-clay" : "text-pine"}>{subject.level}</span>
          </li>
        ))}
      </ul>
      <Link href="/checkin" className="mt-4 inline-block text-sm font-medium text-pine">看打卡板</Link>
    </aside>
  );
}
