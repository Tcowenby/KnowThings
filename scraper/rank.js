import { AI_PATTERNS, CATEGORIES } from './sources.js';
import { normalizeUrl, hash, toISO } from './lib.js';

const HOUR = 3600e3;
const STOP = new Set(
  'the a an and or of to in on for with by from at as is are was were be been its it this that these those how why what who new says said will can could after over into about than more just amid via report reports first'.split(
    ' ',
  ),
);

export const isAIRelevant = (s) => AI_PATTERNS.some((re) => re.test(s));

export function classify(s) {
  const cats = CATEGORIES.filter((c) => c.patterns.some((re) => re.test(s))).map((c) => c.id);
  return cats.length ? cats : ['general'];
}

function tokens(title) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[’'`]s\b/g, '')
      .replace(/[^a-z0-9.+\- ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Clean a raw collector item into the stored shape. Returns null if unusable. */
export function normalize(raw, now = Date.now()) {
  const title = (raw.title || '').trim();
  if (!title || !raw.url || !/^https?:/.test(raw.url)) return null;
  const published = toISO(raw.published) || new Date(now).toISOString();
  // Clamp future-dated items (bad feed clocks) to now.
  const pubMs = Math.min(new Date(published).getTime(), now);
  const haystack = `${title} ${raw.summary || ''}`;
  if (raw.needsFilter && !isAIRelevant(haystack)) return null;
  const url = normalizeUrl(raw.url);
  return {
    id: hash(url),
    title,
    url,
    source: (raw.source || 'Web').trim(),
    origin: raw.origin,
    kind: raw.kind,
    summary: raw.summary && raw.summary !== title ? raw.summary : '',
    image: raw.image || '',
    author: raw.author || '',
    discussion: raw.discussion || '',
    published: new Date(pubMs).toISOString(),
    engagement: raw.engagement || undefined,
    weight: raw.weight ?? 1,
    categories: classify(haystack),
    related: raw.related || [],
  };
}

function engagementScore(e) {
  if (!e) return 0;
  const n = (e.points || 0) + (e.likes || 0) + (e.stars || 0) + 2 * (e.reposts || 0) + (e.comments || 0);
  return Math.log10(1 + n);
}

const ORIGIN_PREF = { rss: 5, youtube: 4, papers: 4, google: 3, hn: 2, github: 2, x: 1, bluesky: 1, reddit: 1, instagram: 0 };

/** Group items that cover the same story; pick the best representative. */
export function cluster(items) {
  const toks = items.map((it) => tokens(it.title));
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  // Inverted index keeps this near-linear for typical inputs.
  const index = new Map();
  toks.forEach((set, i) => {
    for (const w of set) {
      if (!index.has(w)) index.set(w, []);
      index.get(w).push(i);
    }
  });
  for (let i = 0; i < items.length; i++) {
    if (toks[i].size < 3) continue;
    const seen = new Set();
    for (const w of toks[i]) {
      const list = index.get(w);
      if (list.length > 200) continue; // ultra-common token, skip
      for (const j of list) {
        if (j <= i || seen.has(j)) continue;
        seen.add(j);
        const close = Math.abs(new Date(items[i].published) - new Date(items[j].published)) < 72 * HOUR;
        if (close && jaccard(toks[i], toks[j]) >= 0.5) parent[find(j)] = find(i);
      }
    }
  }
  const groups = new Map();
  items.forEach((it, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(it);
  });

  return [...groups.values()].map((group) => {
    group.sort(
      (a, b) =>
        (ORIGIN_PREF[b.origin] ?? 0) - (ORIGIN_PREF[a.origin] ?? 0) ||
        b.weight - a.weight ||
        new Date(a.published) - new Date(b.published),
    );
    const [lead, ...rest] = group;
    const related = new Map();
    for (const it of [lead, ...rest]) {
      for (const r of it.related || []) related.set(r.url, r);
      if (it !== lead) related.set(it.url, { source: it.source, url: it.url, title: it.title });
    }
    related.delete(lead.url);
    const sources = new Set([lead.source, ...[...related.values()].map((r) => r.source)]);
    return {
      ...lead,
      // Earliest report time is when the story broke.
      published: group.reduce((m, it) => (it.published < m ? it.published : m), lead.published),
      summary: lead.summary || rest.find((r) => r.summary)?.summary || '',
      image: lead.image || rest.find((r) => r.image)?.image || '',
      engagement: group.reduce((acc, it) => {
        for (const [k, v] of Object.entries(it.engagement || {})) acc[k] = Math.max(acc[k] || 0, v || 0);
        return acc;
      }, {}),
      categories: [...new Set(group.flatMap((it) => it.categories))].filter((c, _, a) => c !== 'general' || a.length === 1),
      related: [...related.values()].slice(0, 12),
      coverage: sources.size,
    };
  });
}

export function score(item, now = Date.now()) {
  const ageH = Math.max(0, (now - new Date(item.published).getTime()) / HOUR);
  const recency = Math.exp(-ageH / 30);
  const coverage = 1 + 0.45 * Math.log2(item.coverage || 1);
  const launch = /\b(launch|launches|unveil|unveils|releases?|announc|introduc|debuts?|open-?sources?)\w*/i.test(item.title) ? 1.15 : 1;
  const base = 100 * item.weight * coverage * launch + 12 * engagementScore(item.engagement);
  return Math.round(base * recency * 10) / 10;
}
