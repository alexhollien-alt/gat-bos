import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import Anthropic from '@anthropic-ai/sdk';

const env = Object.fromEntries(
  readFileSync(resolve(homedir(), 'crm', '.env.local'), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; })
);
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Read the actual SYSTEM_PROMPT length
const SYSTEM_PROMPT = readFileSync('src/lib/claude/brief-client.ts', 'utf8')
  .match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/)[1];

console.log('System prompt len:', SYSTEM_PROMPT.length);

try {
  const r = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: 'BRIEF DATE: 2026-04-25\n\nDATA (JSON):\n{"brief_date":"2026-04-25","temperature_ranking":[],"congrats_queue":[]}\n\nWrite the brief now. Markdown only.' }],
  });
  console.log('OK len:', r.content?.[0]?.text?.length, 'usage:', r.usage);
} catch (err) {
  console.log('CAUGHT:');
  console.log('  typeof:', typeof err);
  console.log('  ctor:', err?.constructor?.name);
  console.log('  message:', err?.message);
  console.log('  status:', err?.status);
  console.log('  String(err):', String(err)?.slice(0,500));
  console.log('  JSON:', JSON.stringify(err, Object.getOwnPropertyNames(err || {}), 2)?.slice(0, 2000));
}
