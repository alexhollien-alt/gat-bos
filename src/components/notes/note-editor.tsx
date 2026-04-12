"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Note } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInput } from "@/components/ui/voice-input";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export function NoteCard({
  note,
  onUpdate,
  onDelete,
}: {
  note: Note;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const supabase = createClient();

  async function handleSave() {
    const { error } = await supabase
      .from("notes")
      .update({ content })
      .eq("id", note.id);
    if (error) {
      toast.error("Failed to update note");
    } else {
      setEditing(false);
      onUpdate();
    }
  }

  async function handleDelete() {
    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", note.id);
    if (error) {
      toast.error("Failed to delete note");
    } else {
      onDelete();
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">
          {format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}
          {note.updated_at !== note.created_at && " (edited)"}
        </span>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-green-600"
                onClick={handleSave}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-slate-400"
                onClick={() => {
                  setContent(note.content);
                  setEditing(false);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="text-sm"
        />
      ) : (
        <p className="text-sm text-slate-700 whitespace-pre-wrap">
          {note.content}
        </p>
      )}
    </div>
  );
}

export function NoteForm({
  contactId,
  onSuccess,
}: {
  contactId: string;
  onSuccess: () => void;
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("notes").insert({
      user_id: user!.id,
      contact_id: contactId,
      content: content.trim(),
    });
    setLoading(false);
    if (error) {
      toast.error("Failed to add note");
    } else {
      setContent("");
      onSuccess();
    }
  }

  function appendTranscript(text: string) {
    setContent((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a note..."
        rows={2}
        className="text-sm"
      />
      <div className="flex justify-between items-center">
        <VoiceInput onTranscript={appendTranscript} label="Dictate" />
        <Button type="submit" size="sm" disabled={loading || !content.trim()}>
          {loading ? "Adding..." : "Add note"}
        </Button>
      </div>
    </form>
  );
}
