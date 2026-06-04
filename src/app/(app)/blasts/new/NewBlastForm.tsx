"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createBlast } from "../actions";

export interface AgentOption {
  id: string;
  name: string;
  brokerage: string | null;
}

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function NewBlastForm({ agents }: { agents: AgentOption[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    agentContactId: "",
    address: "",
    city: "",
    state: "AZ",
    price: "",
    openHouseDate: "",
    openHouseStart: "13:00",
    openHouseEnd: "16:00",
    details: "",
    beds: "",
    baths: "",
    sqft: "",
    photo1Url: "",
    photo2Url: "",
    emailSubject: "",
  });
  const [count, setCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Live recipient count, debounced on city.
  useEffect(() => {
    const city = form.city.trim();
    if (!city) {
      setCount(null);
      return;
    }
    setCountLoading(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(
          `/api/open-house/recipient-count?city=${encodeURIComponent(city)}`,
          { signal: ctrl.signal },
        );
        const data = await res.json();
        setCount(typeof data.count === "number" ? data.count : 0);
      } catch {
        /* aborted or failed; leave prior count */
      } finally {
        setCountLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.city]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await createBlast({
      ...form,
      beds: form.beds || undefined,
      baths: form.baths || undefined,
      sqft: form.sqft || undefined,
    });
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    router.push(`/blasts/${result.id}/preview`);
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <div className="space-y-2">
        <Label htmlFor="agent">Hosting agent</Label>
        <select
          id="agent"
          className={selectClass}
          value={form.agentContactId}
          onChange={set("agentContactId")}
          required
        >
          <option value="">Select the agent hosting this open house</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.brokerage ? ` -- ${a.brokerage}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Listing address</Label>
        <Input id="address" value={form.address} onChange={set("address")} placeholder="7012 E Berneil Lane" required />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="city">Listing city</Label>
          <Input id="city" value={form.city} onChange={set("city")} placeholder="Scottsdale" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" value={form.state} onChange={set("state")} />
        </div>
      </div>

      {/* Live recipient count for the matched city */}
      <div className="rounded-md border border-input bg-muted/40 px-4 py-3 text-sm">
        {!form.city.trim() ? (
          <span className="text-muted-foreground">Enter a city to see how many agents match.</span>
        ) : countLoading ? (
          <span className="text-muted-foreground">Counting agents in {form.city.trim()}...</span>
        ) : (
          <span>
            <span className="font-semibold text-foreground">{count ?? 0}</span> agent
            {count === 1 ? "" : "s"} tagged in {form.city.trim()} will receive this blast.
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={form.openHouseDate} onChange={set("openHouseDate")} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="start">Start</Label>
          <Input id="start" type="time" value={form.openHouseStart} onChange={set("openHouseStart")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end">End</Label>
          <Input id="end" type="time" value={form.openHouseEnd} onChange={set("openHouseEnd")} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-2">
          <Label htmlFor="price">Price</Label>
          <Input id="price" value={form.price} onChange={set("price")} placeholder="$1,295,000" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="beds">Beds</Label>
          <Input id="beds" value={form.beds} onChange={set("beds")} inputMode="decimal" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="baths">Baths</Label>
          <Input id="baths" value={form.baths} onChange={set("baths")} inputMode="decimal" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sqft">Sq ft</Label>
          <Input id="sqft" value={form.sqft} onChange={set("sqft")} inputMode="numeric" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="photo1">Photo URL 1</Label>
          <Input id="photo1" value={form.photo1Url} onChange={set("photo1Url")} placeholder="https://..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="photo2">Photo URL 2 (optional)</Label>
          <Input id="photo2" value={form.photo2Url} onChange={set("photo2Url")} placeholder="https://..." />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="details">Highlights</Label>
        <Textarea
          id="details"
          value={form.details}
          onChange={set("details")}
          rows={3}
          placeholder="One or two lines about the home. Broker lunch, easy to show, etc."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Email subject (optional)</Label>
        <Input id="subject" value={form.emailSubject} onChange={set("emailSubject")} placeholder="Leave blank for an auto subject" />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Building preview..." : "Build preview"}
      </Button>
    </form>
  );
}
