import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">这一页不在工作台里</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">回到方法首页，或从工具目录重新选。</p>
      <div className="mt-6 flex justify-center gap-4 text-sm">
        <Link href="/" className="text-pine">方法首页</Link>
        <Link href="/tools" className="text-pine">工具目录</Link>
      </div>
    </div>
  );
}
