"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { MaterialRequest, MaterialRequestStatus } from "@/lib/types";
import { REQUEST_STATUS_CONFIG, PRODUCT_TYPE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  User,
  Mail,
  Phone,
  Building,
  Zap,
  Inbox,
  Save,
  ExternalLink,
} from "lucide-react";

// ---------------------
// Page
// ---------------------

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<MaterialRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTicket = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("material_requests")
      .select("*, contacts(id, first_name, last_name, company, email, phone), material_request_items(*)")
      .eq("id", ticketId)
      .single();

    if (!error && data) {
      const t = { ...data, items: data.material_request_items } as MaterialRequest;
      setTicket(t);
      setNotes(t.notes || "");
    }
    setLoading(false);
  }, [ticketId, supabase]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleStatusChange = async (newStatus: MaterialRequestStatus) => {
    if (!ticket) return;
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === "submitted") updates.submitted_at = new Date().toISOString();
    if (newStatus === "complete") updates.completed_at = new Date().toISOString();

    await supabase.from("material_requests").update(updates).eq("id", ticket.id);
    setTicket({ ...ticket, status: newStatus });
  };

  const handleSaveNotes = async () => {
    if (!ticket) return;
    setSaving(true);
    await supabase
      .from("material_requests")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", ticket.id);
    setTicket({ ...ticket, notes });
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-muted-foreground">Ticket not found.</p>
        <Link href="/tickets" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
          Back to tickets
        </Link>
      </div>
    );
  }

  const config = REQUEST_STATUS_CONFIG[ticket.status];
  const listing = ticket.listing_data;
  const isIntake = ticket.source === "intake";
  const agentName = ticket.submitter_name
    || (ticket.contacts ? `${ticket.contacts.first_name} ${ticket.contacts.last_name}` : null);

  return (
    <div>
      {/* Back nav */}
      <button
        onClick={() => router.push("/tickets")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-semibold text-foreground font-display">{ticket.title}</h1>
            {isIntake && (
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                Intake
              </span>
            )}
            {ticket.priority === "rush" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                <Zap className="h-2.5 w-2.5" />
                Rush
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Created {new Date(ticket.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            {ticket.submitted_at && ` \u00B7 Submitted ${new Date(ticket.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
          </p>
        </div>

        <Select value={ticket.status} onValueChange={handleStatusChange}>
          <SelectTrigger className={cn("h-9 text-sm w-auto min-w-[140px] border-0 font-medium", config.bgColor, config.textColor)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="in_production">In Production</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items requested */}
          <section className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Items Requested</h2>
            {ticket.items && ticket.items.length > 0 ? (
              <div className="space-y-2">
                {ticket.items.map((item) => {
                  const pConfig = PRODUCT_TYPE_CONFIG[item.product_type];
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-muted rounded-md px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">
                          {pConfig?.label || item.product_type}
                        </span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground">{item.description}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                        {item.design_url && (
                          <a
                            href={item.design_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            Design <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No items specified.</p>
            )}
          </section>

          {/* Listing details */}
          {listing && (listing.address || listing.price) && (
            <section className="bg-card border border-border rounded-lg p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Listing Details
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {listing.address && (
                  <Detail label="Address" value={`${listing.address}${listing.city ? `, ${listing.city}` : ""}${listing.state ? ` ${listing.state}` : ""} ${listing.zip || ""}`} span={2} />
                )}
                {listing.price && <Detail label="Price" value={listing.price.startsWith("$") ? listing.price : `$${listing.price}`} />}
                {listing.bedrooms && <Detail label="Beds" value={listing.bedrooms} />}
                {listing.bathrooms && <Detail label="Baths" value={listing.bathrooms} />}
                {listing.sqft && <Detail label="Sq Ft" value={listing.sqft} />}
                {listing.lot_size && <Detail label="Lot" value={listing.lot_size} />}
                {listing.year_built && <Detail label="Year" value={listing.year_built} />}
                {listing.garage && <Detail label="Garage" value={listing.garage} />}
                {listing.status && <Detail label="Status" value={listing.status} />}
              </div>
              {listing.description && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground leading-relaxed">{listing.description}</p>
                </div>
              )}
              {listing.key_features && listing.key_features.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {listing.key_features.map((f, i) => (
                    <span key={i} className="text-[11px] bg-secondary text-muted-foreground px-2 py-1 rounded">
                      {f}
                    </span>
                  ))}
                </div>
              )}
              {listing.special_instructions && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-md">
                  <p className="text-xs font-medium text-amber-800 mb-1">Special Instructions</p>
                  <p className="text-xs text-amber-700">{listing.special_instructions}</p>
                </div>
              )}
            </section>
          )}

          {/* Notes */}
          <section className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Notes</h2>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add production notes, revision feedback, or internal context..."
              className="min-h-[100px] text-sm"
            />
            <div className="flex justify-end mt-3">
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={saving || notes === (ticket.notes || "")}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Save Notes
              </Button>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Agent / Submitter info */}
          <section className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {isIntake ? "Submitter" : "Contact"}
            </h2>
            <div className="space-y-2.5">
              {agentName && (
                <div className="text-sm font-medium text-foreground">{agentName}</div>
              )}
              {ticket.contacts?.company && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building className="h-3.5 w-3.5" />
                  {ticket.contacts.company}
                </div>
              )}
              {ticket.submitter_email && (
                <a
                  href={`mailto:${ticket.submitter_email}`}
                  className="flex items-center gap-2 text-xs text-blue-600 hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {ticket.submitter_email}
                </a>
              )}
              {ticket.submitter_phone && (
                <a
                  href={`tel:${ticket.submitter_phone}`}
                  className="flex items-center gap-2 text-xs text-blue-600 hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {ticket.submitter_phone}
                </a>
              )}
              {ticket.contacts && (
                <Link
                  href={`/contacts/${ticket.contacts.id}`}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-blue-600 transition-colors mt-1"
                >
                  View in CRM <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </section>

          {/* Ticket metadata */}
          <section className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Details</h2>
            <div className="space-y-3">
              <MetaRow label="Source" value={isIntake ? "Intake Form" : "Internal"} />
              <MetaRow label="Type" value={ticket.request_type.replace("_", " ")} />
              <MetaRow label="Priority" value={ticket.priority} />
              <MetaRow label="Created" value={new Date(ticket.created_at).toLocaleDateString()} />
              {ticket.submitted_at && (
                <MetaRow label="Submitted" value={new Date(ticket.submitted_at).toLocaleDateString()} />
              )}
              {ticket.completed_at && (
                <MetaRow label="Completed" value={new Date(ticket.completed_at).toLocaleDateString()} />
              )}
            </div>
          </section>

          {/* Quick actions */}
          <section className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Actions</h2>
            <div className="space-y-2">
              {ticket.status === "submitted" && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handleStatusChange("in_production")}
                >
                  Start Production
                </Button>
              )}
              {ticket.status === "in_production" && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handleStatusChange("complete")}
                >
                  Mark Complete
                </Button>
              )}
              {ticket.submitter_email && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  asChild
                >
                  <a href={`mailto:${ticket.submitter_email}?subject=Re: ${ticket.title}`}>
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                    Email Agent
                  </a>
                </Button>
              )}
              {ticket.submitter_phone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  asChild
                >
                  <a href={`sms:${ticket.submitter_phone}`}>
                    <Phone className="h-3.5 w-3.5 mr-1.5" />
                    Text Agent
                  </a>
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------
// Sub-components
// ---------------------

function Detail({ label, value, span }: { label: string; value: string; span?: number }) {
  return (
    <div className={span ? `col-span-${span}` : ""}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs text-foreground capitalize">{value}</span>
    </div>
  );
}
