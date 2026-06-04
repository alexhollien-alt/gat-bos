"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setAutoSend } from "../../actions";

interface SendSummary {
  ok: boolean;
  sent: number;
  failed: number;
  skipped: number;
  held: number;
  total: number;
  error?: string;
}

export function ApprovePanel({
  blastId,
  recipientCount,
  canSend,
  city,
  initialAutoSend,
}: {
  blastId: string;
  recipientCount: number;
  canSend: boolean;
  city: string;
  initialAutoSend: boolean;
}) {
  const router = useRouter();
  const [autoSend, setAuto] = useState(initialAutoSend);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approveAndSend() {
    if (!canSend || sending) return;
    const ok = window.confirm(
      `Send this open house blast to ${recipientCount} agent${recipientCount === 1 ? "" : "s"} in ${city}? This sends real email and cannot be undone.`,
    );
    if (!ok) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/open-house/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blastId }),
      });
      const data = (await res.json()) as SendSummary;
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Send failed");
      } else {
        setResult(data);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function onToggleAuto(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.checked;
    setAuto(v);
    await setAutoSend(blastId, v);
  }

  if (result) {
    return (
      <div className="rounded-lg border border-input bg-muted/40 p-5">
        <div className="text-sm font-semibold text-foreground">Sent.</div>
        <ul className="mt-2 text-sm text-muted-foreground">
          <li>Delivered to provider: {result.sent}</li>
          {result.failed > 0 ? <li className="text-destructive">Failed: {result.failed}</li> : null}
          {result.skipped > 0 ? <li>Already sent (skipped): {result.skipped}</li> : null}
          {result.held > 0 ? <li>Held by warmup cap (queued): {result.held}</li> : null}
        </ul>
        <a href={`/blasts/${blastId}`} className="mt-3 inline-block text-sm underline">
          View blast dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-input bg-muted/40 p-5 space-y-4">
      <div className="text-sm">
        This sends to{" "}
        <span className="font-semibold text-foreground">
          {recipientCount} agent{recipientCount === 1 ? "" : "s"}
        </span>{" "}
        tagged in <span className="font-semibold">{city}</span>, from the dedicated open house
        subdomain. Opt-outs and suppressed contacts are already excluded.
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={autoSend} onChange={onToggleAuto} />
        Auto-send future blasts like this without a manual approval (off by default)
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button onClick={approveAndSend} disabled={!canSend || sending} className="w-full">
        {sending
          ? "Sending..."
          : canSend
            ? `Approve and send to ${recipientCount} agent${recipientCount === 1 ? "" : "s"}`
            : "Blocked by preflight (see report below)"}
      </Button>
      {!canSend ? (
        <p className="text-xs text-muted-foreground">
          The send is blocked until the preflight checklist passes.
        </p>
      ) : null}
    </div>
  );
}
