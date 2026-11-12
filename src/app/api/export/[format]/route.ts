import { connection } from "next/server";
import { handleExport } from "@/lib/export/handle";
import { currentUser } from "@/lib/session";
import { generationOwnedBy } from "@/lib/store";

export async function GET(request: Request, context: { params: Promise<{ format: string }> }) {
  await connection();
  const { format } = await context.params;
  const user = await currentUser();
  const generationId = new URL(request.url).searchParams.get("id") ?? "";
  return handleExport({ user, format, generationId, find: generationOwnedBy });
}
