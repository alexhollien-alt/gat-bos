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
try {
  const r = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 50,
    messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
  });
  console.log('OK', r.content);
} catch (err) {
  console.log('CAUGHT:');
  console.log('  typeof:', typeof err);
  console.log('  ctor:', err?.constructor?.name);
  console.log('  message:', err?.message);
  console.log('  status:', err?.status);
  console.log('  name:', err?.name);
  console.log('  String(err):', String(err));
  console.log('  JSON:', JSON.stringify(err, Object.getOwnPropertyNames(err || {}), 2)?.slice(0, 1500));
}
