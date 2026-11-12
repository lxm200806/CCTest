"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">这一页没有加载出来</h1>
      <p className="mt-3 text-sm text-muted-foreground">可以再试一次。已经生成的结果仍在本机。</p>
      <button type="button" onClick={reset} className="mt-6 text-sm font-medium text-pine">再试一次</button>
    </div>
  );
}
