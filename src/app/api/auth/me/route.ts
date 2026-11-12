import { currentUser } from "@/lib/session";
import { recentLedger, studentFor } from "@/lib/store";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ user: null, student: null, ledger: [] });
  return Response.json({ user, student: studentFor(user.id), ledger: recentLedger(user.id) });
}
