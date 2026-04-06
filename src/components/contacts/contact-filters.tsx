"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tag } from "@/lib/types";
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
  tagId,
  onTagChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  relationship: string;
  onRelationshipChange: (v: string) => void;
  tagId: string;
  onTagChange: (v: string) => void;
}) {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("tags")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) setTags(data);
      });
  }, []);

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
      <Select value={tagId} onValueChange={onTagChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All tags" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All tags</SelectItem>
          {tags.map((tag) => (
            <SelectItem key={tag.id} value={tag.id}>
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
