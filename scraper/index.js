#!/usr/bin/env node
// KnowThings scraper: collects AI news from every source, ranks it, writes app/data/feed.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allTasks } from './collectors.js';
import { normalize, cluster, score } from './rank.js';
import { pool, fetchJSON } from './lib.js';
import { CATEGORIES } from './sources.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'app', 'data', 'feed.json');
const KEEP_DAYS = Number(process.env.KEEP_DAYS || 7);
const MAX_ITEMS = Number(process.env.MAX_ITEMS || 900);

async function loadPrevious() {
  // In CI the site is deployed from a build artifact, so the last feed lives on the live site.
  if (process.env.PREVIOUS_FEED_URL) {
    try {
      const prev = await fetchJSON(process.env.PREVIOUS_FEED_URL, { retries: 1 });
      console.log(`↺ loaded ${prev.items?.length ?? 0} items from previous deploy`);
      return prev.items || [];
    } catch (e) {
      console.log(`↺ no previous deploy feed (${e.message})`);
    }
  }
  try {
    return JSON.parse(await fs.readFile(OUT, 'utf8')).items || [];
  } catch {
    return [];
  }
}

async function main() {
  const started = Date.now();
  const tasks = allTasks();
  console.log(`Running ${tasks.length} source tasks…`);
  const results = await pool(
    tasks.map((t) => t.run),
    10,
  );

  const sources = [];
  const raw = [];
  results.forEach((r, i) => {
    const label = tasks[i].label;
    if (r.ok) {
      raw.push(...r.value);
      sources.push({ label, ok: true, count: r.value.length });
      console.log(`  ✓ ${label} (${r.value.length})`);
    } else {
      sources.push({ label, ok: false, error: String(r.error?.message || r.error).slice(0, 120) });
      console.log(`  ✗ ${label}: ${r.error?.message || r.error}`);
    }
  });

  const now = Date.now();
  const cutoff = now - KEEP_DAYS * 86400e3;
  const fresh = raw.map((it) => normalize(it, now)).filter(Boolean);
  const previous = (await loadPrevious()).filter((it) => it?.id && it.url);

  // New data wins over previously stored copies of the same URL.
  const byId = new Map();
  for (const it of previous) byId.set(it.id, it);
  for (const it of fresh) byId.set(it.id, it);
  const pooled = [...byId.values()].filter((it) => new Date(it.published).getTime() >= cutoff);

  const items = cluster(pooled)
    .map((it) => ({ ...it, score: score(it, now) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ITEMS);

  const okCount = sources.filter((s) => s.ok).length;
  const feed = {
    generated: new Date(now).toISOString(),
    tookMs: now - started,
    stats: { sourcesOk: okCount, sourcesTotal: sources.length, rawItems: raw.length, stories: items.length },
    categories: [...CATEGORIES.map(({ id, label }) => ({ id, label })), { id: 'general', label: 'General' }],
    sources,
    items,
  };

  if (!fresh.length && !previous.length) {
    console.error('No items collected from any source — not writing an empty feed.');
    process.exitCode = 1;
    return;
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(feed));
  console.log(`\n✔ ${items.length} stories from ${okCount}/${sources.length} sources → ${path.relative(ROOT, OUT)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
