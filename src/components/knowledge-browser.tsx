"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileText, Folder } from "lucide-react";
import { KNOWLEDGE, firstDoc, type KnowledgeNode } from "@/lib/content";
import { cn } from "@/lib/utils";

export function KnowledgeBrowser() {
  const initial = firstDoc();
  const [selected, setSelected] = useState(initial?.id ?? "");
  const current = useMemo(() => findDoc(KNOWLEDGE, selected) ?? initial, [selected, initial]);
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-border bg-card p-3">
        {KNOWLEDGE.map((node) => <FolderBlock key={node.id} node={node} selected={selected} onSelect={setSelected} depth={0} />)}
      </div>
      <article className="rounded-2xl border border-border bg-card p-5">
        {current?.kind === "doc" ? (
          <>
            <p className="text-xs text-pine">大纲</p>
            <h2 className="mt-1 text-2xl font-semibold">{current.title}</h2>
            <p className="mt-3 text-sm leading-7">{current.summary}</p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-7">{current.outline?.map((item) => <li key={item}>{item}</li>)}</ol>
            {current.links?.length ? <div className="mt-5 flex flex-wrap gap-3">{current.links.map((link) => <Link key={link.href} href={link.href} className="text-sm font-medium text-pine">{link.label}</Link>)}</div> : null}
          </>
        ) : <p className="text-sm text-muted-foreground">选一个文件夹里的条目。</p>}
      </article>
    </div>
  );
}

function FolderBlock({ node, selected, onSelect, depth }: { node: KnowledgeNode; selected: string; onSelect: (id: string) => void; depth: number }) {
  if (node.kind === "doc") {
    return (
      <button type="button" onClick={() => onSelect(node.id)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm", selected === node.id ? "bg-secondary font-medium" : "hover:bg-secondary/70")} style={{ paddingLeft: 8 + depth * 12 }}>
        <FileText className="size-3.5 text-muted-foreground" />
        {node.title}
      </button>
    );
  }
  return (
    <div className="mb-2">
      <p className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground" style={{ paddingLeft: 8 + depth * 12 }}><Folder className="size-3.5" />{node.title}</p>
      {node.children?.map((child) => <FolderBlock key={child.id} node={child} selected={selected} onSelect={onSelect} depth={depth + 1} />)}
    </div>
  );
}

function findDoc(nodes: KnowledgeNode[], id: string): KnowledgeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findDoc(node.children, id);
      if (found) return found;
    }
  }
  return null;
}
