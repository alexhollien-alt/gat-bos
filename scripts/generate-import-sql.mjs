#!/usr/bin/env node
/**
 * Reads agents-index.json and generates INSERT SQL for Supabase contacts table.
 * Output: ~/Desktop/import-contacts.sql
 *
 * Field mapping (agents-index.json -> live contacts table):
 *   first_name -> first_name
 *   last_name -> last_name
 *   email -> email
 *   phone -> phone
 *   brokerage -> brokerage
 *   title -> title
 *   website -> website_url
 *   stage -> stage
 *   flags -> tags (jsonb array)
 *   headshot -> headshot_url
 *   brokerage_logo -> brokerage_logo_url
 *   agent_logo -> agent_logo_url
 *   brand_colors -> brand_colors (jsonb)
 *   palette -> palette
 *   font_kit -> font_kit
 *   tier -> tier
 *   temperature -> temperature
 *   rep_pulse -> rep_pulse
 *   preferred_channel -> preferred_channel
 *   referred_by -> referred_by
 *   escrow_officer -> escrow_officer
 *   farm_area -> farm_area
 *   farm_zips -> farm_zips (text[])
 *   contact_md -> contact_md_path
 *   last_contact -> last_touch_date
 *   next_action -> next_action
 *   lead_source -> source
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const indexPath = join(homedir(), 'Documents/Alex Hub/05_AGENTS/agents-index.json');
const outputPath = join(homedir(), 'Desktop/import-contacts.sql');

const data = JSON.parse(readFileSync(indexPath, 'utf-8'));
const agents = data.agents;

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function escJsonb(obj) {
  if (!obj) return 'NULL';
  const hasValue = Object.values(obj).some(v => v !== null);
  if (!hasValue) return 'NULL';
  return "'" + JSON.stringify(obj).replace(/'/g, "''") + "'::jsonb";
}

function escTextArray(arr) {
  if (!arr || arr.length === 0) return 'NULL';
  const items = arr.map(v => '"' + String(v).replace(/"/g, '\\"') + '"');
  return "'{" + items.join(',') + "}'";
}

function escInt(val) {
  if (val === null || val === undefined) return 'NULL';
  return String(parseInt(val, 10));
}

function escDate(val) {
  if (!val) return 'NULL';
  return "'" + val + "'";
}

const lines = [];
lines.push('-- Import contacts from agents-index.json');
lines.push('-- Generated: ' + new Date().toISOString().split('T')[0]);
lines.push('-- Records: ' + agents.length);
lines.push('-- ON CONFLICT: skip duplicates by email');
lines.push('');

// Add unique constraint on email if not exists (needed for ON CONFLICT)
lines.push('-- Ensure email uniqueness for upsert');
lines.push("DO $$ BEGIN");
lines.push("  ALTER TABLE contacts ADD CONSTRAINT contacts_email_unique UNIQUE (email);");
lines.push("EXCEPTION WHEN duplicate_object THEN NULL;");
lines.push("END $$;");
lines.push('');

for (const a of agents) {
  if (!a.email) {
    lines.push('-- SKIPPED (no email): ' + a.name);
    continue;
  }

  // Map flags array to tags format that matches live DB
  const tagsArr = a.flags && a.flags.length > 0 ? a.flags : null;

  // Map stage: agents-index uses 'active', DB allows: new, warm, active_partner, advocate, dormant
  const stageMap = {
    'active': 'active_partner',
    'target': 'new',
    'engaged': 'warm',
    'pipeline': 'warm',
    'consistent': 'advocate',
    'champion': 'advocate',
  };
  const dbStage = stageMap[a.stage] || 'new';

  // Map type: DB allows: realtor, lender, builder, vendor, buyer, seller, past_client, warm_lead, referral_partner, sphere, other
  const dbType = 'realtor';  // all agents-index entries are realtors

  lines.push(`INSERT INTO contacts (`);
  lines.push(`  first_name, last_name, email, phone, brokerage, title,`);
  lines.push(`  website_url, stage, tags,`);
  lines.push(`  headshot_url, brokerage_logo_url, agent_logo_url,`);
  lines.push(`  brand_colors, palette, font_kit,`);
  lines.push(`  tier, temperature, rep_pulse,`);
  lines.push(`  preferred_channel, referred_by, escrow_officer,`);
  lines.push(`  farm_area, farm_zips, contact_md_path,`);
  lines.push(`  last_touch_date, next_action, source, type`);
  lines.push(`) VALUES (`);
  lines.push(`  ${esc(a.first_name)}, ${esc(a.last_name)}, ${esc(a.email)}, ${esc(a.phone)}, ${esc(a.brokerage)}, ${esc(a.title)},`);
  lines.push(`  ${esc(a.website)}, ${esc(dbStage)}, ${tagsArr ? escTextArray(tagsArr) : 'NULL'},`);
  lines.push(`  ${esc(a.headshot)}, ${esc(a.brokerage_logo)}, ${esc(a.agent_logo)},`);
  lines.push(`  ${escJsonb(a.brand_colors)}, ${esc(a.palette)}, ${esc(a.font_kit)},`);
  lines.push(`  ${esc(a.tier)}, ${escInt(a.temperature)}, ${escInt(a.rep_pulse)},`);
  lines.push(`  ${esc(a.preferred_channel)}, ${esc(a.referred_by)}, ${esc(a.escrow_officer)},`);
  lines.push(`  ${esc(a.farm_area)}, ${escTextArray(a.farm_zips)}, ${esc(a.contact_md)},`);
  lines.push(`  ${escDate(a.last_contact)}, ${esc(a.next_action)}, ${esc(a.lead_source)}, ${esc(dbType)}`);
  lines.push(`) ON CONFLICT (email) DO UPDATE SET`);
  lines.push(`  brokerage = COALESCE(EXCLUDED.brokerage, contacts.brokerage),`);
  lines.push(`  tier = COALESCE(EXCLUDED.tier, contacts.tier),`);
  lines.push(`  temperature = COALESCE(EXCLUDED.temperature, contacts.temperature),`);
  lines.push(`  stage = COALESCE(EXCLUDED.stage, contacts.stage),`);
  lines.push(`  contact_md_path = COALESCE(EXCLUDED.contact_md_path, contacts.contact_md_path),`);
  lines.push(`  updated_at = now();`);
  lines.push('');
}

lines.push('-- Summary: check count');
lines.push("SELECT count(*) as total_contacts FROM contacts;");

writeFileSync(outputPath, lines.join('\n'), 'utf-8');
console.log(`Generated ${agents.length} INSERT statements -> ${outputPath}`);
