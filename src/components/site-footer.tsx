import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>学习工作台 · 本地演示。数据写在这台电脑的 data/store.json。</p>
        <div className="flex gap-4">
          <Link href="/tools" className="hover:text-foreground">工具目录</Link>
          <Link href="/knowledge" className="hover:text-foreground">知识库</Link>
          <Link href="/checkin" className="hover:text-foreground">打卡</Link>
        </div>
      </div>
    </footer>
  );
}
