/* eslint-disable no-restricted-syntax -- public RSVP page uses a one-off
   organic-luxe marketing palette (bone/desert/terracotta) intentionally
   divergent from the CRM design system. Color values are scoped to this
   route only and never feed into shared components. */
"use client";

import { useState, useId, type FormEvent } from "react";

interface Props {
  slug: string;
  eventTitle: string;
  hostFirstName: string;
}

type Status = "idle" | "submitting" | "success" | "error";

const bone = "#F5F0E8";
const ink = "#1F1B16";
const accent = "#9B6B4A";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "rgba(31,27,22,0.7)",
  fontWeight: 600,
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "rgba(255,255,255,0.55)",
  border: "1px solid rgba(31,27,22,0.18)",
  borderRadius: 0,
  fontSize: 15,
  fontFamily: "Helvetica, Arial, sans-serif",
  color: ink,
  boxSizing: "border-box",
  outline: "none",
  WebkitAppearance: "none",
};

const fieldGroup: React.CSSProperties = {
  marginBottom: 24,
};

export function RSVPForm({ slug, eventTitle, hostFirstName }: Props) {
  const formId = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string>("");
  const [guestCount, setGuestCount] = useState<1 | 2>(1);
  const [honeypot, setHoneypot] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMessage(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      slug,
      name: String(data.get("name") ?? "").trim(),
      brokerage: String(data.get("brokerage") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim() || undefined,
      guestCount,
      notes: String(data.get("notes") ?? "").trim() || undefined,
      honeypot: honeypot || undefined,
    };

    try {
      const res = await fetch("/api/rsvp/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        const msg =
          body.error === "rate_limited"
            ? "Too many submissions from this network. Please try again in a few minutes."
            : body.error === "event_closed"
              ? "RSVP for this event has closed."
              : "Something went wrong. Please email directly or try again.";
        setErrorMessage(msg);
        setStatus("error");
        return;
      }
      setSubmittedEmail(payload.email);
      setStatus("success");
    } catch {
      setErrorMessage(
        "Network error. Please email directly or try again in a moment.",
      );
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          padding: "40px 32px",
          background: "rgba(155,107,74,0.08)",
          border: `1px solid ${accent}`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: "italic",
            fontSize: 28,
            color: ink,
            marginBottom: 12,
          }}
        >
          You&apos;re on the list.
        </div>
        <p
          style={{
            margin: "0 0 16px 0",
            fontSize: 15,
            lineHeight: 1.7,
            color: "rgba(31,27,22,0.85)",
          }}
        >
          A confirmation is on its way to{" "}
          <strong style={{ color: ink }}>{submittedEmail}</strong>. {hostFirstName}{" "}
          looks forward to seeing you.
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "rgba(31,27,22,0.6)",
          }}
        >
          If your plans change, reply to the confirmation email so we can
          update the list.
        </p>
      </div>
    );
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      noValidate
      aria-label={`RSVP to ${eventTitle}`}
      style={{
        background: bone,
      }}
    >
      <div style={fieldGroup}>
        <label htmlFor={`${formId}-name`} style={labelStyle}>
          Name <span style={{ color: accent }}>*</span>
        </label>
        <input
          id={`${formId}-name`}
          name="name"
          type="text"
          required
          autoComplete="name"
          maxLength={120}
          style={inputStyle}
        />
      </div>

      <div style={fieldGroup}>
        <label htmlFor={`${formId}-brokerage`} style={labelStyle}>
          Brokerage <span style={{ color: accent }}>*</span>
        </label>
        <input
          id={`${formId}-brokerage`}
          name="brokerage"
          type="text"
          required
          autoComplete="organization"
          maxLength={120}
          style={inputStyle}
        />
      </div>

      <div style={fieldGroup}>
        <label htmlFor={`${formId}-email`} style={labelStyle}>
          Email <span style={{ color: accent }}>*</span>
        </label>
        <input
          id={`${formId}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={200}
          style={inputStyle}
        />
      </div>

      <div style={fieldGroup}>
        <label htmlFor={`${formId}-phone`} style={labelStyle}>
          Phone <span style={{ color: "rgba(31,27,22,0.4)", fontWeight: 400 }}>optional</span>
        </label>
        <input
          id={`${formId}-phone`}
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={40}
          style={inputStyle}
        />
      </div>

      <div style={fieldGroup}>
        <div style={labelStyle}>Bringing a guest?</div>
        <div
          role="radiogroup"
          aria-label="Guest count"
          style={{
            display: "flex",
            gap: 0,
            border: "1px solid rgba(31,27,22,0.18)",
          }}
        >
          {([1, 2] as const).map((n) => {
            const active = guestCount === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setGuestCount(n)}
                style={{
                  flex: 1,
                  padding: "14px 16px",
                  background: active ? ink : "transparent",
                  color: active ? bone : ink,
                  border: "none",
                  borderRadius: 0,
                  cursor: "pointer",
                  fontFamily: "Helvetica, Arial, sans-serif",
                  fontSize: 13,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  transition: "background 120ms ease, color 120ms ease",
                }}
              >
                {n === 1 ? "Just me" : "Plus one"}
              </button>
            );
          })}
        </div>
      </div>

      <div style={fieldGroup}>
        <label htmlFor={`${formId}-notes`} style={labelStyle}>
          Anything we should know?{" "}
          <span style={{ color: "rgba(31,27,22,0.4)", fontWeight: 400 }}>optional</span>
        </label>
        <textarea
          id={`${formId}-notes`}
          name="notes"
          rows={3}
          maxLength={2000}
          style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
        />
      </div>

      {/* Honeypot field, hidden from humans. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "-9999px",
          height: 0,
          width: 0,
          overflow: "hidden",
        }}
      >
        <label htmlFor={`${formId}-website`}>
          Website (leave empty)
          <input
            id={`${formId}-website`}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      {status === "error" && errorMessage ? (
        <div
          role="alert"
          style={{
            padding: "12px 14px",
            marginBottom: 16,
            background: "rgba(155,107,74,0.12)",
            border: `1px solid ${accent}`,
            color: ink,
            fontSize: 14,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={status === "submitting"}
        style={{
          width: "100%",
          padding: "16px 24px",
          background: ink,
          color: bone,
          border: "none",
          borderRadius: 0,
          fontFamily: "Helvetica, Arial, sans-serif",
          fontSize: 13,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          fontWeight: 600,
          cursor: status === "submitting" ? "wait" : "pointer",
          opacity: status === "submitting" ? 0.7 : 1,
          transition: "opacity 120ms ease",
          marginTop: 8,
        }}
      >
        {status === "submitting"
          ? "Reserving..."
          : `RSVP to ${eventTitle}`.toUpperCase()}
      </button>
    </form>
  );
}
