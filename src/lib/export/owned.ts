import type { GenerationRecord } from "@/lib/types";

export function ownedGeneration(records: GenerationRecord[], userId: string, generationId: string) {
  const owner = userId.trim();
  const id = generationId.trim();
  if (!owner || !id) return null;
  return records.find((item) => item.userId === owner && item.id === id) ?? null;
}
