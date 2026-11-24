# KnowThings: AI news radar

KnowThings collects AI news from across the web and shows it in one ranked feed. It covers frontier models and labs, chips and compute, robotics, policy and safety, funding, research papers, open-source tools and **military / defense AI**. It is a web app you add to your iPhone Home Screen, where it opens full screen like a native app.

## How it works

```
GitHub Action (every 30 min)            GitHub Pages (free hosting)
┌───────────────────────────┐          ┌──────────────────────────┐
│ scraper/  → collects ~70  │  deploy  │ app/  → the iPhone app   │
│ sources, filters for AI,  │ ───────▶ │ reads data/feed.json,    │
│ de-dupes, clusters, ranks │          │ works offline            │
└───────────────────────────┘          └──────────────────────────┘
```

There is no server to run and nothing to pay for. GitHub rebuilds the feed every 30 minutes, and the app picks up the new version when you open it or pull down to refresh.

### Sources

| Where | How | Key needed? |
|---|---|---|
| **Google** | Google News search feeds for 11 AI topic searches (models, military AI, chips, robotics, regulation, funding, agents…) | No |
| AI labs | OpenAI, Google DeepMind, Google AI and Research, Microsoft, NVIDIA, Hugging Face, Apple ML, AWS, BAIR | No |
| Tech press | TechCrunch, The Verge, MIT Tech Review, Ars Technica, Wired, VentureBeat, IEEE Spectrum, The Register, Import AI… | No |
| **Defense** | DefenseScoop, Breaking Defense, Defense One, C4ISRNET, War on the Rocks | No |
| Community | Hacker News, Reddit (r/MachineLearning, r/LocalLLaMA, r/artificial, r/singularity…) | No |
| Research | Hugging Face Daily Papers, arXiv (cs.AI, cs.LG, cs.CL, cs.CV, cs.RO) | No |
| Open source | New fast-rising GitHub repos (LLM, agents, generative AI, MCP) | No (uses the built-in Actions token) |
| Video | YouTube channels (Two Minute Papers, AI Explained) | No |
| **Bluesky** | Top posts for AI searches | Optional (see below) |
| **X / Twitter** | Recent popular posts for AI searches | **Yes**, X API |
| **Instagram** | Top posts for AI hashtags | **Yes**, Meta Graph API |

> **Why X and Instagram need keys:** both platforms block unauthenticated scraping and forbid it in their terms. Scrapers that bypass that break every few weeks and can get accounts banned. KnowThings uses their official APIs. The X API's search endpoint requires a paid tier. Without keys, everything else still works.

### Ranking

1. **Relevance filter:** items from general-purpose feeds (e.g. Breaking Defense, Hacker News) are kept only if they mention AI.
2. **Categories:** each story is tagged *Models, Military, Chips, Robotics, Policy, Business, Research, Tools*.
3. **Clustering:** when several outlets cover the same story, they merge into one card ("5 sources"), and the other outlets are listed under it.
4. **Score:** recency × source weight × number of outlets covering it, plus engagement (HN points, likes, GitHub stars).

To add or change sources, searches, keywords or categories, edit **`scraper/sources.js`**. No other code needs to change.

## One-time setup (about 5 minutes)

1. **Merge this branch into `main`.**
2. **Turn on Pages:** go to the repo's **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
   *GitHub Pages is free for public repos. For a private repo it needs GitHub Pro.*
3. **Run it once:** **Actions → "Update feed & deploy app" → Run workflow.** After that it runs on its own every 30 minutes.
4. Your app is at **`https://tcowenby.github.io/KnowThings/`**.

### Add it to your iPhone Home Screen

1. Open the URL above in **Safari**.
2. Tap **Share** (the square with the arrow) → **Add to Home Screen** → **Add**.
3. Launch it from the Home Screen icon. It opens full screen, without Safari's address bar.

### Optional API keys

Add these under **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | What it turns on |
|---|---|
| `X_BEARER_TOKEN` | X recent search ([developer.x.com](https://developer.x.com), needs a tier that includes search) |
| `IG_USER_ID`, `IG_ACCESS_TOKEN` | Instagram hashtag search. Needs an Instagram Business/Creator account linked to a Meta app with `instagram_basic` permission |
| `BSKY_HANDLE`, `BSKY_APP_PASSWORD` | Signed-in Bluesky search, which is more reliable than the public endpoint. Use an [app password](https://bsky.app/settings/app-passwords), not your real password |

## The app

- **Feed:** ranked "Top" or chronological "Latest", with category chips (Last 6h, Models, Military, Chips, Robotics, Policy, Business, Research, Tools, Social, Video) and search.
- **Watchlist:** add companies, models or people (Anthropic, Anduril, "GPT-6"…). Matching stories get their own tab, with the matches highlighted.
- **Saved:** bookmark stories. They stay saved after they drop out of the feed.
- **Reader:** summary, image, all outlets covering the story, links to the HN discussion, share sheet, and a button to mute that source.
- **AI pulse:** on wide screens, when no story is open, shows today's story counts by category and the stories covered by the most outlets.
- Unread dots, hide-read, pull-to-refresh, works offline, and light, dark or auto theme.

### Layouts: folded, unfolded and every orientation

| Screen | Layout |
|---|---|
| Phone / fold **closed**, portrait | One column with a bottom tab bar. The reader slides in full screen; swipe from the left edge to go back. |
| Phone landscape (short screen) | Side rail instead of the tab bar, and two columns of cards |
| Fold **open** (portrait or landscape), iPad, desktop | Three panes: rail, story list, reader (or the AI pulse view) |
| Foldables that report a hinge (Viewport Segments API) | Story list on one screen half and the reader on the other, laid out around the hinge, for both side-by-side and top/bottom folds |

The layout uses the iPhone's safe areas (notch, Dynamic Island, home indicator, rounded corners), dynamic viewport height, and 16px inputs so iOS doesn't zoom in when you tap a field. It switches layout immediately when you rotate, fold or unfold the phone.

## Local development

```bash
npm install
npm run scrape   # builds app/data/feed.json from live sources
npm run serve    # http://localhost:8080
npm test
npm run icons    # regenerate icons (needs Python + Pillow)
```

## Notes

- Feed history: each run merges with the previous deployed feed and keeps 7 days (`KEEP_DAYS`), up to 900 stories (`MAX_ITEMS`).
- GitHub pauses scheduled workflows in repos with no commits for 60 days. If the feed stops updating, re-enable the workflow under the Actions tab.
- A source failing (rate limit, site change) never breaks the run. **Settings → Sources** in the app shows the health of each source on the last run.
