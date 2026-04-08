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

export function ContactFilters({
  search,
  onSearchChange,
  relationship,
  onRelationshipChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  relationship: string;
  onRelationshipChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
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
    </div>
  );
}
