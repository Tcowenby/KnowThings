import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, normalizeUrl, stripHtml } from '../scraper/lib.js';
import { normalize, cluster, score, isAIRelevant, classify } from '../scraper/rank.js';

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>T</title>
<item><title><![CDATA[Pentagon taps AI for drone swarms &amp; targeting]]></title><link>https://example.com/a?utm_source=x</link>
<pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>The <b>DoD</b> said…</p><img src="https://img/x.jpg">]]></description>
<source url="https://ex.com">Example</source></item></channel></rss>`;

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title><entry><title>New open-weights LLM tops benchmark</title>
<link rel="alternate" href="https://lab.ai/post"/><updated>2026-11-24T08:00:00Z</updated><summary>Short</summary></entry></feed>`;

test('parses RSS with CDATA, entities, images and source', () => {
  const [it] = parseFeed(RSS);
  assert.equal(it.title, 'Pentagon taps AI for drone swarms & targeting');
  assert.equal(it.image, 'https://img/x.jpg');
  assert.equal(it.source, 'Example');
  assert.match(it.summary, /DoD said/);
});

test('parses Atom', () => {
  const [it] = parseFeed(ATOM);
  assert.equal(it.url, 'https://lab.ai/post');
  assert.equal(it.published, '2026-11-24T08:00:00Z');
});

test('normalizes URLs and strips html', () => {
  assert.equal(normalizeUrl('https://www.x.com/a/?utm_source=1&id=2#f'), 'https://x.com/a/?id=2');
  assert.equal(stripHtml('<p>a&nbsp;<b>b</b></p>'), 'a b');
});

test('relevance filter is case-aware for "AI"', () => {
  assert.ok(isAIRelevant('New AI chip'));
  assert.ok(isAIRelevant('Anthropic ships Claude update'));
  assert.ok(!isAIRelevant('The senator said aid would arrive'));
});

test('classifies military + hardware', () => {
  const c = classify('Army buys Nvidia GPUs for battlefield AI');
  assert.ok(c.includes('defense') && c.includes('hardware'));
});

test('clusters the same story across sources and ranks', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  const mk = (title, url, source, origin, h) =>
    normalize({ title, url, source, origin, published: new Date(now - h * 3600e3).toISOString(), weight: 1 }, now);
  const items = [
    mk('OpenAI releases GPT-6 with major reasoning gains', 'https://a.com/1', 'TechCrunch', 'rss', 2),
    mk('OpenAI releases GPT-6 with reasoning gains', 'https://b.com/2', 'The Verge', 'google', 3),
    mk('Defense startup unveils autonomous drone', 'https://c.com/3', 'DefenseScoop', 'rss', 1),
  ];
  const out = cluster(items);
  assert.equal(out.length, 2);
  const gpt = out.find((o) => o.title.includes('GPT-6'));
  assert.equal(gpt.coverage, 2);
  assert.equal(gpt.source, 'TechCrunch');
  assert.equal(gpt.related.length, 1);
  assert.ok(score(gpt, now) > 0);
});

test('drops irrelevant items from filtered feeds', () => {
  assert.equal(normalize({ title: 'Budget hearing today', url: 'https://x.com', needsFilter: true }), null);
});
