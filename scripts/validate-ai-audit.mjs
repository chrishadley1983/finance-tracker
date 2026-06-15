/**
 * Production-validation script for AI-usage audit logging.
 *
 * Verifies that real Anthropic-API-key calls from finance-tracker are landing
 * in the shared public.ai_api_usage table (Supabase project
 * modjoikyuhqzouxvieua).
 *
 * The write path uses a PUBLISHABLE key, which is insert-only under RLS and
 * CANNOT read rows back. Reading therefore needs the SERVICE-ROLE key for the
 * shared project, supplied via env AI_USAGE_SERVICE_KEY.
 *
 * Usage:
 *   AI_USAGE_SERVICE_KEY=<service-role-key> node scripts/validate-ai-audit.mjs
 *   (or put AI_USAGE_SERVICE_KEY in .env.local)
 *
 * Exit code 0 = PASS, 1 = FAIL.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL =
  process.env.AI_USAGE_SUPABASE_URL || 'https://modjoikyuhqzouxvieua.supabase.co';
const SERVICE_KEY = process.env.AI_USAGE_SERVICE_KEY;
const PROJECT = 'finance-tracker';
const WINDOW_MINUTES = 15;

function printTriggerInstructions() {
  console.log('───────────────────────────────────────────────────────────');
  console.log('STEP 1 — Trigger a real production AI call');
  console.log('───────────────────────────────────────────────────────────');
  console.log(
    'Do ONE of the following against the running app so a raw Anthropic',
  );
  console.log('API-key call fires (each maps to a logged feature):');
  console.log('');
  console.log('  • Upload a bank-statement PDF in the import flow');
  console.log('    → exercises lib/import/pdf-vision-parser.ts');
  console.log('      feature = "pdf_vision_parse"');
  console.log('');
  console.log('  • Import a CSV with an UNKNOWN column layout (low detection');
  console.log('    confidence) so AI column mapping kicks in');
  console.log('    → exercises lib/import/ai-mapper.ts');
  console.log('      feature = "ai_mapper"');
  console.log('');
  console.log('  • Run categorisation on transactions that rules / similar-');
  console.log('    transaction matching cannot confidently categorise');
  console.log('    → exercises lib/categorisation/ai-categoriser.ts');
  console.log('      feature = "categoriser"');
  console.log('');
  console.log(`Then re-run this script within ${WINDOW_MINUTES} minutes.`);
  console.log('');
}

async function main() {
  printTriggerInstructions();

  console.log('───────────────────────────────────────────────────────────');
  console.log('STEP 2 — Read back the shared ai_api_usage table');
  console.log('───────────────────────────────────────────────────────────');

  if (!SERVICE_KEY) {
    console.error(
      'FAIL: AI_USAGE_SERVICE_KEY is not set. The publishable key is insert-',
    );
    console.error(
      '      only (RLS) and cannot read rows. Set AI_USAGE_SERVICE_KEY (the',
    );
    console.error(
      `      service-role key for the shared project at ${SUPABASE_URL})`,
    );
    console.error('      in .env.local or the environment, then re-run.');
    process.exit(1);
  }

  const sinceIso = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  // PostgREST query: project = finance-tracker AND created_at >= sinceIso,
  // newest first.
  const params = new URLSearchParams();
  params.set('project', `eq.${PROJECT}`);
  params.set('created_at', `gte.${sinceIso}`);
  params.set('order', 'created_at.desc');
  params.set('select', '*');

  const url = `${SUPABASE_URL}/rest/v1/ai_api_usage?${params.toString()}`;

  let rows;
  try {
    const resp = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Accept: 'application/json',
      },
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(
        `FAIL: read request returned HTTP ${resp.status}: ${body.slice(0, 300)}`,
      );
      process.exit(1);
    }

    rows = await resp.json();
  } catch (err) {
    console.error(`FAIL: could not query the shared table: ${err?.message || err}`);
    process.exit(1);
  }

  console.log(
    `Looking for project="${PROJECT}" rows created since ${sinceIso}`,
  );
  console.log(`Found ${rows.length} matching row(s).`);
  console.log('');

  if (rows.length === 0) {
    console.log('───────────────────────────────────────────────────────────');
    console.log('RESULT: FAIL');
    console.log('───────────────────────────────────────────────────────────');
    console.log(
      `No finance-tracker rows in the last ${WINDOW_MINUTES} minutes. Either`,
    );
    console.log('no real AI call was triggered, or audit logging is not firing.');
    console.log('Trigger a call (see STEP 1) and re-run within the window.');
    process.exit(1);
  }

  // Summarise what we found.
  const byFeature = {};
  for (const r of rows) {
    byFeature[r.feature] = (byFeature[r.feature] || 0) + 1;
  }
  console.log('Breakdown by feature:');
  for (const [feature, count] of Object.entries(byFeature)) {
    console.log(`  ${feature.padEnd(20)} ${count}`);
  }
  console.log('');
  console.log('Most recent row:');
  const latest = rows[0];
  console.log(
    JSON.stringify(
      {
        feature: latest.feature,
        model: latest.model,
        billing_source: latest.billing_source,
        status: latest.status,
        input_tokens: latest.input_tokens,
        output_tokens: latest.output_tokens,
        cache_creation_input_tokens: latest.cache_creation_input_tokens,
        cache_read_input_tokens: latest.cache_read_input_tokens,
        request_ms: latest.request_ms,
        anthropic_message_id: latest.anthropic_message_id,
        error: latest.error,
        created_at: latest.created_at,
      },
      null,
      2,
    ),
  );
  console.log('');

  // Sanity checks on the freshest row.
  const problems = [];
  if (latest.billing_source !== 'api_key') {
    problems.push(`billing_source is "${latest.billing_source}", expected "api_key"`);
  }
  if (!['success', 'error'].includes(latest.status)) {
    problems.push(`status is "${latest.status}", expected "success" or "error"`);
  }
  if (!latest.model) {
    problems.push('model is empty (should be read from response.model)');
  }

  console.log('───────────────────────────────────────────────────────────');
  if (problems.length > 0) {
    console.log('RESULT: FAIL');
    console.log('───────────────────────────────────────────────────────────');
    for (const p of problems) console.log(`  ✗ ${p}`);
    process.exit(1);
  }

  console.log('RESULT: PASS');
  console.log('───────────────────────────────────────────────────────────');
  console.log(
    `${rows.length} finance-tracker row(s) logged in the last ${WINDOW_MINUTES} minutes.`,
  );
  console.log('Audit logging is reaching the shared ai_api_usage table.');
  process.exit(0);
}

main();
