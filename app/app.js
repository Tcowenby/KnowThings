// KnowThings — client app. No framework, no build step.
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const listEl = $('#list');
const scroller = $('#scroller');
const detailEl = $('#detail');

const CAT_COLORS = {
  models: 'var(--c-models)', defense: 'var(--c-defense)', hardware: 'var(--c-hardware)', robotics: 'var(--c-robotics)',
  policy: 'var(--c-policy)', business: 'var(--c-business)', research: 'var(--c-research)', tools: 'var(--c-tools)', general: 'var(--c-general)',
};
const CAT_SHORT = { models: 'Models', defense: 'Military', hardware: 'Chips', robotics: 'Robotics', policy: 'Policy', business: 'Business', research: 'Research', tools: 'Tools', general: 'General' };
const ORIGIN_COLORS = { google: '#4285f4', rss: '#6d5cf5', reddit: '#ff4500', hn: '#ff6600', x: '#111', bluesky: '#1185fe', instagram: '#d62976', youtube: '#ff0033', papers: '#0e9bb4', github: '#24292f' };
const SOCIAL = new Set(['reddit', 'hn', 'x', 'bluesky', 'instagram']);
const DEFAULT_WATCH = ['Anthropic', 'OpenAI', 'DeepMind', 'Nvidia', 'Anduril', 'Palantir', 'agents'];

