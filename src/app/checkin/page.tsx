import { CheckinBoard } from "@/components/checkin-board";
import { STEPS } from "@/lib/content";

export const metadata = { title: "打卡" };

export default function CheckinPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-pine">本周六步</p>
      <h1 className="mt-2 text-4xl font-semibold">打卡板</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">勾的是步骤，不是分数。一天勾满四步，记为达标。演示档案是林晓禾，未登录时可以看，不能改。</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {STEPS.map((step) => <li key={step.id} className="rounded-full bg-secondary px-3 py-1 text-xs">{step.id}. {step.name}</li>)}
      </ul>
      <CheckinBoard />
    </div>
  );
}
