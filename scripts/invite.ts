import { createInvitedUser } from "@/lib/db/accounts";
import { closePool } from "@/lib/db/pool";
import { migrate } from "@/lib/db/migrate";

const username = process.env.INVITE_USERNAME?.trim() ?? "";
const password = process.env.INVITE_PASSWORD ?? "";
const displayName = process.env.INVITE_DISPLAY_NAME?.trim() || username;
const credits = Number(process.env.INVITE_CREDITS ?? "20");
if (!username || !password) {
  console.error("Set INVITE_USERNAME and INVITE_PASSWORD in the environment. They are not read from the command line.");
  process.exit(1);
}
await migrate();
const result = await createInvitedUser(username, password, displayName, Number.isInteger(credits) && credits >= 0 ? credits : 20);
await closePool();
if ("error" in result) {
  console.error(result.error);
  process.exit(1);
}
console.log(`invited ${result.user.username} with ${result.user.credits} credits`);
