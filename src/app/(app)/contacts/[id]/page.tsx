"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Contact,
  Tag,
  Interaction,
  Note,
  Task,
  FollowUp,
  MaterialRequest,
  DesignAsset,
  RelationshipStrength,
} from "@/lib/types";
import { buildActivityFeed } from "@/lib/contact-activity";
import { ContactHeader } from "@/components/contacts/contact-header";
import { ActivityFeed } from "@/components/contacts/activity-feed";
import { BioPanel } from "@/components/contacts/bio-panel";
import { InteractionModal } from "@/components/interactions/interaction-modal";
import { NoteCard, NoteForm } from "@/components/notes/note-editor";
import { TaskRow } from "@/components/tasks/task-list";
import { TaskFormModal } from "@/components/tasks/task-form";
import { FollowUpRow } from "@/components/follow-ups/follow-up-list";
import { FollowUpFormModal } from "@/components/follow-ups/follow-up-form";
import { MaterialRequestRow } from "@/components/materials/material-request-row";
import { MaterialRequestFormModal } from "@/components/materials/material-request-form";
import { DesignAssetCard } from "@/components/materials/design-asset-card";
import { DesignAssetFormModal } from "@/components/materials/design-asset-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Clock,
  Printer,
  Link2,
  CircleAlert,
} from "lucide-react";
import { toast } from "sonner";

