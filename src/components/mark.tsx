import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <span className={cn("grid size-8 grid-cols-3 grid-rows-2 gap-[3px]", className)} aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} className={cn("rounded-[3px]", index === 0 ? "bg-clay" : "bg-pine")} />
      ))}
    </span>
  );
}
