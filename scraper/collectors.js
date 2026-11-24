import { fetchText, fetchJSON, parseFeed, stripHtml, toISO } from './lib.js';
import {
  GOOGLE_NEWS_QUERIES,
  FEEDS,
  SUBREDDITS,
  ARXIV_CATEGORIES,
  SOCIAL_QUERIES,
  X_QUERY,
  INSTAGRAM_HASHTAGS,
} from './sources.js';

const DAY = 86400e3;
const env = process.env;

// Every collector returns a list of { label, run } tasks so they can run in parallel
// and fail independently. `run` resolves to an array of raw items.

function googleNews() {
  return GOOGLE_NEWS_QUERIES.map((q) => ({
    label: `Google News: ${q}`,
    run: async () => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:2d`)}&hl=en-US&gl=US&ceid=US:en`;
      const items = parseFeed(await fetchText(url));
      return items.slice(0, 40).map((it) => {
        const source = it.source || it.title.split(' - ').pop();
        const title = it.source && it.title.endsWith(` - ${it.source}`) ? it.title.slice(0, -(it.source.length + 3)) : it.title;
        return {
          title,
          url: it.url,
          published: it.published,
          summary: '',
          source,
          origin: 'google',
          kind: 'news',
          weight: 1,
          needsFilter: false,
        };
      });
    },
  }));
}

function feeds() {
  return FEEDS.map((f) => ({
    label: f.name,
    run: async () => {
      const items = parseFeed(await fetchText(f.url));
      return items.slice(0, 40).map((it) => ({
        ...it,
        source: f.name,
        origin: f.kind === 'video' ? 'youtube' : 'rss',
        kind: f.kind,
        weight: f.weight ?? 1,
        needsFilter: !!f.filter,
      }));
    },
  }));
}

function reddit() {
  return SUBREDDITS.map((sub) => ({
    label: `r/${sub}`,
    run: async () => {
      const items = parseFeed(await fetchText(`https://www.reddit.com/r/${sub}/top/.rss?t=day&limit=20`));
      return items.map((it) => ({
        title: it.title,
        url: it.url,
        published: it.published,
        summary: it.summary.replace(/submitted by .*$/i, '').trim(),
        image: it.image,
        author: it.author,
        source: `r/${sub}`,
        origin: 'reddit',
        kind: 'social',
        weight: 0.9,
        needsFilter: !['MachineLearning', 'LocalLLaMA', 'artificial', 'OpenAI', 'ClaudeAI'].includes(sub),
      }));
    },
  }));
}

function hackerNews() {
  const since = Math.floor((Date.now() - 3 * DAY) / 1000);
  return ['AI', 'LLM', 'GPT', 'Claude', 'Gemini', 'OpenAI', 'Anthropic', 'Nvidia', 'model', 'agents'].map((q) => ({
    label: `Hacker News: ${q}`,
    run: async () => {
      const data = await fetchJSON(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=40&numericFilters=created_at_i>${since},points>40`,
      );
      return (data.hits || []).map((h) => ({
        title: h.title,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        discussion: `https://news.ycombinator.com/item?id=${h.objectID}`,
        published: toISO(h.created_at_i),
        summary: '',
        author: h.author,
        source: 'Hacker News',
        origin: 'hn',
        kind: 'social',
        weight: 1,
        engagement: { points: h.points, comments: h.num_comments },
        needsFilter: true,
      }));
    },
  }));
}

function arxiv() {
  return [
    {
      label: 'Hugging Face Daily Papers',
      run: async () => {
        const data = await fetchJSON('https://huggingface.co/api/daily_papers?limit=50');
        return (data || []).map((p) => ({
          title: p.title || p.paper?.title,
          url: `https://huggingface.co/papers/${p.paper?.id}`,
          published: p.publishedAt || p.paper?.publishedAt,
          summary: stripHtml(p.paper?.summary || p.summary || ''),
          image: p.thumbnail || '',
          source: 'HF Papers',
          origin: 'papers',
          kind: 'research',
          weight: 1.1,
          engagement: { likes: p.paper?.upvotes ?? 0, comments: p.numComments ?? 0 },
          needsFilter: false,
        }));
      },
    },
    {
      label: 'arXiv',
      run: async () => {
        const q = ARXIV_CATEGORIES.map((c) => `cat:${c}`).join('+OR+');
        const xml = await fetchText(
          `https://export.arxiv.org/api/query?search_query=${q}&sortBy=submittedDate&sortOrder=descending&max_results=30`,
        );
        return parseFeed(xml).map((it) => ({
          ...it,
          title: it.title.replace(/\s+/g, ' '),
          source: 'arXiv',
          origin: 'papers',
          kind: 'research',
          weight: 0.6,
          needsFilter: false,
        }));
      },
    },
  ];
}

function githubRepos() {
  const since = new Date(Date.now() - 10 * DAY).toISOString().slice(0, 10);
  const headers = env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {};
  return ['llm', 'ai-agents', 'generative-ai', 'machine-learning', 'mcp'].map((topic) => ({
    label: `GitHub: ${topic}`,
    run: async () => {
      const data = await fetchJSON(
        `https://api.github.com/search/repositories?q=topic:${topic}+created:>${since}+stars:>50&sort=stars&order=desc&per_page=10`,
        { headers },
      );
      return (data.items || []).map((r) => ({
        title: `${r.full_name}: ${r.description || 'new repository'}`.slice(0, 280),
        url: r.html_url,
        published: r.created_at,
        summary: `${r.description || ''}${r.language ? ` · ${r.language}` : ''}`,
        image: '',
        source: 'GitHub',
        origin: 'github',
        kind: 'tools',
        weight: 0.9,
        engagement: { stars: r.stargazers_count },
        needsFilter: false,
      }));
    },
  }));
}

