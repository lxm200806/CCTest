"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChartNoAxesCombined, Clapperboard, Copy, FileText, Files, GitBranch, MessageSquareText, NotebookPen, Presentation, ScrollText, Share2, SquareCheck, Sunrise, Waypoints, type LucideIcon } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GROUPS, TOOLS, type ToolGroupId } from "@/lib/tools";

const ICONS: Record<string, LucideIcon> = {
  "ai-lesson": Clapperboard,
  "ai-prep": NotebookPen,
  "ai-handout": ScrollText,
  "ai-teaching-aid": BookOpen,
  "ai-preview": Sunrise,
  "ai-ppt": Presentation,
  "ai-visualize": Waypoints,
  "ai-explain": MessageSquareText,
  "ai-paper": Files,
  "ai-grade": SquareCheck,
  "ai-variant": Copy,
  "ai-word": FileText,
  "ai-extend": GitBranch,
  "ai-analysis": Share2,
  "ai-score-plan": ChartNoAxesCombined,
};

export function WorkbenchHome() {
  const router = useRouter();
  const { ready, user } = useSession();
  const [group, setGroup] = useState<"all" | ToolGroupId>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/workbench");
  }, [ready, user, router]);

  const visible = useMemo(() => {
    const q = query.trim();
    return TOOLS.filter((tool) => (group === "all" ? true : tool.group === group)).filter((tool) => !q || `${tool.name}${tool.blurb}${tool.detail}`.includes(q));
  }, [group, query]);

  if (!ready || !user) return <p className="mx-auto max-w-6xl px-4 py-24 text-sm text-muted-foreground">正在确认本地账号…</p>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-pine">工具台 · 15 个入口</p>
          <h1 className="mt-1 text-3xl font-semibold">工作台</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">四个组，点进去就能生成。常用的五张卡做了标记。余额 {user.credits} 点，每次生成会扣掉卡片上的点数。</p>
        </div>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索工具" className="h-10 w-full sm:w-56" aria-label="搜索工具" />
      </div>
      <Tabs value={group} onValueChange={(value) => setGroup(value as "all" | ToolGroupId)} className="mt-6">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="all">全部</TabsTrigger>
          {GROUPS.map((item) => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value={group} className="mt-4">
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">没有符合「{query}」的工具。</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((tool) => {
                const Icon = ICONS[tool.id] ?? BookOpen;
                const groupName = GROUPS.find((item) => item.id === tool.group)?.label;
                return (
                  <Link key={tool.id} href={`/workbench/${tool.id}`} className="flex min-h-40 flex-col rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-pine/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex size-9 items-center justify-center rounded-lg bg-secondary text-pine"><Icon className="size-4" /></span>
                      <span className="text-xs text-muted-foreground">{tool.cost} 点</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <h2 className="text-lg font-semibold">{tool.name}</h2>
                      {tool.featured ? <Badge className="bg-clay text-white">常用</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{groupName}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{tool.blurb}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
