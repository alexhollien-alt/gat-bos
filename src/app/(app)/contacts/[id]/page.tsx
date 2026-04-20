"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
import { ContactProjectsPanel } from "@/components/contacts/contact-projects-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  StatRail,
  AccentRule,
  MonoNumeral,
} from "@/components/screen";
import { getAgentAccent } from "@/lib/agent-palette";
import {
  CONTACT_TYPE_CONFIG,
  DESIGN_ASSET_TYPE_LABELS,
} from "@/lib/constants";
import {
  Plus,
  Clock,
  Printer,
  Link2,
  CircleAlert,
} from "lucide-react";
import { toast } from "sonner";

type LoadState = "loading" | "loaded" | "not_found" | "error";

export default function ContactDetailPage() {
  const params = useParams();
  // useParams returns Record<string, string | string[]> | null. Guard against
  // catch-all routes or a null first-render so we never cast undefined -> string.
  const rawId = params?.id;
  const contactId = typeof rawId === "string" ? rawId : "";
  const supabase = useMemo(() => createClient(), []);

  const [contact, setContact] = useState<Contact | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
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
    if (!contactId) {
      setLoadState("not_found");
      return;
    }
    // maybeSingle() returns data: null when zero rows (clean miss), vs
    // .single() which errors. Filter out soft-deleted contacts so archived
    // records render as not_found instead of loading forever.
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("Failed to load contact:", error);
      setLoadState("error");
      return;
    }
    if (!data) {
      setLoadState("not_found");
      return;
    }
    setContact(data);
    setLoadState("loaded");
  }, [contactId, supabase]);

  // Tags subsystem (contact_tags + tags tables) is not present in the
  // live DB. PostgREST returns a relation-not-found error when this is
  // queried. Keeping the `tags` state + BioPanel prop wiring as empty
  // scaffolding until the tags subsystem is rebuilt.

  const fetchInteractions = useCallback(async () => {
    const { data } = await supabase
      .from("interactions")
      .select("*")
      .eq("contact_id", contactId)
      .order("occurred_at", { ascending: false });
    if (data) setInteractions(data);
  }, [contactId, supabase]);

  const fetchNotes = useCallback(async () => {
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });
    if (data) setNotes(data);
  }, [contactId, supabase]);

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("contact_id", contactId)
      .order("due_date", { ascending: true });
    if (data) setTasks(data);
  }, [contactId, supabase]);

  const fetchFollowUps = useCallback(async () => {
    const { data } = await supabase
      .from("follow_ups")
      .select("*")
      .eq("contact_id", contactId)
      .order("due_date", { ascending: true });
    if (data) setFollowUps(data);
  }, [contactId, supabase]);

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
  }, [contactId, supabase]);

  const fetchDesignAssets = useCallback(async () => {
    const { data } = await supabase
      .from("design_assets")
      .select("*")
      .eq("contact_id", contactId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (data) setDesignAssets(data);
  }, [contactId, supabase]);

  useEffect(() => {
    fetchContact();
    fetchInteractions();
    fetchNotes();
    fetchTasks();
    fetchFollowUps();
    fetchMaterialRequests();
    fetchDesignAssets();
  }, [
    fetchContact,
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
    // DB column is `stage` (holds the relationship-strength enum).
    // See src/lib/types.ts -- column was renamed from `relationship` to `stage`.
    const { error } = await supabase
      .from("contacts")
      .update({ stage: value })
      .eq("id", contactId);
    if (error) {
      toast.error("Failed to update");
    } else {
      setContact((prev) =>
        prev ? { ...prev, stage: value as RelationshipStrength } : null
      );
    }
  }

  if (loadState === "loading") {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (loadState === "not_found" || !contact) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <p className="text-muted-foreground">Contact not found.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/contacts">Back to contacts</Link>
        </Button>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <p className="text-muted-foreground">
          Something went wrong loading this contact.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoadState("loading");
            fetchContact();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const accent = getAgentAccent(contact.palette);
  const fullName = `${contact.first_name} ${contact.last_name}`;
  const initials = `${contact.first_name.charAt(0)}${contact.last_name.charAt(0)}`;
  const typeLabel =
    (contact.type && CONTACT_TYPE_CONFIG[contact.type]?.label) ?? "Relationship";
  const subhead = [contact.title, contact.brokerage]
    .filter((v): v is string => Boolean(v))
    .join(", ");
  const topDesigns = designAssets.slice(0, 5);

  return (
    <div className="max-w-7xl pb-12">
      {/* Showcase-in-workspace hero (layered above sticky ContactHeader) */}
      <section
        className="relative mb-6 overflow-hidden rounded-xl border border-border/60 bg-secondary/20 p-6 sm:p-8"
        style={{
          backgroundImage: `radial-gradient(ellipse at top right, ${accent}1A 0%, transparent 55%)`,
        }}
      >
        <PageHeader
          size="lg"
          eyebrow={<span style={{ color: accent }}>{typeLabel}</span>}
          eyebrowTone="inherit"
          title={fullName}
          subhead={subhead || undefined}
          right={
            contact.headshot_url ? (
              <img
                src={contact.headshot_url}
                alt={fullName}
                className="h-32 w-32 object-cover headshot-mask-hero sm:h-36 sm:w-36"
              />
            ) : (
              <div
                className="flex h-32 w-32 items-center justify-center bg-secondary font-display text-4xl text-muted-foreground sm:h-36 sm:w-36"
                style={{ color: accent }}
              >
                {initials}
              </div>
            )
          }
        />
        <StatRail
          className="mt-8"
          items={[
            {
              stat: <MonoNumeral size="lg">{openTaskCount}</MonoNumeral>,
              label: "Open Tasks",
            },
            {
              stat: <MonoNumeral size="lg">{pendingFollowUpCount}</MonoNumeral>,
              label: "Follow-ups",
            },
            {
              stat: <MonoNumeral size="lg">{inFlightMaterialCount}</MonoNumeral>,
              label: "In Flight",
            },
            {
              stat: <MonoNumeral size="lg">{designAssets.length}</MonoNumeral>,
              label: "Designs",
            },
          ]}
        />
        <AccentRule
          variant="primary"
          className="mt-6"
          style={{
            background: `linear-gradient(90deg, ${accent} 0%, ${accent} 40%, transparent 100%)`,
          }}
        />
        {topDesigns.length > 0 && (
          <div className="mt-6 -mx-6 sm:-mx-8 px-6 sm:px-8">
            <div className="flex gap-3 overflow-x-auto pb-1">
              {topDesigns.map((asset) => (
                <a
                  key={asset.id}
                  href={asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex-shrink-0 w-44"
                >
                  <div className="aspect-[4/3] rounded-md border border-border/50 bg-card/40 flex items-center justify-center transition-colors group-hover:border-border group-hover:bg-card/70">
                    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {DESIGN_ASSET_TYPE_LABELS[asset.asset_type]}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-foreground truncate">
                    {asset.name}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

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
            <TabsTrigger value="projects">
              Projects
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

          <TabsContent value="projects" className="mt-4">
            <ContactProjectsPanel contactId={contactId} />
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
