"use client";

import { useState } from "react";
import { Contact, Tag } from "@/lib/types";
import { SOURCE_LABELS } from "@/lib/constants";
import { TagPicker } from "@/components/tags/tag-picker";
import {
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  Globe,
  Instagram,
  Linkedin,
  ExternalLink,
  MapPin,
  User,
  Building,
  Thermometer,
  Palette,
  Type,
  BadgeCheck,
  Plus,
} from "lucide-react";

/**
 * Tier A and B (top realtors) see the Marketing Profile card.
 * Tier C and P (lighter touch / partners) only see Identity + Business.
 */
function showsMarketingProfile(tier: Contact["tier"]): boolean {
  return tier === "A" || tier === "B";
}

function FieldRow({
  icon: Icon,
  label,
  value,
  onAdd,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode | null;
  onAdd?: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {value ? (
          <div className="text-sm text-foreground">{value}</div>
        ) : (
          <button
            onClick={onAdd}
            className="text-xs italic text-muted-foreground/60 hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Add {label.toLowerCase()}
          </button>
        )}
      </div>
    </div>
  );
}

export function BioPanel({
  contact,
  contactId,
  tags,
  onTagsChange,
  onEdit,
}: {
  contact: Contact;
  contactId: string;
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  onEdit?: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const showMarketing = showsMarketingProfile(contact.tier);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
            Bio
          </h2>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          {contact.tier ? `Tier ${contact.tier}` : "No tier"}
        </span>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Identity + Business cards (stacked; parent rail is narrow) */}
          <div className="grid grid-cols-1 gap-4">
            {/* Identity */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Identity
              </h3>
              <div className="space-y-2.5">
                <FieldRow
                  icon={Mail}
                  label="Email"
                  value={contact.email}
                  onAdd={onEdit}
                />
                <FieldRow
                  icon={Phone}
                  label="Phone"
                  value={contact.phone}
                  onAdd={onEdit}
                />
                <FieldRow
                  icon={Globe}
                  label="Website"
                  value={
                    contact.website_url ? (
                      <a
                        href={contact.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Visit
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null
                  }
                  onAdd={onEdit}
                />
                <FieldRow
                  icon={Instagram}
                  label="Instagram"
                  value={
                    contact.instagram_handle
                      ? `@${contact.instagram_handle.replace(/^@/, "")}`
                      : null
                  }
                  onAdd={onEdit}
                />
                <FieldRow
                  icon={Linkedin}
                  label="LinkedIn"
                  value={
                    contact.linkedin_url ? (
                      <a
                        href={contact.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Profile
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null
                  }
                  onAdd={onEdit}
                />
                <FieldRow
                  icon={BadgeCheck}
                  label="License #"
                  value={
                    contact.license_number ? (
                      <span className="font-mono">{contact.license_number}</span>
                    ) : null
                  }
                  onAdd={onEdit}
                />
                {contact.source && contact.source !== "manual" && (
                  <FieldRow
                    icon={User}
                    label="Source"
                    value={SOURCE_LABELS[contact.source]}
                  />
                )}
              </div>
              <div className="pt-2">
                <TagPicker
                  contactId={contactId}
                  selectedTags={tags}
                  onTagsChange={onTagsChange}
                />
              </div>
            </div>

            {/* Business */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Business
              </h3>
              <div className="space-y-2.5">
                <FieldRow
                  icon={MapPin}
                  label="Farm Area"
                  value={
                    contact.farm_area ? (
                      <span>
                        {contact.farm_area}
                        {contact.farm_zips && contact.farm_zips.length > 0 && (
                          <span className="text-muted-foreground font-mono ml-1">
                            ({contact.farm_zips.join(", ")})
                          </span>
                        )}
                      </span>
                    ) : null
                  }
                  onAdd={onEdit}
                />
                <FieldRow
                  icon={Phone}
                  label="Preferred Channel"
                  value={
                    contact.preferred_channel ? (
                      <span className="capitalize">
                        {contact.preferred_channel}
                      </span>
                    ) : null
                  }
                  onAdd={onEdit}
                />
                <FieldRow
                  icon={User}
                  label="Referred By"
                  value={contact.referred_by}
                  onAdd={onEdit}
                />
                <FieldRow
                  icon={Building}
                  label="Escrow Officer"
                  value={contact.escrow_officer}
                  onAdd={onEdit}
                />
                {contact.rep_pulse !== null && (
                  <FieldRow
                    icon={Thermometer}
                    label="Rep Pulse"
                    value={
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-3 rounded-sm ${
                              i < contact.rep_pulse!
                                ? "bg-primary"
                                : "bg-secondary"
                            }`}
                          />
                        ))}
                        <span className="text-xs font-mono text-muted-foreground ml-1">
                          {contact.rep_pulse}/10
                        </span>
                      </div>
                    }
                  />
                )}
              </div>
            </div>
          </div>

          {/* Marketing Profile (Tier A/B only) */}
          {showMarketing && (
            <div className="pt-2 border-t border-border space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Marketing Profile
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2.5">
                  <FieldRow
                    icon={Palette}
                    label="Palette"
                    value={contact.palette}
                    onAdd={onEdit}
                  />
                  <FieldRow
                    icon={Type}
                    label="Font Kit"
                    value={contact.font_kit}
                    onAdd={onEdit}
                  />
                  <FieldRow
                    icon={Palette}
                    label="Brand Colors"
                    value={
                      contact.brand_colors &&
                      Object.keys(contact.brand_colors).length > 0 ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          {Object.entries(contact.brand_colors).map(
                            ([name, hex]) => (
                              <div
                                key={name}
                                className="w-5 h-5 rounded border border-border"
                                style={{ backgroundColor: hex }}
                                title={`${name}: ${hex}`}
                              />
                            )
                          )}
                        </div>
                      ) : null
                    }
                    onAdd={onEdit}
                  />
                </div>
                <div className="space-y-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Logos
                  </p>
                  <div className="flex items-center gap-3">
                    {contact.brokerage_logo_url ? (
                      // Logos are user-pasted URLs from arbitrary external
                      // domains (brokerage sites, brand kits). next/image
                      // remotePatterns allowlist would break existing data.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={contact.brokerage_logo_url}
                        alt="Brokerage logo"
                        className="h-10 max-w-[120px] object-contain bg-secondary p-1 rounded"
                      />
                    ) : (
                      <button
                        onClick={onEdit}
                        className="text-xs italic text-muted-foreground/60 hover:text-foreground flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Brokerage logo
                      </button>
                    )}
                    {contact.agent_logo_url ? (
                      // See brokerage_logo_url above -- same user-paste constraint.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={contact.agent_logo_url}
                        alt="Agent logo"
                        className="h-10 max-w-[120px] object-contain bg-secondary p-1 rounded"
                      />
                    ) : (
                      <button
                        onClick={onEdit}
                        className="text-xs italic text-muted-foreground/60 hover:text-foreground flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Personal logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {contact.notes && (
            <div className="pt-2 border-t border-border">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Free-form Notes
              </h3>
              <p className="text-sm text-foreground/80 bg-secondary/40 rounded-md p-3">
                {contact.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