// ───────── Persistent prefs (per device) ─────────
const store = {
  get(k, d) { try { const v = localStorage.getItem(`kt:${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`kt:${k}`, JSON.stringify(v)); } catch {} },
};

const state = {
  feed: null,
  view: store.get('view', 'feed'),
  cat: 'all',
  sort: store.get('sort', 'top'),
  query: '',
  selectedId: null,
  saved: new Map(store.get('saved', []).map((i) => [i.id, i])),
  read: new Set(store.get('read', [])),
  watch: store.get('watch', DEFAULT_WATCH),
  muted: new Set(store.get('muted', [])),
  theme: store.get('theme', 'auto'),
  hideRead: store.get('hideRead', false),
  lastVisit: store.get('lastVisit', 0),
  loading: false,
};

// ───────── Utilities ─────────
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const watchRe = () => (state.watch.length ? new RegExp(`\\b(${state.watch.map(reEsc).join('|')})`, 'i') : null);

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(n));

function highlight(text, q) {
  let out = esc(text);
  const terms = [q, ...(state.view === 'foryou' ? state.watch : [])].filter((t) => t && t.trim().length > 1);
  if (!terms.length) return out;
  const re = new RegExp(`(${terms.map((t) => reEsc(esc(t.trim()))).join('|')})`, 'gi');
  return out.replace(re, '<mark>$1</mark>');
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

const isWide = () => getComputedStyle(detailEl).position !== 'fixed';

// ───────── Data ─────────
async function loadFeed({ manual = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  $('#refresh').classList.add('spin');
  try {
    const res = await fetch(`data/feed.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const feed = await res.json();
    const prevGen = state.feed?.generated;
    state.feed = feed;
    if (manual) toast(prevGen && prevGen === feed.generated ? 'Already up to date' : 'Updated');
  } catch (e) {
    if (!state.feed) state.feed = { items: [], error: true };
    if (manual) toast(navigator.onLine ? 'Could not load the feed' : 'You’re offline');
  } finally {
    state.loading = false;
    $('#refresh').classList.remove('spin');
    render();
  }
}

function itemsFor() {
  const all = state.feed?.items || [];
  let items;
  if (state.view === 'saved') items = [...state.saved.values()].sort((a, b) => b.savedAt - a.savedAt);
  else if (state.view === 'foryou') {
    const re = watchRe();
    items = re ? all.filter((it) => re.test(`${it.title} ${it.summary} ${it.source}`)) : [];
  } else items = all;

  items = items.filter((it) => !state.muted.has(it.source));
  if (state.view !== 'saved') {
    if (state.cat === 'social') items = items.filter((it) => SOCIAL.has(it.origin));
    else if (state.cat === 'video') items = items.filter((it) => it.origin === 'youtube');
    else if (state.cat === 'breaking') items = items.filter((it) => Date.now() - new Date(it.published) < 6 * 3600e3);
    else if (state.cat !== 'all') items = items.filter((it) => it.categories?.includes(state.cat));
    if (state.hideRead) items = items.filter((it) => !state.read.has(it.id) || it.id === state.selectedId);
  }
  const q = state.query.trim().toLowerCase();
  if (q) items = items.filter((it) => `${it.title} ${it.summary} ${it.source} ${it.author}`.toLowerCase().includes(q));
  if (state.view !== 'saved' && (state.sort === 'latest' || state.cat === 'breaking')) {
    items = [...items].sort((a, b) => new Date(b.published) - new Date(a.published));
  }
  return items;
}

const findItem = (id) => state.feed?.items?.find((i) => i.id === id) || state.saved.get(id);

// ───────── Rendering ─────────
function chipDefs() {
  const all = state.feed?.items || [];
  const count = (f) => all.filter(f).length;
  const cats = (state.feed?.categories || []).filter((c) => c.id !== 'general');
  return [
    { id: 'all', label: 'All' },
    { id: 'breaking', label: 'Last 6h', n: count((i) => Date.now() - new Date(i.published) < 6 * 3600e3) },
    ...cats.map((c) => ({ id: c.id, label: CAT_SHORT[c.id] || c.label, n: count((i) => i.categories?.includes(c.id)) })),
    { id: 'social', label: 'Social', n: count((i) => SOCIAL.has(i.origin)) },
    { id: 'video', label: 'Video', n: count((i) => i.origin === 'youtube') },
  ].filter((c) => c.n !== 0);
}

function renderChips() {
  const el = $('#chips');
  if (state.view === 'settings' || state.view === 'saved') { el.hidden = true; return; }
  el.hidden = false;
  const sortChip = `<button class="chip sort" data-sort aria-label="Sort order">${state.sort === 'top' ? '★ Top' : '◷ Latest'}</button>`;
  el.innerHTML = sortChip + chipDefs()
    .map((c) => `<button class="chip" role="tab" data-cat="${c.id}" aria-selected="${state.cat === c.id}">${esc(c.label)}${c.n != null ? `<span class="n">${c.n}</span>` : ''}</button>`)
    .join('');
}

function avatar(it) {
  const color = ORIGIN_COLORS[it.origin] || '#6d5cf5';
  const letter = (it.origin === 'x' ? '𝕏' : it.source.replace(/^r\//, '')[0] || '•').toUpperCase();
  return `<span class="avatar" style="background:${color}">${esc(letter)}</span>`;
}

function badges(it) {
  const out = [];
  if ((it.coverage || 1) >= 3) out.push(`<span class="badge hot"><svg viewBox="0 0 24 24"><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/></svg>${it.coverage} sources</span>`);
  else if (it.coverage === 2) out.push(`<span class="badge">2 sources</span>`);
  const e = it.engagement || {};
  const pop = (e.points || 0) + (e.likes || 0) + (e.stars || 0);
  if (pop) out.push(`<span class="badge">${e.stars ? '★' : '▲'} ${compact(pop)}</span>`);
  if (e.comments) out.push(`<span class="badge">💬 ${compact(e.comments)}</span>`);
  return out.join('');
}

function tags(it, max = 2) {
  return (it.categories || []).slice(0, max).map((c) => `<span class="tag" style="--c:${CAT_COLORS[c] || CAT_COLORS.general}">${CAT_SHORT[c] || c}</span>`).join('');
}

function cardHTML(it, lead = false) {
  const img = safeUrl(it.image);
  const isNew = !state.read.has(it.id) && new Date(it.published).getTime() > state.lastVisit;
  const meta = `<div class="card-meta">${avatar(it)}<span class="src">${esc(it.source)}</span><span class="dot"></span><time>${ago(it.published)}</time>${isNew ? '<span class="unread" aria-label="new"></span>' : ''}</div>`;
  const body = `<h2 class="card-title">${highlight(it.title, state.query)}</h2>${it.summary ? `<p class="card-summary">${highlight(it.summary, state.query)}</p>` : ''}`;
  const foot = `<div class="card-foot">${tags(it)}${badges(it)}</div>`;
  const cls = `card${lead ? ' lead' : ''}${state.read.has(it.id) ? ' read' : ''}`;
  const cur = it.id === state.selectedId ? ' aria-current="true"' : '';
  if (lead && img) {
    return `<article class="${cls} has-img" data-id="${it.id}"${cur} tabindex="0"><img class="lead-img" src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"><div class="card-inner">${meta}<div class="card-body">${body}</div>${foot}</div></article>`;
  }
  return `<article class="${cls}" data-id="${it.id}"${cur} tabindex="0">${meta}<div class="card-body">${body}</div>${img ? `<img class="thumb" src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${foot}</article>`;
}

const EMPTY_ICON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>';

function renderList() {
  const titles = { feed: '<span class="k">Know</span>Things', foryou: 'Watchlist', saved: 'Saved', settings: 'Settings' };
  $('#view-title').innerHTML = titles[state.view];
  $('#search-row').style.display = state.view === 'settings' ? 'none' : '';
  if (state.feed?.generated) $('#updated').textContent = `Updated ${ago(state.feed.generated)}${ago(state.feed.generated) === 'now' ? '' : ' ago'}`;

  if (state.view === 'settings') { listEl.innerHTML = settingsHTML(); $('#banner').innerHTML = ''; return; }
  if (!state.feed) { listEl.innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton"></div>').join(''); return; }

  const items = itemsFor();
  renderBanner();
  if (!items.length) {
    let msg = ['Nothing here yet', 'Try another filter or search.'];
    if (state.feed.error && !state.feed.items.length) msg = ['Feed not available', 'The first scrape may not have run yet. Pull down to retry.'];
    else if (state.view === 'saved') msg = ['No saved stories', 'Tap the bookmark on any story to keep it here.'];
    else if (state.view === 'foryou' && !state.watch.length) msg = ['Your watchlist is empty', 'Add companies, people or topics in Settings.'];
    else if (state.view === 'foryou') msg = ['No matches right now', `Nothing mentions ${state.watch.slice(0, 3).join(', ')}… in the current feed.`];
    listEl.innerHTML = `<div class="empty">${EMPTY_ICON}<h2>${esc(msg[0])}</h2><p>${esc(msg[1])}</p></div>`;
    return;
  }
  const limit = renderList.limit || 60;
  const lead = state.view === 'feed' && state.sort === 'top' && state.cat === 'all' && !state.query;
  listEl.innerHTML = items.slice(0, limit).map((it, i) => cardHTML(it, lead && i === 0)).join('') +
    (items.length > limit ? `<button class="btn" id="more" style="width:100%">Show more (${items.length - limit})</button>` : '');
}

function renderBanner() {
  const b = $('#banner');
  if (!('standalone' in navigator) || navigator.standalone || matchMedia('(display-mode: standalone)').matches || store.get('dismissInstall', false)) {
    b.innerHTML = '';
    return;
  }
  b.innerHTML = `<div class="banner"><svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7"/></svg><span>Install: tap Share, then “Add to Home Screen”.</span><button data-dismiss-install>Dismiss</button></div>`;
}

function settingsHTML() {
  const sources = [...new Set((state.feed?.items || []).map((i) => i.source))].sort((a, b) => a.localeCompare(b));
  const health = state.feed?.sources || [];
  const ok = health.filter((s) => s.ok).length;
  return `<div class="settings">
    <div class="group"><h3>Watchlist</h3><div class="box">
      ${state.watch.map((w, i) => `<div class="row"><span class="grow">${esc(w)}</span><button class="rm" data-unwatch="${i}">Remove</button></div>`).join('')}
      <form class="row" id="watch-form"><input type="text" id="watch-input" placeholder="Add a company, model, person…" enterkeyhint="done" autocomplete="off"><button class="add" type="submit">Add</button></form>
    </div><p class="hint">Stories mentioning these appear in the Watchlist tab.</p></div>

    <div class="group"><h3>Display</h3><div class="box">
      <div class="row"><span class="grow">Theme</span><span class="seg">${['auto', 'light', 'dark'].map((t) => `<button data-theme-set="${t}" aria-pressed="${state.theme === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</span></div>
      <div class="row"><span class="grow">Hide stories I’ve read</span><button class="switch" role="switch" aria-checked="${state.hideRead}" data-toggle-hideread aria-label="Hide read"></button></div>
      <div class="row"><span class="grow">Mark everything as read</span><button class="add" data-markall>Mark</button></div>
    </div></div>

    ${state.muted.size ? `<div class="group"><h3>Muted sources</h3><div class="box">${[...state.muted].map((s) => `<div class="row"><span class="grow">${esc(s)}</span><button class="add" data-unmute="${esc(s)}">Unmute</button></div>`).join('')}</div></div>` : ''}

    <div class="group"><h3>Mute a source</h3><div class="box"><div class="row"><select id="mute-select" class="grow" style="font:inherit;font-size:16px;background:transparent;color:var(--text);border:0">
      <option value="">Choose a source…</option>${sources.filter((s) => !state.muted.has(s)).map((s) => `<option>${esc(s)}</option>`).join('')}
    </select></div></div></div>

    <div class="group"><h3>Sources · ${ok}/${health.length} healthy on last run</h3><div class="box">
      ${health.map((s) => `<div class="row"><span class="status-dot" style="background:${s.ok ? 'var(--good)' : 'var(--hot)'}"></span><span class="grow">${esc(s.label)}<small>${s.ok ? `${s.count} items` : esc(s.error || 'failed')}</small></span></div>`).join('') || '<div class="row">No data yet</div>'}
    </div><p class="hint">The feed is rebuilt automatically every 30 minutes by a GitHub Action. X and Instagram run when their API keys are added as repository secrets (see README).</p></div>
  </div>`;
}

function renderDetail() {
  const it = state.selectedId && findItem(state.selectedId);
  app.classList.toggle('detail-open', !!it);
  if (!it) {
    detailEl.innerHTML = isWide() ? `<div class="detail-scroll"><div class="detail-inner">${pulseHTML()}</div></div>` : '';
    return;
  }
  const img = safeUrl(it.image);
  const url = safeUrl(it.url);
  const saved = state.saved.has(it.id);
  const related = (it.related || []).filter((r) => safeUrl(r.url));
  detailEl.innerHTML = `
    <div class="detail-bar">
      <button class="back-btn" data-close><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>Back</button>
      <span class="spacer"></span>
      <button class="icon-btn" data-share aria-label="Share"><svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7"/></svg></button>
      <button class="icon-btn" data-mute="${esc(it.source)}" aria-label="Mute source"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/></svg></button>
    </div>
    <div class="detail-scroll"><div class="detail-inner">
      ${img ? `<img class="detail-img" src="${esc(img)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
      <div class="detail-meta">${avatar(it)}<b>${esc(it.source)}</b>${it.author ? `<span class="dot"></span><span>${esc(it.author)}</span>` : ''}<span class="dot"></span><time>${new Date(it.published).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time></div>
      <h1 class="detail-title">${esc(it.title)}</h1>
      ${it.summary ? `<p class="detail-summary">${esc(it.summary)}</p>` : ''}
      <div class="detail-tags">${tags(it, 6)}${badges(it)}</div>
      <div class="actions">
        <a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Read full story</a>
        <button class="btn${saved ? ' on' : ''}" data-save aria-label="${saved ? 'Unsave' : 'Save'}"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg></button>
        ${safeUrl(it.discussion) ? `<a class="btn" href="${esc(it.discussion)}" target="_blank" rel="noopener noreferrer" aria-label="Discussion">💬</a>` : '<span></span>'}
      </div>
      ${related.length ? `<div class="related"><h3>Also covered by ${related.length} more</h3>${related.map((r) => `<a href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer"><b>${esc(r.source)}</b><span>${esc(r.title || r.url)}</span></a>`).join('')}</div>` : ''}
    </div></div>`;
}

function pulseHTML() {
  const items = state.feed?.items || [];
  if (!items.length) return `<div class="empty">${EMPTY_ICON}<h2>Select a story</h2></div>`;
  const day = items.filter((i) => Date.now() - new Date(i.published) < 864e5);
  const cats = (state.feed.categories || []).filter((c) => c.id !== 'general')
    .map((c) => ({ ...c, n: day.filter((i) => i.categories?.includes(c.id)).length }))
    .sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...cats.map((c) => c.n));
  const multi = [...items].filter((i) => (i.coverage || 1) >= 2).sort((a, b) => b.coverage - a.coverage || b.score - a.score).slice(0, 8);
  const sources = new Set(items.map((i) => i.source)).size;
  return `<div class="pulse">
    <h2>AI pulse</h2><p class="sub">Last 24 hours · updated ${ago(state.feed.generated)} ago</p>
    <div class="stat-row">
      <div class="stat"><b>${day.length}</b><span>stories today</span></div>
      <div class="stat"><b>${multi.length ? multi[0].coverage : 0}</b><span>max outlets on one story</span></div>
      <div class="stat"><b>${sources}</b><span>sources</span></div>
    </div>
    <div class="bars">${cats.map((c) => `<div class="bar" data-cat-jump="${c.id}" style="--c:${CAT_COLORS[c.id]}"><span>${esc(CAT_SHORT[c.id] || c.label)}</span><span class="track"><span class="fill" style="width:${(c.n / max) * 100}%"></span></span><span class="num">${c.n}</span></div>`).join('')}</div>
    ${multi.length ? `<div class="pulse-list"><div class="section-label" style="margin-left:0">Most covered</div>${multi.map((i, n) => `<button data-open="${i.id}"><span class="rank">${n + 1}</span><span><div class="t">${esc(i.title)}</div><div class="s">${esc(i.source)} + ${i.coverage - 1} more · ${ago(i.published)}</div></span></button>`).join('')}</div>` : ''}
  </div>`;
}

function render() {
  document.documentElement.dataset.theme = state.theme === 'auto' ? '' : state.theme;
  if (state.theme === 'auto') delete document.documentElement.dataset.theme;
  document.querySelectorAll('.nav-btn').forEach((b) => b.setAttribute('aria-current', String(b.dataset.view === state.view)));
  renderChips();
  renderList();
  renderDetail();
}

// ───────── Actions ─────────
function persist() {
  store.set('saved', [...state.saved.values()].slice(-300));
  store.set('read', [...state.read].slice(-3000));
  store.set('watch', state.watch);
  store.set('muted', [...state.muted]);
  store.set('theme', state.theme);
  store.set('hideRead', state.hideRead);
  store.set('sort', state.sort);
  store.set('view', state.view === 'settings' ? 'feed' : state.view);
}

function openItem(id) {
  state.selectedId = id;
  state.read.add(id);
  persist();
  if (!isWide()) history.pushState({ detail: id }, '');
  renderDetail();
  // Update the card in place instead of re-rendering the whole list.
  listEl.querySelectorAll('.card[aria-current]').forEach((c) => c.removeAttribute('aria-current'));
  const card = listEl.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
  if (card) { card.setAttribute('aria-current', 'true'); card.classList.add('read'); card.querySelector('.unread')?.remove(); }
  $('.detail-scroll', detailEl)?.scrollTo(0, 0);
}

function closeDetail() {
  if (!state.selectedId) return;
  state.selectedId = null;
  renderDetail();
  listEl.querySelectorAll('.card[aria-current]').forEach((c) => c.removeAttribute('aria-current'));
}

function setView(view) {
  state.view = view;
  state.cat = 'all';
  state.query = '';
  $('#search').value = '';
  renderList.limit = 60;
  persist();
  render();
  scroller.scrollTo(0, 0);
}

// ───────── Events ─────────
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button, article, [data-cat-jump]');
  if (!t) return;
  const d = t.dataset;
  if (t.matches('.card')) return openItem(d.id);
  if (d.view) return setView(d.view);
  if (d.cat) { state.cat = d.cat; renderList.limit = 60; renderChips(); renderList(); scroller.scrollTo(0, 0); return; }
  if ('sort' in d) { state.sort = state.sort === 'top' ? 'latest' : 'top'; persist(); renderChips(); renderList(); scroller.scrollTo(0, 0); return; }
  if (d.open) return openItem(d.open);
  if (d.catJump) { state.view = 'feed'; state.cat = d.catJump; render(); return; }
  if ('close' in d) { if (history.state?.detail) history.back(); else closeDetail(); return; }
  if (t.id === 'refresh') return loadFeed({ manual: true });
  if (t.id === 'more') { renderList.limit = (renderList.limit || 60) + 60; renderList(); return; }
  if ('save' in d) {
    const it = findItem(state.selectedId);
    if (!it) return;
    if (state.saved.has(it.id)) { state.saved.delete(it.id); toast('Removed from Saved'); }
    else { state.saved.set(it.id, { ...it, savedAt: Date.now() }); toast('Saved'); }
    persist(); renderDetail(); if (state.view === 'saved') renderList();
    return;
  }
  if ('share' in d) {
    const it = findItem(state.selectedId);
    if (!it) return;
    try {
      if (navigator.share) await navigator.share({ title: it.title, url: it.url });
      else { await navigator.clipboard.writeText(it.url); toast('Link copied'); }
    } catch {}
    return;
  }
  if (d.mute) { state.muted.add(d.mute); persist(); toast(`Muted ${d.mute}`); closeDetail(); history.state?.detail && history.back(); renderList(); return; }
  if (d.unmute) { state.muted.delete(d.unmute); persist(); renderList(); return; }
  if (d.unwatch != null) { state.watch.splice(Number(d.unwatch), 1); persist(); renderList(); return; }
  if (d.themeSet) { state.theme = d.themeSet; persist(); render(); return; }
  if ('toggleHideread' in d) { state.hideRead = !state.hideRead; persist(); renderList(); return; }
  if ('markall' in d) { (state.feed?.items || []).forEach((i) => state.read.add(i.id)); persist(); toast('All caught up'); return; }
  if ('dismissInstall' in d) { store.set('dismissInstall', true); renderBanner(); return; }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('.card')) openItem(e.target.dataset.id);
  if (e.key === 'Escape') closeDetail();
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'watch-form') return;
  e.preventDefault();
  const v = $('#watch-input').value.trim();
  if (v && !state.watch.some((w) => w.toLowerCase() === v.toLowerCase())) { state.watch.push(v); persist(); }
  renderList();
  $('#watch-input')?.focus();
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'mute-select' && e.target.value) { state.muted.add(e.target.value); persist(); renderList(); }
});

