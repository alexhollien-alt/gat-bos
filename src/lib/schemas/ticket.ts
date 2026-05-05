// src/lib/schemas/ticket.ts
// Zod schemas for Cypher Bridge ticket creation and updates.
// Validates against cypher-constants so dropdowns and API routes share one truth.

import { z } from 'zod';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  CYPHER_BRANCHES,
  CYPHER_SHIP_TO_LOCATIONS,
  CYPHER_PRODUCTS,
  TICKET_STATUSES,
} from '@/lib/cypher-constants';

export const ticketProjectSchema = z.object({
  project_number: z.number().int().positive(),
  category: z.enum(TICKET_CATEGORIES),
  product: z.enum(CYPHER_PRODUCTS),
  paper_type: z.string().optional(),
  brochure_type: z.string().optional(),
  flyer_paper_type: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  number_of_sheets: z.number().int().positive().optional(),
  total_project_cost: z.number().min(0).optional(),
});

export type TicketProjectFormData = z.infer<typeof ticketProjectSchema>;

export const ticketCreateSchema = z.object({
  ticket_title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(TICKET_PRIORITIES),
  due_date: z.string().optional(),
  branch_association: z.enum(CYPHER_BRANCHES),
  ship_to_location: z.enum(CYPHER_SHIP_TO_LOCATIONS),
  contact_id: z.string().uuid().optional(),
  client_first_name: z.string().optional(),
  client_last_name: z.string().optional(),
  client_company: z.string().optional(),
  client_email: z.string().email('Invalid email').optional().or(z.literal('')),
  client_phone: z.string().optional(),
  client_mobile_phone: z.string().optional(),
  assigned_to: z.string().optional(),
  raw_brain_dump: z.string().optional(),
  projects: z.array(ticketProjectSchema).min(1, 'At least one project is required'),
});

export type TicketCreateFormData = z.infer<typeof ticketCreateSchema>;

export const ticketUpdateSchema = ticketCreateSchema
  .omit({ projects: true })
  .partial()
  .extend({
    status: z.enum(TICKET_STATUSES).optional(),
    projects: z.array(ticketProjectSchema).min(1).optional(),
  });

export type TicketUpdateFormData = z.infer<typeof ticketUpdateSchema>;
