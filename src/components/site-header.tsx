"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Mark } from "@/components/mark";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatStamp } from "@/lib/dates";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "方法" },
  { href: "/flow/primary", label: "小学" },
  { href: "/flow/junior", label: "初中" },
  { href: "/flow/senior", label: "高中" },
  { href: "/checkin", label: "打卡" },
  { href: "/knowledge", label: "知识库" },
  { href: "/tools", label: "工具目录" },
  { href: "/workbench", label: "工作台" },
];

function isCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/workbench") return pathname === "/workbench" || pathname.startsWith("/workbench/");
  return pathname === href;
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, user, ledger, refresh } = useSession();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await refresh();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="打开菜单" />}>
            <Menu />
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(100%,20rem)]">
            <SheetHeader>
              <SheetTitle>学习工作台</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    isCurrent(pathname, link.href) ? "bg-secondary font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
        <Link href="/" className="flex items-center gap-2">
          <Mark />
          <span className="leading-tight">
            <span className="block text-sm font-semibold">学习工作台</span>
            <span className="block text-[11px] text-muted-foreground">Study Workbench</span>
          </span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground",
                isCurrent(pathname, link.href) && "font-medium text-pine",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {ready && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" className="h-9" />}>
                {user.displayName} · {user.credits} 点
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>最近点数</DropdownMenuLabel>
                {ledger.length === 0 ? (
                  <p className="px-1.5 py-1 text-xs text-muted-foreground">还没有记录</p>
                ) : (
                  ledger.map((item) => (
                    <p key={item.id} className="px-1.5 py-1 text-xs leading-5 text-muted-foreground">
                      <span className="text-foreground">{item.note}</span>
                      <span className="float-right">{formatStamp(item.createdAt)}</span>
                      <span className="block">余额 {item.balanceAfter}</span>
                    </p>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/workbench")}>打开工作台</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void logout()}>退出</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground">
              登录
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
