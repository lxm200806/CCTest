import { notFound } from "next/navigation";
import { ToolWorkspace } from "@/components/tool-workspace";
import { TOOLS, getTool } from "@/lib/tools";

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ toolId: tool.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  return { title: getTool(toolId)?.name ?? "工具" };
}

export default async function ToolPage({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  if (!getTool(toolId)) notFound();
  return <ToolWorkspace key={toolId} toolId={toolId} />;
}