let searchTimer;
$('#search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.query = e.target.value; renderList.limit = 60; renderList(); }, 120);
});

window.addEventListener('popstate', () => { if (state.selectedId && !isWide()) closeDetail(); });

scroller.addEventListener('scroll', () => $('#topbar').classList.toggle('scrolled', scroller.scrollTop > 4), { passive: true });

// Pull-to-refresh (home-screen apps have no browser reload button).
(() => {
  const ptr = $('#ptr');
  let startY = null, dy = 0;
  scroller.addEventListener('touchstart', (e) => { startY = scroller.scrollTop <= 0 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  scroller.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    dy = e.touches[0].clientY - startY;
    if (dy <= 0) { ptr.style.height = '0px'; return; }
    ptr.style.transition = 'none';
    ptr.style.height = `${Math.min(70, dy * 0.45)}px`;
    ptr.classList.toggle('ready', dy * 0.45 > 56);
  }, { passive: true });
  scroller.addEventListener('touchend', () => {
    ptr.style.transition = '';
    ptr.style.height = '0px';
    if (startY != null && dy * 0.45 > 56) loadFeed({ manual: true });
    ptr.classList.remove('ready');
    startY = null;
  });
})();

// Swipe right from the left edge to close the reader on phones.
(() => {
  let sx = null, sy = 0;
  detailEl.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX < 30 && !isWide() ? t.clientX : null; sy = t.clientY; }, { passive: true });
  detailEl.addEventListener('touchmove', (e) => {
    if (sx == null) return;
    const dx = e.touches[0].clientX - sx;
    if (Math.abs(e.touches[0].clientY - sy) > 40) { sx = null; detailEl.style.transform = ''; return; }
    detailEl.style.transition = 'none';
    detailEl.style.transform = `translateX(${Math.max(0, dx)}px)`;
  }, { passive: true });
  detailEl.addEventListener('touchend', (e) => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx;
    detailEl.style.transition = '';
    detailEl.style.transform = '';
    if (dx > 90) { if (history.state?.detail) history.back(); else closeDetail(); }
    sx = null;
  });
})();

// Re-render the detail pane when the layout changes (fold/unfold, rotate).
let lastWide = isWide();
const onResize = () => {
  const w = isWide();
  if (w !== lastWide) { lastWide = w; renderDetail(); }
};
window.addEventListener('resize', onResize);
matchMedia('(orientation: landscape)').addEventListener?.('change', onResize);

// Refresh when coming back to the app after a while.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const age = state.feed?.generated ? Date.now() - new Date(state.feed.generated) : Infinity;
    if (age > 20 * 60e3) loadFeed();
    else renderList();
  } else {
    store.set('lastVisit', Date.now());
  }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

render();
loadFeed();
setInterval(() => { if (document.visibilityState === 'visible') loadFeed(); }, 15 * 60e3);
