"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STEPS } from "@/lib/content";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/workbench";
  const { refresh } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("demo123");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body = mode === "login" ? { username, password } : { username, password, displayName };
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "没有进入");
        return;
      }
      await refresh();
      router.replace(next.startsWith("/") ? next : "/workbench");
    } catch {
      setError("网络中断，请再试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 lg:grid-cols-2">
      <section>
        <p className="text-sm text-pine">本地账号</p>
        <h1 className="mt-2 text-3xl font-semibold">进入工作台</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">演示账号 demo / demo123，初始 36 点。账号和点数都写在这台电脑上。</p>
        <ol className="mt-6 space-y-2">
          {STEPS.map((step) => (
            <li key={step.id} className="text-sm leading-6">
              <span className="mr-2 font-medium text-pine">{step.id}</span>
              {step.name}
              <span className="text-muted-foreground"> · {step.brief}</span>
            </li>
          ))}
        </ol>
      </section>
      <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex gap-2 text-sm">
          <button type="button" className={mode === "login" ? "font-medium text-pine" : "text-muted-foreground"} onClick={() => setMode("login")}>登录</button>
          <button type="button" className={mode === "register" ? "font-medium text-pine" : "text-muted-foreground"} onClick={() => setMode("register")}>创建本地账号</button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">账号</Label>
          <Input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </div>
        {mode === "register" ? (
          <div className="space-y-1.5">
            <Label htmlFor="displayName">显示名称</Label>
            <Input id="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：陈老师" />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="password">密码</Label>
          <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </div>
        {error ? <p className="text-sm text-clay">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-10 px-4" disabled={pending}>{pending ? "正在进入…" : mode === "login" ? "登录" : "创建并进入"}</Button>
          {mode === "login" ? (
            <Button type="button" variant="outline" className="h-10" onClick={() => { setUsername("demo"); setPassword("demo123"); setError(""); }}>填入演示账号</Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
