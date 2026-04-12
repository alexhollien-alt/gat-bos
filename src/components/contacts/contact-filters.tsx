"use client";

import { RELATIONSHIP_CONFIG } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

export type ContactSortKey =
  | "lastname_asc"
  | "lastname_desc"
  | "recent_added"
  | "recent_touched";

const SORT_LABELS: Record<ContactSortKey, string> = {
  lastname_asc: "Last name A–Z",
  lastname_desc: "Last name Z–A",
  recent_added: "Recently added",
  recent_touched: "Recently touched",
};

export function ContactFilters({
  search,
  onSearchChange,
  relationship,
  onRelationshipChange,
  sortBy,
  onSortChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  relationship: string;
  onRelationshipChange: (v: string) => void;
  sortBy: ContactSortKey;
  onSortChange: (v: ContactSortKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={relationship} onValueChange={onRelationshipChange}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All relationships" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All relationships</SelectItem>
          {Object.entries(RELATIONSHIP_CONFIG).map(([key, val]) => (
            <SelectItem key={key} value={key}>
              {val.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={sortBy}
        onValueChange={(v) => onSortChange(v as ContactSortKey)}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABELS) as ContactSortKey[]).map((key) => (
            <SelectItem key={key} value={key}>
              {SORT_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
