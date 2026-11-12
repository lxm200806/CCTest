import Link from "next/link";
import { ProfileCard } from "@/components/profile-card";
import { buttonVariants } from "@/components/ui/button";
import { BANDS, STEPS } from "@/lib/content";
import { TOOLS } from "@/lib/tools";
import { cn } from "@/lib/utils";

const featured = TOOLS.filter((tool) => tool.featured);

export default function HomePage() {
  return (
    <div>
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-12 md:py-16">
          <div className="md:col-span-7">
            <p className="text-sm text-pine">家庭学习方法台</p>
            <h1 className="mt-3 max-w-xl text-4xl leading-tight font-semibold md:text-5xl">把一天的学习收成六步</h1>
            <p className="mt-4 max-w-xl text-base leading-8 text-muted-foreground">
              先看清今天谁来操作、做到哪一步算完成，再进工作台调用工具。小学由家长带着走，初中学生自己填、家长只验收，高中按一周而不是按一个晚上排。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/workbench" className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}>进入工作台</Link>
              <Link href="/flow/junior" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}>看初中一日</Link>
            </div>
          </div>
          <div className="md:col-span-5"><ProfileCard /></div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-semibold">每日六步</h2>
        <ol className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-clay">0{step.id}</p>
              <h3 className="mt-1 text-lg font-semibold">{step.name}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.brief}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-4">
        <h2 className="text-2xl font-semibold">三个学段，角色不同</h2>
        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {(["primary", "junior", "senior"] as const).map((id) => {
            const band = BANDS[id];
            return (
              <Link key={id} href={`/flow/${id}`} className="rounded-2xl border border-border bg-card p-5 hover:border-pine/40">
                <p className="text-xs text-pine">{band.role}</p>
                <h3 className="mt-2 text-xl font-semibold">{band.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{band.summary}</p>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold">常用工具</h2>
          <Link href="/tools" className="text-sm text-pine">全部 15 个</Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {featured.map((tool) => (
            <Link key={tool.id} href={`/workbench/${tool.id}`} className="rounded-2xl border border-border bg-card p-4 hover:border-pine/40">
              <p className="text-xs text-muted-foreground">{tool.cost} 点</p>
              <h3 className="mt-2 font-semibold">{tool.name}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{tool.blurb}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
