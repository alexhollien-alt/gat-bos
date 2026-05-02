// src/app/portal/[slug]/login/page.tsx
//
// Slice 7C Task 5c: agent portal login page.
//
// This page sits OUTSIDE the (authed) route group so it does not pass
// through requirePortalSession. The (authed)/layout.tsx redirects here
// when an agent visits a protected portal route without a session, so
// the login route must remain ungated.
//
// Server side: resolve the agent via the public anon RPC
// (get_public_agent_by_slug) so we can address them by name and target
// their email. notFound() if the slug does not resolve.
//
// Client side: <PortalLoginForm> calls supabase.auth.signInWithOtp with
// shouldCreateUser=false so a stranger cannot self-provision a portal
// account. Initial onboarding flows through /api/portal/invite (Task 5a)
// which seeds the auth.users row by way of the agent_invites RPC
// (Task 5d). This page handles re-issue for an already-onboarded agent
// who lost or expired their session.
//
// emailRedirectTo points at /portal/<slug>/dashboard so Supabase's hosted
// callback drops the agent back into their portal once the link is
// clicked.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchPortalAgentBySlug } from "@/lib/auth/requirePortalSession";
import { PortalLoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in - Partner Portal",
};

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? ""}***@${domain}`;
  return `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local.slice(-1)}@${domain}`;
}

export default async function PortalLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await fetchPortalAgentBySlug(slug);

  if (!agent) {
    notFound();
  }

  if (!agent.email) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-10">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-100">
          Portal unavailable
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          This portal is not configured for sign-in. Please contact Alex
          Hollien at Great American Title Agency to finish setup.
        </p>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Error · contact missing email
        </p>
      </div>
    );
  }

  const firstName = agent.first_name?.trim() || "there";

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Partner sign-in
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-zinc-100">
          Welcome back, {firstName}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          We will email a one-time sign-in link to{" "}
          <span className="text-zinc-200">{maskEmail(agent.email)}</span>. The
          link expires after a single use.
        </p>

        <PortalLoginForm
          slug={agent.slug}
          email={agent.email}
          firstName={firstName}
        />

        <p className="mt-8 border-t border-zinc-800 pt-6 text-xs leading-relaxed text-zinc-500">
          Not your email? Contact Alex Hollien at Great American Title Agency
          to update your portal access.
        </p>
      </div>
    </div>
  );
}
