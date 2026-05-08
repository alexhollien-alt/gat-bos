import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env";

export type AuthLink = { email: string; userId: string; actionLink: string };

export async function getMagicLinkForFirstUser(redirectTo = "http://localhost:3000/dashboard"): Promise<AuthLink> {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: users, error: listErr } = await sb.auth.admin.listUsers({ perPage: 50 });
  if (listErr) throw listErr;

  const target =
    users.users.find((u) => u.email === "alexhollien@gmail.com") ??
    users.users.find((u) => !!u.email);
  if (!target?.email) throw new Error("no user with email found");

  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: target.email,
    options: { redirectTo },
  });
  if (error) throw error;
  const actionLink = data.properties?.action_link;
  if (!actionLink) throw new Error("no action_link returned");

  return { email: target.email, userId: target.id, actionLink };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  getMagicLinkForFirstUser().then(
    (r) => {
      console.log(JSON.stringify(r, null, 2));
    },
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