async function bskyAuth() {
  if (!env.BSKY_HANDLE || !env.BSKY_APP_PASSWORD) return null;
  const res = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: env.BSKY_HANDLE, password: env.BSKY_APP_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Bluesky login HTTP ${res.status}`);
  return (await res.json()).accessJwt;
}

function bluesky() {
  let tokenPromise;
  return SOCIAL_QUERIES.map((q) => ({
    label: `Bluesky: ${q}`,
    run: async () => {
      tokenPromise ??= bskyAuth();
      const token = await tokenPromise;
      const base = token ? 'https://bsky.social' : 'https://public.api.bsky.app';
      const since = new Date(Date.now() - 2 * DAY).toISOString();
      const data = await fetchJSON(
        `${base}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&sort=top&lang=en&since=${since}&limit=25`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      return (data.posts || [])
        .filter((p) => (p.likeCount ?? 0) >= 25)
        .map((p) => {
          const rkey = p.uri.split('/').pop();
          const text = p.record?.text || '';
          const ext = p.embed?.external;
          return {
            title: ext?.title || text.split('\n')[0].slice(0, 200),
            url: `https://bsky.app/profile/${p.author.handle}/post/${rkey}`,
            published: p.record?.createdAt || p.indexedAt,
            summary: text.slice(0, 320),
            image: ext?.thumb || p.embed?.images?.[0]?.thumb || '',
            author: p.author.displayName || p.author.handle,
            source: 'Bluesky',
            origin: 'bluesky',
            kind: 'social',
            weight: 0.8,
            engagement: { likes: p.likeCount, reposts: p.repostCount, comments: p.replyCount },
            needsFilter: true,
          };
        });
    },
  }));
}

function x() {
  if (!env.X_BEARER_TOKEN) return [];
  return [
    {
      label: 'X (Twitter)',
      run: async () => {
        const params = new URLSearchParams({
          query: X_QUERY,
          max_results: '50',
          sort_order: 'relevancy',
          'tweet.fields': 'created_at,public_metrics,entities',
          expansions: 'author_id',
          'user.fields': 'username,name',
        });
        const data = await fetchJSON(`https://api.x.com/2/tweets/search/recent?${params}`, {
          headers: { Authorization: `Bearer ${env.X_BEARER_TOKEN}` },
          retries: 0,
        });
        const users = new Map((data.includes?.users || []).map((u) => [u.id, u]));
        return (data.data || []).map((t) => {
          const u = users.get(t.author_id) || { username: 'i', name: 'X' };
          const link = t.entities?.urls?.find((l) => !/(twitter|x)\.com/.test(l.expanded_url || ''));
          return {
            title: (link?.title || t.text.split('\n')[0]).slice(0, 220),
            url: `https://x.com/${u.username}/status/${t.id}`,
            published: t.created_at,
            summary: t.text.slice(0, 320),
            image: link?.images?.[0]?.url || '',
            author: `${u.name} (@${u.username})`,
            source: 'X',
            origin: 'x',
            kind: 'social',
            weight: 0.9,
            engagement: {
              likes: t.public_metrics?.like_count,
              reposts: t.public_metrics?.retweet_count,
              comments: t.public_metrics?.reply_count,
            },
            needsFilter: false,
          };
        });
      },
    },
  ];
}

function instagram() {
  if (!env.IG_USER_ID || !env.IG_ACCESS_TOKEN) return [];
  const G = 'https://graph.facebook.com/v21.0';
  const auth = `user_id=${env.IG_USER_ID}&access_token=${env.IG_ACCESS_TOKEN}`;
  return INSTAGRAM_HASHTAGS.map((tag) => ({
    label: `Instagram #${tag}`,
    run: async () => {
      const found = await fetchJSON(`${G}/ig_hashtag_search?q=${encodeURIComponent(tag)}&${auth}`, { retries: 0 });
      const id = found.data?.[0]?.id;
      if (!id) return [];
      const media = await fetchJSON(
        `${G}/${id}/top_media?fields=id,caption,permalink,media_url,media_type,timestamp,like_count,comments_count&limit=25&${auth}`,
        { retries: 0 },
      );
      return (media.data || []).map((m) => ({
        title: (m.caption || `#${tag}`).split('\n')[0].slice(0, 200),
        url: m.permalink,
        published: m.timestamp,
        summary: (m.caption || '').slice(0, 320),
        image: m.media_type === 'IMAGE' ? m.media_url : '',
        source: 'Instagram',
        origin: 'instagram',
        kind: 'social',
        weight: 0.7,
        engagement: { likes: m.like_count, comments: m.comments_count },
        needsFilter: true,
      }));
    },
  }));
}

export function allTasks() {
  return [
    ...googleNews(),
    ...feeds(),
    ...reddit(),
    ...hackerNews(),
    ...arxiv(),
    ...githubRepos(),
    ...bluesky(),
    ...x(),
    ...instagram(),
  ];
}
