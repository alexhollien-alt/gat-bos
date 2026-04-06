# Relationship CRM

A relationship management tool built for title sales executives in Phoenix real estate. Track contacts, log interactions, manage follow-ups, and maintain relationship health across your network of agents and brokers.

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase (Auth + PostgreSQL)
- Lucide React
- React Hook Form + Zod

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run the schema

Open the SQL Editor in your Supabase dashboard and run the contents of `supabase/schema.sql`. This creates all tables, enums, RLS policies, and indexes.

### 3. Configure environment

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your project URL and anon key (found in Supabase > Settings > API).

### 4. Install dependencies

```bash
npm install
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to the login page.

### 6. Create an account

Sign up with email and password. If your Supabase project has email confirmation enabled, either:
- Confirm via the email link, or
- Disable email confirmation in Supabase > Authentication > Providers > Email

### 7. Seed data (optional)

After signing up, get your user ID from the Supabase Auth dashboard (Authentication > Users). Then run this in the SQL Editor:

```sql
select seed_data('your-user-id-here');
```

This inserts 10 realistic contacts (Phoenix-area real estate agents), tags, interactions, notes, tasks, and follow-ups.

## Features (Phase 1)

- **Auth**: Email/password login and signup with protected routes
- **Dashboard**: Follow-ups due today, overdue tasks, recent contacts, recent interactions, relationship breakdown stats, quick-add actions
- **Contacts**: Searchable list with filters by relationship strength and tag. Detail page with timeline, notes, and tasks tabs
- **Interactions**: Fast-add modal for logging calls, texts, emails, meetings, broker opens, lunches, and notes
- **Notes**: Freeform notes per contact, reverse chronological, inline editable
- **Tasks**: Due date, priority, status with inline completion toggle
- **Follow-ups**: Due date tracking with overdue highlighting, mark complete/skip
- **Tags**: Color-coded chips on contacts, filter contacts by tag
- **Relationship Strength**: New / Warm / Active Partner / Advocate / Dormant with color-coded badges

## Schema

The contact model includes `source` and `lead_status` fields to support future lead generation system integration. See `supabase/schema.sql` for the full schema.

## Project Structure

```
src/
  app/
    (auth)/          Login and signup pages
    (app)/           Protected app pages (dashboard, contacts, tasks, follow-ups)
  components/
    ui/              shadcn/ui primitives
    dashboard/       Dashboard widget components
    contacts/        Contact list, card, filters, form
    interactions/    Interaction logging modal
    notes/           Note editor and display
    tasks/           Task list and form
    follow-ups/      Follow-up list and form
    tags/            Tag chips and picker
  lib/
    supabase/        Supabase client (browser + server)
    types.ts         TypeScript types
    constants.ts     Relationship, interaction, priority configs
    validations.ts   Zod schemas
```
