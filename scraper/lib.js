import { XMLParser } from 'fast-xml-parser';
import crypto from 'node:crypto';

const UA = 'Mozilla/5.0 (compatible; KnowThingsBot/1.0; +https://github.com/tcowenby/KnowThings)';

export async function fetchText(url, { headers = {}, timeout = 20000, retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: '*/*', ...headers },
        signal: ctrl.signal,
        redirect: 'follow',
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.fatal = true;
        throw err;
      }
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (err.fatal) break;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1) ** 2));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export async function fetchJSON(url, opts = {}) {
  const text = await fetchText(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers || {}) } });
  return JSON.parse(text);
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  cdataPropName: false,
  processEntities: true,
  htmlEntities: true,
  trimValues: true,
  isArray: (name) => ['item', 'entry', 'link', 'category', 'media:content', 'media:thumbnail'].includes(name),
});

const text = (v) => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object') return text(v['#text'] ?? '');
  return '';
};

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

export function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+\d*);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITY[e.toLowerCase()] ?? m;
  });
}

export function stripHtml(html = '', max = 320) {
  const s = decodeEntities(
    String(html)
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).trim() + '…';
}

function firstImg(html = '') {
  const m = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? decodeEntities(m[1]) : '';
}

function pickLink(links) {
  if (!links) return '';
  if (typeof links === 'string') return links;
  const arr = Array.isArray(links) ? links : [links];
  const alt = arr.find((l) => typeof l === 'object' && (!l['@rel'] || l['@rel'] === 'alternate') && l['@href']);
  if (alt) return alt['@href'];
  const any = arr.find((l) => typeof l === 'string' || l?.['@href'] || l?.['#text']);
  return typeof any === 'string' ? any : any?.['@href'] || any?.['#text'] || '';
}

function pickImage(it) {
  const candidates = [
    ...(it['media:content'] || []),
    ...(it['media:thumbnail'] || []),
    ...(it['media:group']?.['media:thumbnail'] || []),
    ...(it['media:group']?.['media:content'] || []),
  ];
  for (const c of candidates) {
    const url = c?.['@url'];
    if (url && (!c['@medium'] || c['@medium'] === 'image') && !/\.(mp4|mp3|m4a)(\?|$)/i.test(url)) return url;
  }
  const enc = it.enclosure;
  if (enc?.['@url'] && /^image\//.test(enc['@type'] || '')) return enc['@url'];
  return firstImg(text(it['content:encoded']) || text(it.description) || text(it.content) || text(it.summary));
}

/** Parse RSS 2.0 / RSS 1.0 (RDF) / Atom into a uniform item list. */
export function parseFeed(xml) {
  const doc = parser.parse(xml);
  const channel = doc.rss?.channel || doc['rdf:RDF']?.channel;
  const rawItems = doc.rss?.channel?.item || doc['rdf:RDF']?.item || doc.feed?.entry || [];
  const feedTitle = text(channel?.title || doc.feed?.title);
  return rawItems.map((it) => {
    const html =
      text(it['content:encoded']) ||
      text(it.description) ||
      text(it.summary) ||
      text(it.content) ||
      text(it['media:group']?.['media:description']);
    return {
      title: stripHtml(text(it.title), 300),
      url: pickLink(it.link) || text(it.guid) || text(it.id),
      published: text(it.pubDate) || text(it.published) || text(it.updated) || text(it['dc:date']) || '',
      author: stripHtml(text(it['dc:creator']) || text(it.author?.name) || text(it.author), 80),
      summary: stripHtml(html),
      image: pickImage(it),
      source: text(it.source) || '',
      sourceUrl: it.source?.['@url'] || '',
      categories: (it.category || []).map((c) => text(c) || c?.['@term']).filter(Boolean),
      feedTitle,
    };
  });
}

export function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    for (const k of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$|ref_src|cmpid|ocid|smid|taid|guccounter)/i.test(k)) url.searchParams.delete(k);
    }
    url.hostname = url.hostname.replace(/^(www|m|amp)\./, '');
    let s = url.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return u;
  }
}

export const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

export function toISO(d) {
  if (!d) return null;
  const t = typeof d === 'number' ? new Date(d < 1e12 ? d * 1000 : d) : new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

/** Run async tasks with a concurrency cap. Never rejects; returns {ok, value|error} per task. */
export async function pool(tasks, limit = 8) {
  const results = new Array(tasks.length);
  let i = 0;
  const worker = async () => {
    while (i < tasks.length) {
      const idx = i++;
      try {
        results[idx] = { ok: true, value: await tasks[idx]() };
      } catch (error) {
        results[idx] = { ok: false, error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}
