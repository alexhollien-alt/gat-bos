"use client";

import { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { TicketCreateFormData } from "@/lib/schemas/ticket";
import { TICKET_CATEGORIES, CYPHER_PRODUCTS } from "@/lib/cypher-constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

type Props = {
  index: number;
  register: UseFormRegister<TicketCreateFormData>;
  errors: FieldErrors<TicketCreateFormData>;
  setValue: UseFormSetValue<TicketCreateFormData>;
  watch: UseFormWatch<TicketCreateFormData>;
  onRemove: () => void;
  canRemove: boolean;
};

export function ProjectRow({ index, register, errors, setValue, watch, onRemove, canRemove }: Props) {
  const projects = watch("projects");
  const category = projects?.[index]?.category ?? "Product Request";
  const product = projects?.[index]?.product ?? "";

  const projectErrors = errors.projects?.[index];

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground font-mono">
          Project {index + 1}
        </h4>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            aria-label={`Remove project ${index + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <input type="hidden" {...register(`projects.${index}.project_number`, { valueAsNumber: true })} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <Select
            value={category}
            onValueChange={(v) =>
              setValue(`projects.${index}.category`, v as typeof TICKET_CATEGORIES[number], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Quantity</Label>
          <Input
            type="number"
            min={1}
            className="h-8 text-sm"
            {...register(`projects.${index}.quantity`, { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">
          Product <span className="text-destructive">*</span>
        </Label>
        <Select
          value={product}
          onValueChange={(v) =>
            setValue(`projects.${index}.product`, v as typeof CYPHER_PRODUCTS[number], {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select a product..." />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {CYPHER_PRODUCTS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {projectErrors?.product && (
          <p className="text-xs text-destructive">{String(projectErrors.product.message)}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Paper Type</Label>
          <Input
            className="h-8 text-sm"
            placeholder="e.g. 100# Gloss"
            {...register(`projects.${index}.paper_type`)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Brochure Type</Label>
          <Input
            className="h-8 text-sm"
            placeholder="e.g. Tri-fold"
            {...register(`projects.${index}.brochure_type`)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Flyer Paper</Label>
          <Input
            className="h-8 text-sm"
            placeholder="e.g. 80# Matte"
            {...register(`projects.${index}.flyer_paper_type`)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Sheets</Label>
          <Input
            type="number"
            min={1}
            className="h-8 text-sm"
            {...register(`projects.${index}.number_of_sheets`, { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cost ($)</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            className="h-8 text-sm"
            {...register(`projects.${index}.total_project_cost`, { valueAsNumber: true })}
          />
        </div>
      </div>
    </div>
  );
}