export default function ContactDetailPage() {
  const params = useParams();
  const contactId = params.id as string;
  const supabase = createClient();

  const [contact, setContact] = useState<Contact | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [designAssets, setDesignAssets] = useState<DesignAsset[]>([]);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showMaterialRequestModal, setShowMaterialRequestModal] = useState(false);
  const [showDesignAssetModal, setShowDesignAssetModal] = useState(false);

  const fetchContact = useCallback(async () => {
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();
    if (data) setContact(data);
  }, [contactId]);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase
      .from("contact_tags")
      .select("tags(*)")
      .eq("contact_id", contactId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (data) setTags(data.map((ct: any) => ct.tags));
  }, [contactId]);

  const fetchInteractions = useCallback(async () => {
    const { data } = await supabase
      .from("interactions")
      .select("*")
      .eq("contact_id", contactId)
      .order("occurred_at", { ascending: false });
    if (data) setInteractions(data);
  }, [contactId]);

  const fetchNotes = useCallback(async () => {
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });
    if (data) setNotes(data);
  }, [contactId]);

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("contact_id", contactId)
      .order("due_date", { ascending: true });
    if (data) setTasks(data);
  }, [contactId]);

  const fetchFollowUps = useCallback(async () => {
    const { data } = await supabase
      .from("follow_ups")
      .select("*")
      .eq("contact_id", contactId)
      .order("due_date", { ascending: true });
    if (data) setFollowUps(data);
  }, [contactId]);

  const fetchMaterialRequests = useCallback(async () => {
    const { data } = await supabase
      .from("material_requests")
      .select("*, material_request_items(*)")
      .eq("contact_id", contactId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (data) {
      setMaterialRequests(
        data.map((r: Record<string, unknown>) => ({
          ...r,
          items: r.material_request_items,
        })) as MaterialRequest[]
      );
    }
  }, [contactId]);

  const fetchDesignAssets = useCallback(async () => {
    const { data } = await supabase
      .from("design_assets")
      .select("*")
      .eq("contact_id", contactId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (data) setDesignAssets(data);
  }, [contactId]);

  useEffect(() => {
    fetchContact();
    fetchTags();
    fetchInteractions();
    fetchNotes();
    fetchTasks();
    fetchFollowUps();
    fetchMaterialRequests();
    fetchDesignAssets();
  }, [
    fetchContact,
    fetchTags,
    fetchInteractions,
    fetchNotes,
    fetchTasks,
    fetchFollowUps,
    fetchMaterialRequests,
    fetchDesignAssets,
  ]);

  const activityEvents = useMemo(
    () =>
      buildActivityFeed({
        interactions,
        tasks,
        followUps,
        materialRequests,
        designAssets,
      }),
    [interactions, tasks, followUps, materialRequests, designAssets]
  );

  const hasAnyHistory =
    interactions.length > 0 ||
    tasks.some((t) => t.status === "completed") ||
    followUps.some((f) => f.status === "completed") ||
    materialRequests.length > 0 ||
    designAssets.length > 0;

  const openTaskCount = tasks.filter((t) => t.status !== "completed").length;
  const overdueTaskCount = tasks.filter(
    (t) =>
      t.status !== "completed" &&
      t.due_date &&
      new Date(t.due_date) < new Date()
  ).length;

  const pendingFollowUpCount = followUps.filter(
    (f) => f.status === "pending"
  ).length;
  const overdueFollowUpCount = followUps.filter(
    (f) => f.status === "pending" && new Date(f.due_date) < new Date()
  ).length;

  const inFlightMaterialCount = materialRequests.filter(
    (m) => m.status === "submitted" || m.status === "in_production"
  ).length;

  async function updateRelationship(value: string) {
    const { error } = await supabase
      .from("contacts")
      .update({ relationship: value })
      .eq("id", contactId);
    if (error) {
      toast.error("Failed to update");
    } else {
      setContact((prev) =>
        prev ? { ...prev, relationship: value as RelationshipStrength } : null
      );
    }
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-7xl pb-12">
      {/* Sticky header */}
      <ContactHeader
        contact={contact}
        onRelationshipChange={updateRelationship}
      />

      {/* Internal note (full width, critical) */}
      {contact.internal_note && (
        <div className="mt-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <CircleAlert className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider mb-1">
                Internal Note
              </p>
              <p className="text-sm text-foreground/90">
                {contact.internal_note}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Two-column workspace: left rail (actions + bio) + right main (feed + tabs) */}
      <div className="mt-4 lg:grid lg:grid-cols-[minmax(220px,260px)_1fr] lg:gap-5 lg:items-start">
        {/* Left rail */}
        <aside className="space-y-3">
          {/* Quick Actions -- lean menu style */}
          <div className="flex flex-col gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowInteractionModal(true)}
              className="justify-start h-8 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
            >
              <Plus className="h-3 w-3 mr-2" />
              Log interaction
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowTaskModal(true)}
              className="justify-start h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3 mr-2" />
              Add task
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowFollowUpModal(true)}
              className="justify-start h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Clock className="h-3 w-3 mr-2" />
              Schedule follow-up
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowMaterialRequestModal(true)}
              className="justify-start h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Printer className="h-3 w-3 mr-2" />
              New request
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDesignAssetModal(true)}
              className="justify-start h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link2 className="h-3 w-3 mr-2" />
              Save design
            </Button>
          </div>

          {/* Bio panel */}
          <BioPanel
            contact={contact}
            contactId={contactId}
            tags={tags}
            onTagsChange={setTags}
          />
        </aside>

        {/* Right main */}
        <div className="space-y-4 mt-4 lg:mt-0 min-w-0">
          {/* Recent Activity Feed */}
          <ActivityFeed
            events={activityEvents}
            onLogInteraction={() => setShowInteractionModal(true)}
            hasAnyHistory={hasAnyHistory}
          />

          {/* Drill-in tabs (5 tabs, Timeline removed) */}
          <Tabs defaultValue="notes">
          <TabsList>
            <TabsTrigger value="notes">
              Notes <span className="font-mono ml-1">({notes.length})</span>
            </TabsTrigger>
            <TabsTrigger value="tasks">
              Tasks <span className="font-mono ml-1">({openTaskCount})</span>
              {overdueTaskCount > 0 && (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-red-400" />
              )}
            </TabsTrigger>
            <TabsTrigger value="follow-ups">
              Follow-ups{" "}
              <span className="font-mono ml-1">({pendingFollowUpCount})</span>
              {overdueFollowUpCount > 0 && (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-red-400" />
              )}
            </TabsTrigger>
            <TabsTrigger value="materials">
              Materials{" "}
              <span className="font-mono ml-1">({materialRequests.length})</span>
              {inFlightMaterialCount > 0 && (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-blue-400" />
              )}
            </TabsTrigger>
            <TabsTrigger value="designs">
              Designs{" "}
              <span className="font-mono ml-1">({designAssets.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-4 space-y-3">
            <NoteForm contactId={contactId} onSuccess={fetchNotes} />
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onUpdate={fetchNotes}
                onDelete={fetchNotes}
              />
            ))}
            {notes.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No notes yet
              </p>
            )}
          </TabsContent>

          <TabsContent value="tasks" className="mt-4 space-y-2">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} onUpdate={fetchTasks} />
            ))}
            {tasks.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No tasks yet
              </p>
            )}
          </TabsContent>

          <TabsContent value="follow-ups" className="mt-4 space-y-2">
            {followUps.map((fu) => (
              <FollowUpRow key={fu.id} followUp={fu} onUpdate={fetchFollowUps} />
            ))}
            {followUps.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No follow-ups scheduled
              </p>
            )}
          </TabsContent>

          <TabsContent value="materials" className="mt-4 space-y-2">
            {materialRequests.map((req) => (
              <MaterialRequestRow
                key={req.id}
                request={req}
                onUpdate={fetchMaterialRequests}
              />
            ))}
            {materialRequests.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No material requests yet
              </p>
            )}
          </TabsContent>

          <TabsContent value="designs" className="mt-4 space-y-2">
            {designAssets.map((asset) => (
              <DesignAssetCard
                key={asset.id}
                asset={asset}
                onUpdate={fetchDesignAssets}
              />
            ))}
            {designAssets.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No design assets saved
              </p>
            )}
          </TabsContent>
        </Tabs>
        </div>
      </div>

      {/* Modals */}
      <InteractionModal
        open={showInteractionModal}
        onOpenChange={setShowInteractionModal}
        contactId={contactId}
        contactName={`${contact.first_name} ${contact.last_name}`}
        onSuccess={fetchInteractions}
      />
      <TaskFormModal
        open={showTaskModal}
        onOpenChange={setShowTaskModal}
        contactId={contactId}
        onSuccess={fetchTasks}
      />
      <FollowUpFormModal
        open={showFollowUpModal}
        onOpenChange={setShowFollowUpModal}
        contactId={contactId}
        onSuccess={fetchFollowUps}
      />
      <MaterialRequestFormModal
        open={showMaterialRequestModal}
        onOpenChange={setShowMaterialRequestModal}
        contactId={contactId}
        contactName={`${contact.first_name} ${contact.last_name}`}
        onSuccess={fetchMaterialRequests}
      />
      <DesignAssetFormModal
        open={showDesignAssetModal}
        onOpenChange={setShowDesignAssetModal}
        contactId={contactId}
        onSuccess={fetchDesignAssets}
      />
    </div>
  );
}
