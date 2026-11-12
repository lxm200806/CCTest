import { presentGeneration } from "@/lib/present";
import { currentUser } from "@/lib/session";
import { latestGeneration } from "@/lib/store";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ item: null }, { status: 401 });
  const toolId = new URL(request.url).searchParams.get("toolId") ?? "";
  const item = await latestGeneration(user.id, toolId);
  return Response.json({ item: item ? presentGeneration(item) : null });
}
