import Link from "next/link";
import { notFound } from "next/navigation";
import { getBand } from "@/lib/content";

export function generateStaticParams() {
  return [{ band: "primary" }, { band: "junior" }, { band: "senior" }];
}

export async function generateMetadata({ params }: { params: Promise<{ band: string }> }) {
  const { band } = await params;
  const page = getBand(band);
  return { title: page ? page.title : "学段" };
}

export default async function FlowPage({ params }: { params: Promise<{ band: string }> }) {
  const { band } = await params;
  const page = getBand(band);
  if (!page) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted-foreground"><Link href="/" className="hover:text-foreground">方法</Link><span> / {page.title}</span></p>
      <p className="mt-4 text-sm text-pine">{page.role}</p>
      <h1 className="mt-2 text-4xl font-semibold">{page.title}</h1>
      <p className="mt-4 max-w-3xl text-base leading-8">{page.summary}</p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 text-sm leading-6"><p className="font-medium">节奏</p><p className="mt-1 text-muted-foreground">{page.rhythm}</p></div>
        <div className="rounded-2xl border border-clay/30 bg-accent p-4 text-sm leading-6 text-clay"><p className="font-medium">这一段先别做</p><p className="mt-1">{page.caution}</p></div>
      </div>
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">{page.sampleTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{page.sampleNote}</p>
        <ol className="mt-4 space-y-2">
          {page.sample.map((item) => (
            <li key={item.time} className="grid gap-1 rounded-xl border border-border bg-card px-4 py-3 text-sm sm:grid-cols-[6rem_1fr]">
              <span className="font-medium text-pine">{item.time}</span>
              <span className="leading-6">{item.text}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">六步怎么走</h2>
        {page.steps.map((step) => (
          <article key={step.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold">{step.id}. {step.name}</h3>
              <span className="text-sm text-muted-foreground">{step.minutes}</span>
            </div>
            <p className="mt-2 text-sm text-pine">{step.who}</p>
            <p className="mt-2 text-sm leading-7">{step.do}</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">完成：{step.done}</p>
            {step.href && step.hrefLabel ? <Link href={step.href} className="mt-3 inline-block text-sm font-medium text-pine">{step.hrefLabel}</Link> : null}
          </article>
        ))}
      </section>
    </div>
  );
}
