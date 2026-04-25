"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Contact, Opportunity, Project, Task } from "@/lib/types";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Users,
  Phone,
  CheckSquare,
  Clock,
  UserPlus,
  Search,
  TrendingUp,
  Briefcase,
  FolderKanban,
} from "lucide-react";

type OpportunityRow = Pick<
  Opportunity,
  "id" | "property_address" | "property_city" | "stage" | "contact_id"
>;

type ProjectRow = Pick<
  Project,
  "id" | "type" | "title" | "status"
>;

type TaskRow = Pick<
  Task,
  "id" | "title" | "status" | "priority" | "due_date" | "contact_id"
>;

const ROW_LIMIT = 50;

function stageLabel(stage: string): string {
  return stage.replace(/_/g, " ");
}

function dueBadge(dueIso: string | null): string | null {
  if (!dueIso) return null;
  const due = new Date(dueIso);
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayDiff = Math.round((due.getTime() - now.getTime()) / msPerDay);
  if (dayDiff < 0) return `${Math.abs(dayDiff)}d overdue`;
  if (dayDiff === 0) return "due today";
  if (dayDiff === 1) return "due tomorrow";
  return `due in ${dayDiff}d`;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const fetchAll = useCallback(async () => {
    const supabase = createClient();

    const [contactsRes, opportunitiesRes, projectsRes, tasksRes] =
      await Promise.all([
        supabase
          .from("contacts")
          .select(
            "id, first_name, last_name, brokerage, email, phone, health_score, tier",
          )
          .is("deleted_at", null)
          .order("first_name", { ascending: true })
          .limit(200),
        supabase
          .from("opportunities")
          .select("id, property_address, property_city, stage, contact_id")
          .order("updated_at", { ascending: false })
          .limit(ROW_LIMIT),
        supabase
          .from("projects")
          .select("id, type, title, status")
          .is("deleted_at", null)
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .limit(ROW_LIMIT),
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, contact_id")
          .neq("status", "completed")
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(ROW_LIMIT),
      ]);

    if (contactsRes.data) setContacts(contactsRes.data as Contact[]);
    if (opportunitiesRes.data)
      setOpportunities(opportunitiesRes.data as OpportunityRow[]);
    if (projectsRes.data) setProjects(projectsRes.data as ProjectRow[]);
    if (tasksRes.data) setTasks(tasksRes.data as TaskRow[]);
  }, []);

  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  function navigate(path: string) {
    setOpen(false);
    router.push(path);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search contacts, opportunities, projects, tasks..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => navigate("/contacts?action=new")}>
            <UserPlus className="mr-2 h-4 w-4" />
            New Contact
          </CommandItem>
          <CommandItem onSelect={() => navigate("/tasks")}>
            <CheckSquare className="mr-2 h-4 w-4" />
            View Tasks
          </CommandItem>
          <CommandItem onSelect={() => navigate("/tasks?type=follow_up")}>
            <Clock className="mr-2 h-4 w-4" />
            View Follow-ups
          </CommandItem>
          <CommandItem onSelect={() => navigate("/opportunities")}>
            <TrendingUp className="mr-2 h-4 w-4" />
            View Pipeline
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Contacts">
          {contacts.map((c) => (
            <CommandItem
              key={c.id}
              value={`contact ${c.first_name} ${c.last_name} ${c.brokerage || ""} ${c.email || ""}`}
              onSelect={() => navigate(`/contacts/${c.id}`)}
            >
              <Users className="mr-2 h-4 w-4" />
              <div className="flex-1 min-w-0">
                <span className="text-sm">
                  {c.first_name} {c.last_name}
                </span>
                {c.brokerage && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {c.brokerage}
                  </span>
                )}
              </div>
              {c.health_score > 0 && (
                <span className="text-xs text-muted-foreground">
                  {c.health_score}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        {opportunities.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Opportunities">
              {opportunities.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`opportunity ${o.property_address} ${o.property_city || ""} ${o.stage}`}
                  onSelect={() => navigate(`/opportunities#opp-${o.id}`)}
                >
                  <Briefcase className="mr-2 h-4 w-4" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate">
                      {o.property_address}
                    </span>
                    {o.property_city && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {o.property_city}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">
                    {stageLabel(o.stage)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`project ${p.title} ${p.type}`}
                  onSelect={() => navigate(`/projects/${p.id}`)}
                >
                  <FolderKanban className="mr-2 h-4 w-4" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate">{p.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">
                    {p.type.replace(/_/g, " ")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {tasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tasks">
              {tasks.map((t) => {
                const badge = dueBadge(t.due_date);
                return (
                  <CommandItem
                    key={t.id}
                    value={`task ${t.title} ${t.priority}`}
                    onSelect={() =>
                      navigate(
                        t.contact_id ? `/contacts/${t.contact_id}` : "/tasks",
                      )
                    }
                  >
                    <CheckSquare className="mr-2 h-4 w-4" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate">{t.title}</span>
                    </div>
                    {badge && (
                      <span className="text-xs text-muted-foreground">
                        {badge}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => navigate("/dashboard")}>
            <Search className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => navigate("/contacts")}>
            <Users className="mr-2 h-4 w-4" />
            All Contacts
          </CommandItem>
          <CommandItem onSelect={() => navigate("/campaigns")}>
            <Phone className="mr-2 h-4 w-4" />
            Campaigns
          </CommandItem>
          <CommandItem onSelect={() => navigate("/materials")}>
            <CheckSquare className="mr-2 h-4 w-4" />
            Materials
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
