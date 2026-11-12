import { currentUser } from "@/lib/session";
import { recentLedger, studentFor } from "@/lib/store";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ user: null, student: null, ledger: [] });
  const [student, ledger] = await Promise.all([studentFor(user.id), recentLedger(user.id)]);
  return Response.json({ user, student, ledger });
}
