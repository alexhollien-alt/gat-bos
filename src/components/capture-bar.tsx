"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseCapture, type ContactIndexEntry } from "@/lib/captures/rules";
import { PARSED_INTENT_LABELS, type ParsedIntent } from "@/lib/types";

const PLACEHOLDERS = [
  "Met with Julie at Optima Camelview...",
  "Need a flyer for Denise's Paradise Valley listing...",
  "Follow up with Fiona Friday about 85258...",
  "Capture a thought, ticket, or signal...",
];

const PLACEHOLDER_INTERVAL_MS = 3000;
const PARSE_DEBOUNCE_MS = 300;
const PULSE_DURATION_MS = 400;

interface CaptureBarProps {
  contactsIndex: ContactIndexEntry[];
}

// Draft 2: rotating placeholder, debounced live preview, focus expansion,
// GAT Red pulse on submit, top-right toast.
// Draft 3 will add mobile keyboard lift, Esc-to-blur, and word-boundary edge cases.
export function CaptureBar({ contactsIndex }: CaptureBarProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rotating placeholder: only rotates while the input is empty and unfocused.
  useEffect(() => {
    if (focused || value.length > 0) return;
    const id = window.setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length);
    }, PLACEHOLDER_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [focused, value.length]);

  const contactById = useMemo(() => {
    const m = new Map<string, ContactIndexEntry>();
    for (const c of contactsIndex) m.set(c.id, c);
    return m;
  }, [contactsIndex]);

  // Debounced live preview. Runs the same parser the API route uses, so the
  // line above the input mirrors what will be persisted on submit.
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setPreview(null);
      return;
    }
    const id = window.setTimeout(() => {
      const result = parseCapture({ rawText: trimmed, contactsIndex });
      setPreview(formatPreview(result.intent, result.contactId, contactById));
    }, PARSE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [value, contactsIndex, contactById]);

  async function submit() {
    const raw = value.trim();
    if (!raw || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/captures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: raw }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        toast.error("Capture failed", {
          description: err.error ?? "Unknown error",
          position: "top-right",
        });
        return;
      }

      setValue("");
      setPreview(null);
      setPulsing(true);
      window.setTimeout(() => setPulsing(false), PULSE_DURATION_MS);
      toast.success("Captured", {
        description: "Saved to your capture log",
        position: "top-right",
        action: {
          label: "view",
          onClick: () => router.push("/captures"),
        },
      });
      router.refresh();
    } catch (e) {
      toast.error("Capture failed", {
        description: e instanceof Error ? e.message : "Network error",
        position: "top-right",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      inputRef.current?.blur();
    }
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 pointer-events-none",
        // Sidebar is hidden below md:. On mobile, bar spans full width.
        "md:pl-56"
      )}
      style={{
        // Respect iOS safe area so the bar doesn't sit under the home indicator.
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        className={cn(
          "mx-auto max-w-3xl px-4 pb-4 pt-2 pointer-events-auto",
          // Subtle lift when the on-screen keyboard is open so the bar stays visible above it.
          "transition-transform duration-200",
          focused && "md:translate-y-0 -translate-y-1"
        )}
      >
        <div
          className={cn(
            "h-5 px-3 mb-1 font-mono text-[11px] leading-5 text-muted-foreground",
            "transition-opacity duration-150",
            preview ? "opacity-100" : "opacity-0"
          )}
          aria-live="polite"
        >
          {preview ?? " "}
        </div>
        <form
          onSubmit={handleSubmit}
          className={cn(
            "showcase-card flex items-center gap-3 px-3 transition-all duration-150",
            "bg-[hsl(var(--card)/0.72)]",
            focused ? "py-2.5 shadow-2xl" : "py-2",
            pulsing && "ring-2 ring-[var(--brand-red)]"
          )}
        >
          <Sparkles
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={PLACEHOLDERS[placeholderIdx]}
            disabled={submitting}
            className={cn(
              "flex-1 bg-transparent border-0 outline-none",
              "font-sans text-sm text-foreground placeholder:text-muted-foreground",
              "disabled:opacity-60"
            )}
            aria-label="Universal capture"
          />
          <button
            type="submit"
            disabled={submitting || value.trim().length === 0}
            className={cn(
              "h-8 w-8 shrink-0 rounded-md flex items-center justify-center",
              "border border-border/60 bg-transparent text-foreground",
              "transition-colors",
              "hover:bg-[var(--brand-red)] hover:text-white hover:border-transparent",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-foreground"
            )}
            aria-label="Submit capture"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

// Preview-line copy rules per plan Draft 2:
//   match + intent      ->  "-> {Intent} for {first} {last}"
//   match only (note)   ->  "-> Note for {first} {last}"
//   intent only         ->  "-> {Intent}"
//   neither             ->  null (line stays hidden)
function formatPreview(
  intent: ParsedIntent,
  contactId: string | null,
  contactById: Map<string, ContactIndexEntry>
): string | null {
  const contact = contactId ? contactById.get(contactId) ?? null : null;
  const name = contact
    ? `${contact.first_name} ${contact.last_name}`.trim()
    : null;

  if (intent === "unprocessed" && !name) return null;
  if (intent === "note" && !name) return null;

  const intentLabel = PARSED_INTENT_LABELS[intent];

  if (name && intent !== "unprocessed") {
    return `-> ${intentLabel} for ${name}`;
  }
  if (!name && intent !== "unprocessed" && intent !== "note") {
    return `-> ${intentLabel}`;
  }
  return null;
}
