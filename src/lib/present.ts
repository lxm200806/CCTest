import type { GenerationRecord, LedgerItem, PublicGeneration } from "@/lib/types";

export function presentGeneration(record: GenerationRecord): PublicGeneration {
  return {
    id: record.id,
    toolId: record.toolId,
    toolName: record.toolName,
    source: record.source,
    createdAt: record.createdAt,
    input: record.input,
    result: record.result,
  };
}

export function presentLedger(item: LedgerItem & { userId: string }): LedgerItem {
  return {
    id: item.id,
    delta: item.delta,
    balanceAfter: item.balanceAfter,
    note: item.note,
    toolId: item.toolId,
    createdAt: item.createdAt,
  };
}
