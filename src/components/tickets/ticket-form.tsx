"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ticketCreateSchema, type TicketCreateFormData } from "@/lib/schemas/ticket";
import {
  TICKET_PRIORITIES,
  CYPHER_BRANCHES,
  CYPHER_SHIP_TO_LOCATIONS,
} from "@/lib/cypher-constants";
import { ProjectRow } from "./project-row";
import { ContactPicker } from "./contact-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
};

type Props = {
  defaultValues?: Partial<TicketCreateFormData>;
  onSubmit: (data: TicketCreateFormData, asDraft?: boolean) => Promise<void>;
  submitting: boolean;
  submitLabel?: string;
};

export function TicketForm({ defaultValues, onSubmit, submitting, submitLabel = "Submit Ticket" }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<TicketCreateFormData>({
    resolver: zodResolver(ticketCreateSchema),
    defaultValues: {
      priority: "Normal",
      projects: [{ project_number: 1, category: "Product Request", product: "Flyers (8.5x11)" }],
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "projects" });

  const branchValue = watch("branch_association");
  const shipToValue = watch("ship_to_location");
  const priorityValue = watch("priority");
  const contactId = watch("contact_id");

  function handleContactChange(contact: ContactRow | null) {
    setValue("contact_id", contact?.id ?? undefined);
    setValue("client_first_name", contact?.first_name ?? "");
    setValue("client_last_name", contact?.last_name ?? "");
    setValue("client_company", contact?.company ?? "");
    setValue("client_email", contact?.email ?? "");
    setValue("client_phone", contact?.phone ?? "");
  }

  function addProject() {
    append({
      project_number: fields.length + 1,
      category: "Product Request",
      product: "Flyers (8.5x11)",
    });
  }

  return (
    <form className="space-y-8">
      {/* Section 1: Ticket Info */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Ticket Info
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="ticket_title">
            Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="ticket_title"
            placeholder="e.g. Joey Gutierrez -- Gainey Flyers May 2026"
            {...register("ticket_title")}
          />
          {errors.ticket_title && (
            <p className="text-xs text-destructive">{errors.ticket_title.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="description">
            Description <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="description"
            rows={4}
            placeholder="Describe the work needed..."
            {...register("description")}
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Priority</Label>
            <Select
              value={priorityValue}
              onValueChange={(v) =>
                setValue("priority", v as typeof TICKET_PRIORITIES[number], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              type="date"
              {...register("due_date")}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>
              Branch <span className="text-destructive">*</span>
            </Label>
            <Select
              value={branchValue}
              onValueChange={(v) =>
                setValue("branch_association", v as typeof CYPHER_BRANCHES[number], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select branch..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {CYPHER_BRANCHES.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.branch_association && (
              <p className="text-xs text-destructive">{errors.branch_association.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>
              Ship To <span className="text-destructive">*</span>
            </Label>
            <Select
              value={shipToValue}
              onValueChange={(v) =>
                setValue("ship_to_location", v as typeof CYPHER_SHIP_TO_LOCATIONS[number], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {CYPHER_SHIP_TO_LOCATIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.ship_to_location && (
              <p className="text-xs text-destructive">{errors.ship_to_location.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="raw_brain_dump">Brain Dump (optional)</Label>
          <Textarea
            id="raw_brain_dump"
            rows={3}
            placeholder="Paste raw notes, Claude output, or a quick voice-transcription to fill in later..."
            {...register("raw_brain_dump")}
          />
        </div>
      </section>

      {/* Section 2: General Information (agent / client) */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            General Information
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-1">
          <Label>Agent (optional)</Label>
          <ContactPicker
            value={contactId ?? null}
            onChange={handleContactChange}
          />
          <p className="text-xs text-muted-foreground">
            Selecting an agent pre-fills the fields below.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="client_first_name">First Name</Label>
            <Input
              id="client_first_name"
              {...register("client_first_name")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="client_last_name">Last Name</Label>
            <Input
              id="client_last_name"
              {...register("client_last_name")}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="client_company">Company / Brokerage</Label>
            <Input
              id="client_company"
              {...register("client_company")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="client_email">Email</Label>
            <Input
              id="client_email"
              type="email"
              {...register("client_email")}
            />
            {errors.client_email && (
              <p className="text-xs text-destructive">{errors.client_email.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="client_phone">Phone</Label>
            <Input
              id="client_phone"
              type="tel"
              {...register("client_phone")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="client_mobile_phone">Mobile</Label>
            <Input
              id="client_mobile_phone"
              type="tel"
              {...register("client_mobile_phone")}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="assigned_to">Assigned To</Label>
          <Input
            id="assigned_to"
            placeholder="e.g. Design Team -- Gainey"
            {...register("assigned_to")}
          />
        </div>
      </section>

      {/* Section 3: Projects */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Projects
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {errors.projects && !Array.isArray(errors.projects) && (
          <p className="text-xs text-destructive">
            {String((errors.projects as { message?: string }).message ?? "At least one project is required")}
          </p>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => (
            <ProjectRow
              key={field.id}
              index={index}
              register={register}
              errors={errors}
              setValue={setValue}
              watch={watch}
              onRemove={() => remove(index)}
              canRemove={fields.length > 1}
            />
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addProject}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Project
        </Button>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={handleSubmit((data) => onSubmit(data, true))}
        >
          Save Draft
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          onClick={handleSubmit((data) => onSubmit(data, false))}
        >
          {submitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
