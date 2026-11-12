"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { ResultView } from "@/components/result-view";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MOCK_NOTICE } from "@/lib/ai/notice";
import { OcrPanel } from "@/components/ocr-panel";
import { draftKey, readDraft, writeDraft } from "@/lib/drafts";
import { OCR_MAX_BYTES, placeConfirmedText } from "@/lib/ocr/image";
import { createSingleFlight } from "@/lib/submit-guard";
import { fieldIssues, getTool, groupLabel, normalizeInput, type ToolField } from "@/lib/tools";
import type { PublicGeneration } from "@/lib/types";

const EMPTY_EXAMPLE: Record<string, string> = {};

function subscribeDraft(onStoreChange: () => void) {
  window.addEventListener("sw-draft", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("sw-draft", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function useDraftInput(toolId: string, example: Record<string, string>) {
  const raw = useSyncExternalStore(
    subscribeDraft,
    () => window.localStorage.getItem(draftKey(toolId)) ?? "",
    () => "",
  );
  const input = useMemo(() => {
    if (!raw) return example;
    const saved = readDraft({ getItem: () => raw }, toolId);
    return { ...example, ...(saved ?? {}) };
  }, [example, raw, toolId]);
  const setInput = useCallback((update: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)) => {
    const next = typeof update === "function" ? update(input) : update;
    writeDraft(window.localStorage, toolId, next);
    window.dispatchEvent(new Event("sw-draft"));
  }, [input, toolId]);
  return [input, setInput] as const;
}

export function ToolWorkspace({ toolId }: { toolId: string }) {
  const tool = getTool(toolId);
  const router = useRouter();
  const { ready, user, refresh } = useSession();
  const [input, setInput] = useDraftInput(toolId, tool?.example ?? EMPTY_EXAMPLE);
  const [record, setRecord] = useState<PublicGeneration | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [loadedPast, setLoadedPast] = useState(false);
  const [live, setLive] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [balanceNote, setBalanceNote] = useState<number | null>(null);
  const flight = useRef(createSingleFlight());
  const resultRef = useRef<HTMLDivElement>(null);
  const wasPending = useRef(false);
  const activeTool = useRef(toolId);
  const freshResult = useRef(false);
  const mounted = useRef(true);
  const [scan, setScan] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => () => {
    mounted.current = false;
  }, []);

  useEffect(() => {
    return () => {
      if (scan) URL.revokeObjectURL(scan.url);
    };
  }, [scan]);

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
        setRecord((current) => (current || freshResult.current ? current : payload.item));
        setLoadedPast((current) => (freshResult.current ? current : true));
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [user, tool]);

  useEffect(() => {
    if (wasPending.current && !pending) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    wasPending.current = pending;
  }, [pending]);

  const issues = useMemo(() => (tool ? fieldIssues(tool, input) : []), [tool, input]);
  const issueFor = (name: string) => {
    const issue = issues.find((item) => item.name === name);
    if (!issue) return "";
    return submitted || touched[name] ? issue.message : "";
  };

  if (!tool) return null;
  if (!ready || !user) return <p className="mx-auto max-w-6xl px-4 py-24 text-base text-muted-foreground">正在确认本地账号…</p>;

  const short = user.credits < tool.cost;

  function clearFileInput(fieldName: string) {
    const element = document.getElementById(fieldName);
    if (element instanceof HTMLInputElement) element.value = "";
  }

  async function onFile(field: ToolField, file: File | undefined) {
    if (!file) {
      setScan(null);
      setInput((current) => ({ ...current, [field.name]: "", [`${field.name}Text`]: "" }));
      return;
    }
    const raster = file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/jpg" || file.type === "image/webp";
    if (raster) {
      if (!tool?.ocrTargets?.length) {
        setScan(null);
        setInput((current) => ({ ...current, [field.name]: file.name, [`${field.name}Text`]: "图片不会直接送给模型。请把需要批改的文字贴到文本框。" }));
        return;
      }
      if (file.size > OCR_MAX_BYTES) {
        setError("图片超过 4MB，没有开始识别。这次不扣点。");
        clearFileInput(field.name);
        return;
      }
      setScan({ file, url: URL.createObjectURL(file) });
      setInput((current) => ({
        ...current,
        [field.name]: file.name,
        [`${field.name}Text`]: "图片未交给模型。批改只使用题目和作答里已经确认的文字。",
      }));
      return;
    }
    setScan(null);
    const textual = /text|json|markdown|csv|plain/.test(file.type) || /\.(txt|md|json|csv)$/i.test(file.name);
    const text = textual && file.size < 200_000
      ? (await file.text()).slice(0, 8000)
      : `（已选择 ${file.name}。这种文件不会被当作图片识别。）`;
    setInput((current) => ({ ...current, [field.name]: file.name, [`${field.name}Text`]: text }));
  }

  function placeOcr(fieldName: string, recognized: string) {
    const result = placeConfirmedText(input[fieldName] ?? "", recognized);
    if (!result.ok) return result.error;
    setInput((current) => ({ ...current, [fieldName]: result.value }));
    return "";
  }

  function restoreExample() {
    setInput(tool!.example);
    setError("");
    setSubmitted(false);
  }

  function restoreRecordInput(next: Record<string, string>) {
    setInput({ ...tool!.example, ...next });
    setError("");
  }

  async function generate() {
    if (!flight.current.start()) return;
    const requestedTool = tool!.id;
    setSubmitted(true);
    setError("");
    const normalized = normalizeInput(tool!, input);
    if (!normalized.ok) {
      setError(normalized.error);
      flight.current.finish();
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId: tool!.id, input }),
      });
      const payload = (await response.json()) as PublicGeneration & { error?: string; balance?: number };
      if (!mounted.current || activeTool.current !== requestedTool) return;
      if (response.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/workbench/${toolId}`)}`);
        return;
      }
      if (!response.ok) {
        setError(payload.error || "没有生成成功。点数未扣除。");
        return;
      }
      freshResult.current = true;
      setRecord(payload);
      setLoadedPast(false);
      setBalanceNote(typeof payload.balance === "number" ? payload.balance : null);
      await refresh();
    } catch {
      if (mounted.current && activeTool.current === requestedTool) setError("网络中断，点数未扣除。可以再试一次。");
    } finally {
      flight.current.finish();
      if (mounted.current && activeTool.current === requestedTool) setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <p className="text-sm text-muted-foreground">
        <Link href="/workbench" className="hover:text-foreground">工作台</Link>
        <span> / {groupLabel(tool.group)} / {tool.name}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold sm:text-3xl">{tool.name}</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">{tool.detail}</p>
          {live === false ? <p className="mt-2 max-w-2xl text-base leading-7 text-clay">{MOCK_NOTICE}</p> : null}
          {live === true ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">当前会调用已配置的模型。失败、超时或结果不合格都不扣点。</p> : null}
        </div>
        <p className="text-base">本次成功后扣 <span className="font-semibold">{tool.cost}</span> 点 · 余额 {user.credits}</p>
      </div>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <form
          className="space-y-4 rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-20"
          aria-busy={pending}
          onSubmit={(event) => {
            event.preventDefault();
            void generate();
          }}
        >
          <p className="text-sm leading-6 text-muted-foreground">标 * 的是必填。填写会留在这台浏览器，刷新后还在。只有生成成功才扣点。</p>
          {tool.fields.map((field) => {
            const message = issueFor(field.name);
            const describedBy = [field.hint ? `${field.name}-hint` : "", message ? `${field.name}-error` : ""].filter(Boolean).join(" ") || undefined;
            return (
              <div key={field.name} className="space-y-1.5">
                <Label htmlFor={field.name} className="text-base">
                  {field.label}
                  {field.required ? <span className="text-clay"> *</span> : null}
                </Label>
                {field.type === "select" ? (
                  <Select
                    value={input[field.name] ?? ""}
                    items={Object.fromEntries((field.options ?? []).map((option) => [option.value, option.label]))}
                    onValueChange={(value) => {
                      if (!value) return;
                      setInput((current) => ({ ...current, [field.name]: value }));
                    }}
                  >
                    <SelectTrigger
                      id={field.name}
                      className="h-11 w-full min-h-11 text-base data-[size=default]:h-11 md:text-base"
                      aria-invalid={Boolean(message)}
                      aria-describedby={describedBy}
                      disabled={pending}
                      onBlur={() => setTouched((current) => ({ ...current, [field.name]: true }))}
                    >
                      <SelectValue placeholder="请选择" />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((option) => <SelectItem key={option.value} value={option.value} className="min-h-11 py-2 text-base">{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : field.type === "textarea" ? (
                  <Textarea
                    id={field.name}
                    rows={field.rows ?? 4}
                    className="min-h-28 text-base md:text-base"
                    placeholder={field.placeholder}
                    value={input[field.name] ?? ""}
                    aria-invalid={Boolean(message)}
                    aria-describedby={describedBy}
                    disabled={pending}
                    onBlur={() => setTouched((current) => ({ ...current, [field.name]: true }))}
                    onChange={(event) => setInput((current) => ({ ...current, [field.name]: event.target.value }))}
                  />
                ) : field.type === "file" ? (
                  <Input
                    id={field.name}
                    className="h-11 text-base md:text-base"
                    type="file"
                    accept={field.accept ?? ".txt,.md,.json,.csv,image/png,image/jpeg,image/webp"}
                    aria-invalid={Boolean(message)}
                    aria-describedby={describedBy}
                    disabled={pending}
                    onChange={(event) => void onFile(field, event.target.files?.[0])}
                  />
                ) : (
                  <Input
                    id={field.name}
                    className="h-11 text-base md:text-base"
                    inputMode={field.numeric ? "decimal" : "text"}
                    placeholder={field.placeholder}
                    value={input[field.name] ?? ""}
                    aria-invalid={Boolean(message)}
                    aria-describedby={describedBy}
                    disabled={pending}
                    onBlur={() => setTouched((current) => ({ ...current, [field.name]: true }))}
                    onChange={(event) => setInput((current) => ({ ...current, [field.name]: event.target.value }))}
                  />
                )}
                {field.hint ? <p id={`${field.name}-hint`} className="text-sm leading-6 text-muted-foreground">{field.hint}</p> : null}
                {message ? <p id={`${field.name}-error`} className="text-sm leading-6 text-clay" role="alert">{message}</p> : null}
                {field.type === "file" && input[field.name] ? <p className="text-sm text-muted-foreground">已选 {input[field.name]}。图片本身不会留在草稿里。</p> : null}
                {field.type === "file" && scan && tool.ocrTargets?.length ? (
                  <OcrPanel
                    file={scan.file}
                    previewUrl={scan.url}
                    disabled={pending}
                    targets={tool.ocrTargets.flatMap((name) => {
                      const match = tool.fields.find((item) => item.name === name);
                      return match ? [{ name, label: match.label }] : [];
                    })}
                    onRemove={() => {
                      setScan(null);
                      setInput((current) => ({ ...current, [field.name]: "", [`${field.name}Text`]: "" }));
                      clearFileInput(field.name);
                    }}
                    onPlace={placeOcr}
                  />
                ) : null}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" className="h-11 min-h-11 px-4 text-base" disabled={pending || short}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {pending ? "正在生成" : `生成 · ${tool.cost} 点`}
            </Button>
            <Button type="button" variant="outline" className="h-11 min-h-11 text-base" disabled={pending} onClick={restoreExample}>填入示例</Button>
          </div>
          {short ? <p className="text-base text-clay">点数不够。这次需要 {tool.cost} 点，当前没有扣点。</p> : null}
          <p className="text-sm leading-6 text-muted-foreground">
            <a href="#tool-result" className="text-pine underline-offset-2 hover:underline">跳到结果</a>
          </p>
        </form>
        <div id="tool-result" ref={resultRef} className="min-w-0 scroll-mt-24 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <ResultView
            record={record}
            pending={pending}
            error={error}
            empty={tool.empty}
            live={live}
            cost={tool.cost}
            loadedPast={loadedPast}
            balanceNote={balanceNote}
            onRetry={() => void generate()}
            onRestoreInput={restoreRecordInput}
            exportKind={tool.id === "ai-ppt" ? "pptx" : tool.id === "ai-word" ? "docx" : null}
          />
        </div>
      </div>
    </div>
  );
}
