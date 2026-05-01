// src/lib/auth/requirePortalSession.ts
//
// Portal-side companion to tenantFromRequest. The /portal/* surface is
// authenticated but the user is NOT an account owner -- they are an agent
// contact who redeemed a magic-link invite (Slice 7C Tasks 1+2). They have
// a real Supabase Auth session, but they cannot read account-scoped tables
// directly under the 7B RLS regime.
//
// requirePortalSession resolves the agent contact via the public anon RPC
// (get_public_agent_by_slug), then verifies that the authenticated session's
// email matches that contact. The slug is the binding key: a session for
// julie@... cannot access /portal/joey-gutierrez/*.
//
// Failure modes:
//   - no_session     -> redirect to /portal/<slug>/login (handled inline)
//   - agent_not_found-> caller should notFound()
//   - email_mismatch -> caller should render 403

import { redirect } from "next/navigation";
import { createClient as createSupabaseAnonClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

export type PortalAgent = {
  id: string;
  slug: string;
  first_name: string;
  last_name: string;
  title: string | null;
  brokerage: string | null;
  headshot_url: string | null;
  tagline: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
};

export type PortalSession = {
  userId: string;
  email: string;
  agent: PortalAgent;
};

export type PortalSessionErrorCode =
  | "no_session"
  | "agent_not_found"
  | "email_mismatch";

export class PortalSessionError extends Error {
  code: PortalSessionErrorCode;
  constructor(code: PortalSessionErrorCode, message: string) {
    super(message);
    this.name = "PortalSessionError";
    this.code = code;
  }
}

function publicAnonSupabase() {
  return createSupabaseAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function fetchPortalAgentBySlug(
  slug: string,
): Promise<PortalAgent | null> {
  const supabase = publicAnonSupabase();
  const { data, error } = await supabase.rpc("get_public_agent_by_slug", {
    p_slug: slug,
  });
  if (error || !data) return null;
  const rows = data as PortalAgent[];
  return rows.length > 0 ? rows[0] : null;
}

export async function requirePortalSession(
  slug: string,
): Promise<PortalSession> {
  const agent = await fetchPortalAgentBySlug(slug);
  if (!agent) {
    throw new PortalSessionError(
      "agent_not_found",
      `no agent for slug ${slug}`,
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/portal/${slug}/login`);
  }

  const sessionEmail = user.email?.toLowerCase().trim() ?? "";
  const agentEmail = agent.email?.toLowerCase().trim() ?? "";

  if (!sessionEmail || !agentEmail || sessionEmail !== agentEmail) {
    throw new PortalSessionError(
      "email_mismatch",
      "session email does not match agent slug",
    );
  }

  return {
    userId: user.id,
    email: user.email!,
    agent,
  };
}
