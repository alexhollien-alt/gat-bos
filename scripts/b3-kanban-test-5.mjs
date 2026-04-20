/**
 * B3 Kanban Test 5: cross-window sync via refetchOnWindowFocus.
 *
 * 1. Seed an opportunity in `prospect`.
 * 2. Open two authenticated browser contexts (Tab A + Tab B) on /opportunities.
 * 3. Mutate stage to `under_contract` via service role (simulates Tab A drag-drop).
 * 4. Fire focus event on Tab B.
 * 5. Assert Tab B DOM reflects the new stage within the test budget.
 * 6. Soft-delete the seed row.
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { ensureAuthState, loadEnv } from './phase-9-auth-helper.mjs';

const STATE_PATH = '/tmp/b3-kanban-test-5-auth-state.json';
const BUDGET_MS = 30000;

async function main() {
  const { URL, SERVICE, SITE } = loadEnv();
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

  await ensureAuthState(STATE_PATH);

  // Resolve Alex's user id (service-role insert has no auth.uid() default).
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
  const alex = users?.users?.find((u) => u.email === 'alex@alexhollienco.com');
  if (!alex) throw new Error('alex@alexhollienco.com not found in auth');
  const alexId = alex.id;

  // Pick any contact to own the seed.
  const { data: contacts } = await admin
    .from('contacts')
    .select('id')
    .is('deleted_at', null)
    .limit(1);
  if (!contacts?.length) throw new Error('no contacts available to seed opportunity');
  const contactId = contacts[0].id;

  const seedLabel = 'B3 Test 5 -- refetchOnFocus';
  const { data: seed, error: seedErr } = await admin
    .from('opportunities')
    .insert({
      user_id: alexId,
      property_address: seedLabel,
      contact_id: contactId,
      stage: 'prospect',
      sale_price: 123456,
    })
    .select('id, stage')
    .single();
  if (seedErr) throw new Error(`seed insert failed: ${seedErr.message}`);
  console.log(`[seed] ${seed.id} stage=${seed.stage}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const ctxA = await browser.newContext({ storageState: STATE_PATH });
    const ctxB = await browser.newContext({ storageState: STATE_PATH });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await Promise.all([
      pageA.goto(`${SITE}/opportunities`, { waitUntil: 'networkidle' }),
      pageB.goto(`${SITE}/opportunities`, { waitUntil: 'networkidle' }),
    ]);

    // Default view is list. Switch both to kanban so the stage is visible as a column cell.
    // The view toggle persists in localStorage, but we set it explicitly per tab to be safe.
    for (const p of [pageA, pageB]) {
      await p.evaluate(() => localStorage.setItem('opportunity-view', 'kanban'));
      await p.reload({ waitUntil: 'networkidle' });
    }

    const initialB = await pageB
      .locator(`[data-testid="opp-${seed.id}"], :text("${seedLabel}")`)
      .first()
      .isVisible()
      .catch(() => false);
    console.log(`[tabB] seed visible pre-mutation: ${initialB}`);

    // Simulate Tab A's drag-drop result: write to DB via service role.
    const { error: mutErr } = await admin
      .from('opportunities')
      .update({ stage: 'under_contract' })
      .eq('id', seed.id);
    if (mutErr) throw new Error(`mutate failed: ${mutErr.message}`);
    const mutAt = Date.now();
    console.log('[db] stage -> under_contract');

    // Blur + focus Tab B to trigger the window-focus listener.
    await pageB.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
      window.dispatchEvent(new Event('focus'));
    });

    // Poll Tab B for the row under the under_contract column.
    const deadline = Date.now() + BUDGET_MS;
    let observedAt = null;
    while (Date.now() < deadline) {
      const matches = await pageB
        .locator(`text=${seedLabel}`)
        .count();
      if (matches > 0) {
        // Check that the row lives inside the under_contract droppable by reading DOM.
        const inUnderContract = await pageB.evaluate((label) => {
          const col = document.querySelector('[data-column="under_contract"]')
            || Array.from(document.querySelectorAll('*')).find((el) => {
              return el.textContent?.toLowerCase?.().includes('under contract');
            });
          if (!col) return null;
          return col.textContent?.includes(label) || null;
        }, seedLabel);
        if (inUnderContract) {
          observedAt = Date.now();
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    // Fallback: accept simple stage read via API call from Tab B context.
    if (!observedAt) {
      // Verify via a client-side fetch whether Tab B's state refetched at all.
      const clientStage = await pageB.evaluate(async (oppId) => {
        try {
          const res = await fetch(`/api/opportunities/${oppId}`, { credentials: 'include' });
          if (res.ok) return await res.json();
        } catch {}
        return null;
      }, seed.id);
      console.log('[tabB] client-side probe (api route may not exist):', clientStage);
    }

    if (observedAt) {
      console.log(`[PASS] Tab B refetched in ${observedAt - mutAt}ms (budget ${BUDGET_MS}ms)`);
    } else {
      // Direct DOM dump for diagnosis.
      const htmlSnippet = await pageB
        .locator('main')
        .first()
        .innerText()
        .catch(() => '(innerText unavailable)');
      console.log('[diagnostic] Tab B main text (first 2000 chars):');
      console.log(htmlSnippet.slice(0, 2000));
      throw new Error(`Tab B did not reflect stage=under_contract within ${BUDGET_MS}ms`);
    }
  } finally {
    // Soft-delete seed per Rule 3.
    const { error: delErr } = await admin
      .from('opportunities')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', seed.id);
    if (delErr) console.warn(`[cleanup] soft-delete warning: ${delErr.message}`);
    else console.log(`[cleanup] seed ${seed.id} soft-deleted`);
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exit(1);
});
