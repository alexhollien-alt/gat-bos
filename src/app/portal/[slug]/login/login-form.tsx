"use client";

// src/app/portal/[slug]/login/login-form.tsx
//
// Client island for the portal login page. The server component already
// resolved the agent and proved that the slug exists; this form just
// dispatches the magic link via supabase.auth.signInWithOtp.
//
// shouldCreateUser=false is the gate that prevents portal self-signup.
// An agent must already exist in auth.users (seeded by the invite
// redemption RPC, Task 5d) before this page can sign them back in. If
// Supabase replies that the user is missing, we surface a generic message
// rather than leaking which emails are registered.

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

export function PortalLoginForm({
  slug,
  email,
  firstName,
}: {
  slug: string;
  email: string;
  firstName: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    startTransition(async () => {
      setStatus("sending");
      setErrorMessage(null);

      const supabase = createClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const redirectTo = `${origin}/portal/${slug}/dashboard`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setStatus("error");
        setErrorMessage(
          "We could not send a sign-in link. Contact Alex Hollien at Great American Title Agency for help.",
        );
        return;
      }

      setStatus("sent");
    });
  }

  if (status === "sent") {
    return (
      <div className="mt-6 rounded-md border border-zinc-700 bg-zinc-950 px-4 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Check your inbox
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          We sent a sign-in link to your email. Click it from this device to
          land on your portal dashboard.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          If you do not see it within a minute, check your spam folder or send
          the link again.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
        >
          Send another link
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <button
        type="button"
        onClick={handleSend}
        disabled={isPending || status === "sending"}
        className="w-full rounded-md bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
      >
        {status === "sending"
          ? "Sending sign-in link..."
          : `Send sign-in link to ${firstName}`}
      </button>

      {status === "error" && errorMessage ? (
        <p className="rounded-md border border-red-900 bg-red-950 px-4 py-3 text-xs leading-relaxed text-red-200">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
