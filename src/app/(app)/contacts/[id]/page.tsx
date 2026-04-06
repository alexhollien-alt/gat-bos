"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Contact, Tag, Interaction, Note, Task, FollowUp, MaterialRequest, DesignAsset } from "@/lib/types";
import { RELATIONSHIP_CONFIG, SOURCE_LABELS, INTERACTION_CONFIG, TIER_CONFIG, CONTACT_TYPE_CONFIG } from "@/lib/constants";
import { TagPicker } from "@/components/tags/tag-picker";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Building,
  Mail,
  Phone,
  Plus,
  Clock,
  Printer,
  Link2,
  Thermometer,
  MapPin,
  Globe,
  User,
  Palette,
  Type,
  Instagram,
  Linkedin,
  BadgeCheck,
  CalendarClock,
  CircleAlert,
  ExternalLink,
} from "lucide-react";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";
import { RelationshipStrength } from "@/lib/types";

function InteractionIcon({ type }: { type: string }) {
  return (
    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-medium">
      {INTERACTION_CONFIG[type as keyof typeof INTERACTION_CONFIG]?.label.charAt(0) || "?"}
    </div>
  );
}

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
  }, [fetchContact, fetchTags, fetchInteractions, fetchNotes, fetchTasks, fetchFollowUps, fetchMaterialRequests, fetchDesignAssets]);

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
      <div className="flex items-center justify-center h-64 text-slate-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to contacts
      </Link>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            {contact.headshot_url ? (
              <img
                src={contact.headshot_url}
                alt={`${contact.first_name} ${contact.last_name}`}
                className="w-14 h-14 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-lg font-semibold">
                {contact.first_name.charAt(0)}
                {contact.last_name.charAt(0)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-800">
                  {contact.first_name} {contact.last_name}
                </h1>
                {contact.type && CONTACT_TYPE_CONFIG[contact.type] && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${CONTACT_TYPE_CONFIG[contact.type].bgColor} ${CONTACT_TYPE_CONFIG[contact.type].textColor}`}
                  >
                    {CONTACT_TYPE_CONFIG[contact.type].label}
                  </span>
                )}
                {contact.tier && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TIER_CONFIG[contact.tier].bgColor} ${TIER_CONFIG[contact.tier].textColor}`}
                  >
                    Tier {contact.tier}
                  </span>
                )}
              </div>
              {contact.company && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Building className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-500">
                    {contact.title ? `${contact.title}, ` : ""}
                    {contact.company}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Temperature */}
            {contact.temperature > 0 && (
              <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-slate-400" />
                <div className="w-16 bg-slate-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${contact.temperature}%`,
                      backgroundColor:
                        contact.temperature >= 80
                          ? "#ef4444"
                          : contact.temperature >= 60
                            ? "#f97316"
                            : contact.temperature >= 40
                              ? "#eab308"
                              : "#3b82f6",
                    }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  {contact.temperature}
                </span>
              </div>
            )}
            <Select
              value={contact.relationship}
              onValueChange={updateRelationship}
            >
              <SelectTrigger className="w-40">
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
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-slate-500 mb-4">
          {contact.email && (
            <span className="flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-slate-400" />
              {contact.email}
            </span>
          )}
          {contact.phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-slate-400" />
              {contact.phone}
            </span>
          )}
          {contact.website_url && (
            <a
              href={contact.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700"
            >
              <Globe className="h-4 w-4" />
              Website
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {contact.instagram_handle && (
            <a
              href={`https://instagram.com/${contact.instagram_handle.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-pink-600 hover:text-pink-700"
            >
              <Instagram className="h-4 w-4" />
              @{contact.instagram_handle.replace(/^@/, "")}
            </a>
          )}
          {contact.linkedin_url && (
            <a
              href={contact.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-blue-700 hover:text-blue-800"
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {contact.source !== "manual" && (
            <span className="text-xs text-slate-400">
              Source: {SOURCE_LABELS[contact.source]}
            </span>
          )}
        </div>

        <TagPicker
          contactId={contactId}
          selectedTags={tags}
          onTagsChange={setTags}
        />

        {contact.notes && (
          <p className="text-sm text-slate-600 mt-4 p-3 bg-slate-50 rounded-md">
            {contact.notes}
          </p>
        )}
      </div>

      {/* Status Bar */}
      {(contact.stage ||
        contact.last_touch_date ||
        contact.next_action ||
        contact.license_number) && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {contact.stage && (
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      RELATIONSHIP_CONFIG[
                        contact.stage as keyof typeof RELATIONSHIP_CONFIG
                      ]?.color || "#6b7280",
                  }}
                />
                <span className="text-xs text-slate-500">Stage</span>
                <span className="text-sm font-medium text-slate-700 capitalize">
                  {contact.stage.replace(/_/g, " ")}
                </span>
              </div>
            )}
            {contact.last_touch_date && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-500">Last touch</span>
                <span className="text-sm text-slate-700">
                  {formatDistanceToNowStrict(
                    parseISO(contact.last_touch_date),
                    { addSuffix: true }
                  )}
                </span>
              </div>
            )}
            {contact.next_action && (
              <div className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-500">Next</span>
                <span className="text-sm text-slate-700">
                  {contact.next_action}
                </span>
                {contact.next_action_date && (
                  <span className="text-xs text-slate-400">
                    ({format(parseISO(contact.next_action_date), "MMM d")})
                  </span>
                )}
              </div>
            )}
            {contact.license_number && (
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-500">License</span>
                <span className="text-sm text-slate-700">
                  {contact.license_number}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Internal Note */}
      {contact.internal_note && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <CircleAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
                Internal Note
              </p>
              <p className="text-sm text-amber-900">{contact.internal_note}</p>
            </div>
          </div>
        </div>
      )}

      {/* Marketing Profile */}
      {(contact.farm_area ||
        contact.preferred_channel ||
        contact.referred_by ||
        contact.escrow_officer ||
        contact.brand_colors ||
        contact.palette ||
        contact.font_kit ||
        contact.rep_pulse) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Business Info */}
          {(contact.farm_area ||
            contact.preferred_channel ||
            contact.referred_by ||
            contact.escrow_officer ||
            contact.rep_pulse) && (
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Business Info
              </h3>
              <div className="space-y-2.5">
                {contact.farm_area && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">Farm Area</p>
                      <p className="text-sm text-slate-700">
                        {contact.farm_area}
                        {contact.farm_zips && contact.farm_zips.length > 0 && (
                          <span className="text-slate-400">
                            {" "}
                            ({contact.farm_zips.join(", ")})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {contact.preferred_channel && (
                  <div className="flex items-start gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">
                        Preferred Channel
                      </p>
                      <p className="text-sm text-slate-700 capitalize">
                        {contact.preferred_channel}
                      </p>
                    </div>
                  </div>
                )}
                {contact.referred_by && (
                  <div className="flex items-start gap-2">
                    <User className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">Referred By</p>
                      <p className="text-sm text-slate-700">
                        {contact.referred_by}
                      </p>
                    </div>
                  </div>
                )}
                {contact.escrow_officer && (
                  <div className="flex items-start gap-2">
                    <Building className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">Escrow Officer</p>
                      <p className="text-sm text-slate-700">
                        {contact.escrow_officer}
                      </p>
                    </div>
                  </div>
                )}
                {contact.rep_pulse && (
                  <div className="flex items-start gap-2">
                    <Thermometer className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">Rep Pulse</p>
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-3 rounded-sm ${
                              i < contact.rep_pulse!
                                ? "bg-blue-500"
                                : "bg-slate-100"
                            }`}
                          />
                        ))}
                        <span className="text-xs text-slate-500 ml-1">
                          {contact.rep_pulse}/10
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Marketing Assets */}
          {(contact.brand_colors ||
            contact.palette ||
            contact.font_kit) && (
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Marketing Profile
              </h3>
              <div className="space-y-2.5">
                {contact.brand_colors &&
                  Object.keys(contact.brand_colors).length > 0 && (
                    <div className="flex items-start gap-2">
                      <Palette className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-400">Brand Colors</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {Object.entries(contact.brand_colors).map(
                            ([name, hex]) => (
                              <div
                                key={name}
                                className="group relative"
                                title={`${name}: ${hex}`}
                              >
                                <div
                                  className="w-6 h-6 rounded border border-slate-200"
                                  style={{ backgroundColor: hex }}
                                />
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                {contact.palette && (
                  <div className="flex items-start gap-2">
                    <Globe className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">Palette</p>
                      <p className="text-sm text-slate-700">
                        {contact.palette}
                      </p>
                    </div>
                  </div>
                )}
                {contact.font_kit && (
                  <div className="flex items-start gap-2">
                    <Type className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">Font Kit</p>
                      <p className="text-sm text-slate-700">
                        {contact.font_kit}
                      </p>
                    </div>
                  </div>
                )}
                {(contact.brokerage_logo_url || contact.agent_logo_url) && (
                  <div className="flex items-center gap-3 mt-2">
                    {contact.brokerage_logo_url && (
                      <img
                        src={contact.brokerage_logo_url}
                        alt="Brokerage logo"
                        className="h-8 object-contain"
                      />
                    )}
                    {contact.agent_logo_url && (
                      <img
                        src={contact.agent_logo_url}
                        alt="Agent logo"
                        className="h-8 object-contain"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowInteractionModal(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Log interaction
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowTaskModal(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add task
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowFollowUpModal(true)}
        >
          <Clock className="h-3 w-3 mr-1" />
          Schedule follow-up
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowMaterialRequestModal(true)}
        >
          <Printer className="h-3 w-3 mr-1" />
          New request
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowDesignAssetModal(true)}
        >
          <Link2 className="h-3 w-3 mr-1" />
          Save design
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">
            Timeline ({interactions.length})
          </TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="follow-ups">
            Follow-ups ({followUps.filter((f) => f.status === "pending").length})
          </TabsTrigger>
          <TabsTrigger value="materials">
            Materials ({materialRequests.length})
          </TabsTrigger>
          <TabsTrigger value="designs">
            Designs ({designAssets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          {interactions.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              No interactions yet
            </p>
          ) : (
            <div className="space-y-3">
              {interactions.map((interaction) => (
                <div
                  key={interaction.id}
                  className="flex gap-3 p-3 bg-white border border-slate-200 rounded-lg"
                >
                  <InteractionIcon type={interaction.type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-slate-600">
                        {INTERACTION_CONFIG[interaction.type]?.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        {format(
                          new Date(interaction.occurred_at),
                          "MMM d, yyyy 'at' h:mm a"
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">
                      {interaction.summary}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

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
            <p className="text-sm text-slate-400 py-4 text-center">
              No notes yet
            </p>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 space-y-2">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onUpdate={fetchTasks} />
          ))}
          {tasks.length === 0 && (
            <p className="text-sm text-slate-400 py-8 text-center">
              No tasks yet
            </p>
          )}
        </TabsContent>

        <TabsContent value="follow-ups" className="mt-4 space-y-2">
          {followUps.map((fu) => (
            <FollowUpRow key={fu.id} followUp={fu} onUpdate={fetchFollowUps} />
          ))}
          {followUps.length === 0 && (
            <p className="text-sm text-slate-400 py-8 text-center">
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
            <p className="text-sm text-slate-400 py-8 text-center">
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
            <p className="text-sm text-slate-400 py-8 text-center">
              No design assets saved
            </p>
          )}
        </TabsContent>
      </Tabs>

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
