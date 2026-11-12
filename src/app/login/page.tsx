import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "登录" };

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="px-4 py-24 text-center text-sm text-muted-foreground">正在打开登录…</p>}>
      <LoginForm />
    </Suspense>
  );
}
