"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { ResultView } from "@/components/result-view";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MOCK_NOTICE } from "@/lib/ai/notice";
import { getTool, groupLabel, normalizeInput, type ToolField } from "@/lib/tools";
import type { PublicGeneration } from "@/lib/types";

export function ToolWorkspace({ toolId }: { toolId: string }) {
  const tool = getTool(toolId);
  const router = useRouter();
  const { ready, user, refresh } = useSession();
  const [input, setInput] = useState<Record<string, string>>(tool?.example ?? {});
  const [record, setRecord] = useState<PublicGeneration | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [loadedPast, setLoadedPast] = useState(false);
  const [live, setLive] = useState<boolean | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(`/workbench/${toolId}`)}`);
  }, [ready, user, router, toolId]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ai/status", { cache: "no-store", signal: controller.signal })
      .then(async (response) => (await response.json()) as { live?: boolean })
      .then((payload) => {
        if (!controller.signal.aborted) setLive(Boolean(payload.live));
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (!controller.signal.aborted) setLive(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!user || !tool) return;
    const controller = new AbortController();
    fetch(`/api/generations?toolId=${tool.id}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { item: PublicGeneration | null };
      })
      .then((payload) => {
        if (controller.signal.aborted || !payload?.item) return;
        setRecord(payload.item);
        setLoadedPast(true);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [user, tool]);

  const missing = useMemo(() => {
    if (!tool) return true;
    return tool.fields.some((field) => field.required && !(input[field.name] ?? "").trim());
  }, [tool, input]);

  if (!tool) return null;
  if (!ready || !user) return <p className="mx-auto max-w-6xl px-4 py-24 text-sm text-muted-foreground">正在确认本地账号…</p>;

  const short = user.credits < tool.cost;

  async function onFile(field: ToolField, file: File | undefined) {
    if (!file) {
      setInput((current) => ({ ...current, [field.name]: "", [`${field.name}Text`]: "" }));
      return;
    }
    const textual = /text|json|markdown|csv|plain/.test(file.type) || /\.(txt|md|json|csv)$/i.test(file.name);
    const text = textual && file.size < 200_000
      ? (await file.text()).slice(0, 8000)
      : `（已选择 ${file.name}，${Math.max(1, Math.ceil(file.size / 1024))} KB。演示环境不识别图片和二进制。）`;
    setInput((current) => ({ ...current, [field.name]: file.name, [`${field.name}Text`]: text }));
  }

  async function generate() {
    setError("");
    const normalized = normalizeInput(tool!, input);
    if (!normalized.ok) {
      setError(normalized.error);
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId: tool!.id, input }),
      });
      const payload = (await response.json()) as PublicGeneration & { error?: string };
      if (response.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/workbench/${toolId}`)}`);
        return;
      }
      if (!response.ok) {
        setError(payload.error || "没有生成成功");
        return;
      }
      setRecord(payload);
      setLoadedPast(false);
      await refresh();
    } catch {
      setError("网络中断，点数未扣除。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-sm text-muted-foreground">
        <Link href="/workbench" className="hover:text-foreground">工作台</Link>
        <span> / {groupLabel(tool.group)} / {tool.name}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{tool.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{tool.detail}</p>
          {live === false ? <p className="mt-2 max-w-2xl text-sm leading-6 text-clay">{MOCK_NOTICE}</p> : null}
        </div>
        <p className="text-sm">本次 <span className="font-semibold">{tool.cost}</span> 点 · 余额 {user.credits}</p>
      </div>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <form
          className="space-y-4 rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-20"
          onSubmit={(event) => {
            event.preventDefault();
            void generate();
          }}
        >
          {tool.fields.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <Label htmlFor={field.name}>{field.label}{field.required ? <span className="text-clay"> *</span> : null}</Label>
              {field.type === "select" ? (
                <Select value={input[field.name] ?? ""} onValueChange={(value) => { if (!value) return; setInput((current) => ({ ...current, [field.name]: value })); }}>
                  <SelectTrigger id={field.name} className="w-full"><SelectValue placeholder="请选择" /></SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : field.type === "textarea" ? (
                <Textarea id={field.name} rows={field.rows ?? 4} className="min-h-24" placeholder={field.placeholder} value={input[field.name] ?? ""} onChange={(event) => setInput((current) => ({ ...current, [field.name]: event.target.value }))} />
              ) : field.type === "file" ? (
                <Input id={field.name} type="file" accept=".txt,.md,.json,.csv,image/*" onChange={(event) => void onFile(field, event.target.files?.[0])} />
              ) : (
                <Input id={field.name} inputMode={field.numeric ? "decimal" : "text"} placeholder={field.placeholder} value={input[field.name] ?? ""} onChange={(event) => setInput((current) => ({ ...current, [field.name]: event.target.value }))} />
              )}
              {field.hint ? <p className="text-xs leading-5 text-muted-foreground">{field.hint}</p> : null}
              {field.type === "file" && input[field.name] ? <p className="text-xs text-muted-foreground">已选 {input[field.name]}</p> : null}
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" className="h-10 px-4" disabled={pending || missing || short}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              生成 · {tool.cost} 点
            </Button>
            <Button type="button" variant="outline" className="h-10" onClick={() => { setInput(tool.example); setError(""); }}>填入示例</Button>
          </div>
          {short ? <p className="text-sm text-clay">点数不够。这次需要 {tool.cost} 点。</p> : null}
          {missing ? <p className="text-xs text-muted-foreground">带星号的栏目填完才能生成。</p> : null}
        </form>
        <div className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6">
          {loadedPast && record ? <p className="mb-4 text-xs text-muted-foreground">这是上一次留在本机的结果。</p> : null}
          <ResultView record={record} pending={pending} error={error} empty={tool.empty} live={live} />
        </div>
      </div>
    </div>
  );
}
