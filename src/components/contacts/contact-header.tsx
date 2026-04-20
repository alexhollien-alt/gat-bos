"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Contact } from "@/lib/types";
import {
  TIER_CONFIG,
  CONTACT_TYPE_CONFIG,
  RELATIONSHIP_CONFIG,
} from "@/lib/constants";
import { calculateTemperature, formatPulseAge } from "@/lib/temperature";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Building, Info } from "lucide-react";

// Hysteresis buffer: expand at 60px, collapse at 100px. Prevents rapid flipping
// when scrolling exactly at the threshold which caused paint-layer ghosting.
const COLLAPSE_AT = 100;
const EXPAND_AT = 60;

export function ContactHeader({
  contact,
  onRelationshipChange,
}: {
  contact: Contact;
  onRelationshipChange: (value: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        setCollapsed((prev) => {
          if (prev && y < EXPAND_AT) return false;
          if (!prev && y >= COLLAPSE_AT) return true;
          return prev;
        });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const temp = calculateTemperature(contact);
  const tempDisplay = temp.value > 0 ? Math.round(temp.value) : null;

  const initials = `${contact.first_name.charAt(0)}${contact.last_name.charAt(0)}`;

  return (
    <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 bg-background border-b border-border">
      <div className="px-4 sm:px-6 lg:px-8">
        <Link
          href="/contacts"
          className={`inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ${
            collapsed ? "hidden" : "pt-3"
          }`}
        >
          <ArrowLeft className="h-3 w-3" />
          Back to contacts
        </Link>

        <div
          className={`flex items-center justify-between gap-4 transition-all duration-200 ease-out ${
            collapsed ? "py-2" : "py-3"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {contact.headshot_url ? (
              // Headshots are user-pasted URLs from arbitrary external domains
              // (agent sites, LinkedIn, Dropbox). next/image remotePatterns
              // allowlist would break existing contact data.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contact.headshot_url}
                alt={`${contact.first_name} ${contact.last_name}`}
                className={`object-cover headshot-mask transition-all duration-200 ease-out ${
                  collapsed ? "w-8 h-8" : "w-14 h-14"
                }`}
              />
            ) : (
              <div
                className={`rounded-full bg-secondary flex items-center justify-center text-muted-foreground font-semibold transition-all duration-200 ease-out ${
                  collapsed ? "w-8 h-8 text-xs" : "w-14 h-14 text-base"
                }`}
              >
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  className={`font-display font-bold text-foreground truncate transition-all duration-200 ease-out ${
                    collapsed ? "text-base" : "text-2xl"
                  }`}
                >
                  {contact.first_name} {contact.last_name}
                </h1>
                {contact.tier && TIER_CONFIG[contact.tier] && (
                  <span
                    className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${TIER_CONFIG[contact.tier].bgColor} ${TIER_CONFIG[contact.tier].textColor}`}
                  >
                    Tier {contact.tier}
                  </span>
                )}
                {!collapsed &&
                  contact.type &&
                  CONTACT_TYPE_CONFIG[contact.type] && (
                    <span
                      className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${CONTACT_TYPE_CONFIG[contact.type].bgColor} ${CONTACT_TYPE_CONFIG[contact.type].textColor}`}
                    >
                      {CONTACT_TYPE_CONFIG[contact.type].label}
                    </span>
                  )}
              </div>
              {!collapsed && contact.brokerage && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Building className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground truncate">
                    {contact.title ? `${contact.title}, ` : ""}
                    {contact.brokerage}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {tempDisplay !== null && (
              <div className="group relative flex items-center gap-1">
                <span
                  className={`font-mono font-bold tabular-nums transition-all duration-200 ${
                    collapsed ? "text-lg" : "text-2xl"
                  } ${temp.colorClass}`}
                >
                  {tempDisplay}°
                </span>
                <Info className="h-3 w-3 text-muted-foreground/60" />
                {/* Tooltip */}
                <div className="absolute right-0 top-full mt-2 hidden group-hover:block z-40 min-w-[220px] bg-popover border border-border rounded-md shadow-lg p-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Source</span>
                      <span className="font-medium text-foreground">
                        {temp.source === "rep_pulse"
                          ? "Your call"
                          : temp.source === "system"
                            ? "System"
                            : "No data"}
                      </span>
                    </div>
                    {temp.repPulseRaw !== null && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Rep pulse</span>
                        <span className="font-mono text-foreground">
                          {temp.repPulseRaw}/10 · {formatPulseAge(temp.repPulseUpdatedAt)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">System</span>
                      <span className="font-mono text-foreground">
                        {temp.healthScoreRaw}°
                      </span>
                    </div>
                    {temp.diverged && (
                      <div className="pt-1 border-t border-border mt-1 text-yellow-400">
                        Diverged. Recalibrate?
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {!collapsed && (
              <Select
                value={contact.stage}
                onValueChange={onRelationshipChange}
              >
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RELATIONSHIP_CONFIG).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
