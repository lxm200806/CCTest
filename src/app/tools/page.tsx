import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { GROUPS, TOOLS } from "@/lib/tools";

export const metadata = { title: "工具目录" };

export default function ToolsPage() {
  const folded = TOOLS.flatMap((tool) => tool.mapsFrom.map((from) => ({ from, to: tool.name, href: `/workbench/${tool.id}` })));
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-pine">15 个入口</p>
      <h1 className="mt-2 text-4xl font-semibold">工具目录</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">工作台只放这 15 个。诊断、查缺、行动计划和得分点不再各开一个应用，都收进试卷分析或提分评测。</p>
      <div className="mt-8 space-y-8">
        {GROUPS.map((group) => (
          <section key={group.id}>
            <h2 className="text-xl font-semibold">{group.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{group.hint}</p>
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {TOOLS.filter((tool) => tool.group === group.id).map((tool) => (
                <li key={tool.id} id={tool.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/workbench/${tool.id}`} className="font-medium hover:text-pine">{tool.name}</Link>
                      {tool.featured ? <Badge className="bg-clay text-white">常用</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{tool.blurb}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{tool.cost} 点 / 次</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <section className="mt-12">
        <h2 className="text-xl font-semibold">能力如何收进来</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-secondary"><tr><th className="px-4 py-2 text-left font-medium">原来的能力</th><th className="px-4 py-2 text-left font-medium">收进</th></tr></thead>
            <tbody>
              {folded.map((row) => (
                <tr key={`${row.from}-${row.to}`} className="border-t border-border">
                  <td className="px-4 py-2">{row.from}</td>
                  <td className="px-4 py-2"><Link href={row.href} className="text-pine">{row.to}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
