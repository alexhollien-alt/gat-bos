"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tag } from "@/lib/types";
import { TagChip } from "./tag-chip";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus } from "lucide-react";

export function TagPicker({
  contactId,
  selectedTags,
  onTagsChange,
}: {
  contactId: string;
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
}) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [open, setOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function fetchTags() {
      const { data } = await supabase
        .from("tags")
        .select("*")
        .order("name");
      if (data) setAllTags(data);
    }
    fetchTags();
  }, [supabase]);

  const availableTags = allTags.filter(
    (t) => !selectedTags.some((st) => st.id === t.id)
  );

  async function addTag(tag: Tag) {
    await supabase
      .from("contact_tags")
      .insert({ contact_id: contactId, tag_id: tag.id });
    onTagsChange([...selectedTags, tag]);
    setOpen(false);
  }

  async function removeTag(tagId: string) {
    await supabase
      .from("contact_tags")
      .delete()
      .eq("contact_id", contactId)
      .eq("tag_id", tagId);
    onTagsChange(selectedTags.filter((t) => t.id !== tagId));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selectedTags.map((tag) => (
        <TagChip key={tag.id} tag={tag} onRemove={() => removeTag(tag.id)} />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-slate-400 hover:text-slate-600"
          >
            <Plus className="h-3 w-3 mr-1" />
            Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          {availableTags.length === 0 ? (
            <p className="text-xs text-slate-400 p-2">No more tags</p>
          ) : (
            <div className="space-y-1">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => addTag(tag)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-left hover:bg-slate-50 transition-colors"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
