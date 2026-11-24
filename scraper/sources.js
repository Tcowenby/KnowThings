// ─────────────────────────────────────────────────────────────────────────────
// KnowThings source + topic configuration.
// Edit this file to add feeds, searches or keywords. No other code changes needed.
// ─────────────────────────────────────────────────────────────────────────────

// Google News searches. Each becomes an RSS query (no API key needed).
// This is how "Google" is covered: Google News indexes thousands of outlets.
export const GOOGLE_NEWS_QUERIES = [
  'artificial intelligence',
  '"generative AI" OR "large language model"',
  'OpenAI OR Anthropic OR "Google DeepMind" OR "Meta AI" OR xAI OR Mistral',
  '"military AI" OR "AI weapons" OR "autonomous weapons" OR "AI drone"',
  'Pentagon AI OR "Department of Defense" AI OR CDAO OR DARPA AI',
  'Nvidia AI chip OR "AI accelerator" OR "AI data center"',
  'humanoid robot OR "AI robotics" OR "embodied AI"',
  'AI regulation OR "AI Act" OR "AI executive order" OR "AI safety institute"',
  'AI startup raises OR "AI funding round" OR "AI acquisition"',
  '"AI agent" OR "agentic AI"',
  'AI breakthrough OR "new AI model" OR "AI benchmark"',
];

// RSS / Atom feeds. `weight` nudges ranking (1 = normal). `filter: true` means the
// feed is general-purpose, so only AI-relevant items are kept.
export const FEEDS = [
  // Labs & companies
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', kind: 'lab', weight: 1.6 },
  { name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml', kind: 'lab', weight: 1.6 },
  { name: 'Google AI', url: 'https://blog.google/technology/ai/rss/', kind: 'lab', weight: 1.4 },
  { name: 'Google Research', url: 'https://research.google/blog/rss/', kind: 'lab', weight: 1.3 },
  { name: 'Microsoft AI', url: 'https://blogs.microsoft.com/ai/feed/', kind: 'lab', weight: 1.3 },
  { name: 'NVIDIA', url: 'https://blogs.nvidia.com/feed/', kind: 'lab', weight: 1.2, filter: true },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', kind: 'lab', weight: 1.3 },
  { name: 'AWS ML', url: 'https://aws.amazon.com/blogs/machine-learning/feed/', kind: 'lab', weight: 1.0 },
  { name: 'Apple ML', url: 'https://machinelearning.apple.com/rss.xml', kind: 'lab', weight: 1.3 },
  { name: 'BAIR', url: 'https://bair.berkeley.edu/blog/feed.xml', kind: 'lab', weight: 1.1 },

  // Tech press
  { name: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', kind: 'news', weight: 1.2 },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', kind: 'news', weight: 1.2 },
  { name: 'VentureBeat', url: 'https://venturebeat.com/category/ai/feed/', kind: 'news', weight: 1.1 },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', kind: 'news', weight: 1.3 },
  { name: 'Ars Technica', url: 'https://arstechnica.com/ai/feed/', kind: 'news', weight: 1.2 },
  { name: 'Wired', url: 'https://www.wired.com/feed/tag/ai/latest/rss', kind: 'news', weight: 1.1 },
  { name: 'IEEE Spectrum', url: 'https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss', kind: 'news', weight: 1.2 },
  { name: 'The Register', url: 'https://www.theregister.com/software/ai_ml/headlines.atom', kind: 'news', weight: 1.0 },
  { name: 'SiliconANGLE', url: 'https://siliconangle.com/category/ai/feed/', kind: 'news', weight: 0.9 },
  { name: 'Import AI', url: 'https://importai.substack.com/feed', kind: 'news', weight: 1.3 },
  { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', kind: 'news', weight: 1.1, filter: true },

  // Defense & national security
  { name: 'DefenseScoop', url: 'https://defensescoop.com/category/artificial-intelligence/feed/', kind: 'defense', weight: 1.4 },
  { name: 'Breaking Defense', url: 'https://breakingdefense.com/feed/', kind: 'defense', weight: 1.2, filter: true },
  { name: 'Defense One', url: 'https://www.defenseone.com/rss/technology/', kind: 'defense', weight: 1.2, filter: true },
  { name: 'C4ISRNET', url: 'https://www.c4isrnet.com/arc/outboundfeeds/rss/category/artificial-intelligence/?outputType=xml', kind: 'defense', weight: 1.2 },
  { name: 'War on the Rocks', url: 'https://warontherocks.com/feed/', kind: 'defense', weight: 1.1, filter: true },

  // Video
  { name: 'Two Minute Papers', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg', kind: 'video', weight: 1.0 },
  { name: 'AI Explained', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCNJ1Ymd5yFuUPtn21xtRbbw', kind: 'video', weight: 1.0 },
];

// Reddit communities (public RSS, no key).
export const SUBREDDITS = ['MachineLearning', 'artificial', 'LocalLLaMA', 'singularity', 'OpenAI', 'ClaudeAI', 'robotics'];

// arXiv categories for research papers.
export const ARXIV_CATEGORIES = ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV', 'cs.RO'];

// Social searches (Bluesky public API, Hacker News, and X when a token is set).
export const SOCIAL_QUERIES = ['AI model', 'LLM', 'military AI', 'AI agents', 'GPU cluster'];

// X (Twitter) recent search. Only runs if the X_BEARER_TOKEN secret is set.
export const X_QUERY =
  '(("AI model" OR LLM OR "AI agent" OR "military AI" OR OpenAI OR Anthropic OR DeepMind OR Nvidia) lang:en -is:retweet -is:reply min_faves:200)';

// Instagram hashtags. Only runs if IG_USER_ID + IG_ACCESS_TOKEN secrets are set.
export const INSTAGRAM_HASHTAGS = ['artificialintelligence', 'machinelearning', 'generativeai'];

// ─────────────────────────────────────────────────────────────────────────────
// Relevance: an item from a `filter: true` feed (or social/HN) must match one of these.
// ─────────────────────────────────────────────────────────────────────────────
export const AI_PATTERNS = [
  /\bA\.?I\.?\b/, // case-sensitive "AI" / "A.I." — avoids matching "said", "aid"
  /\bartificial intelligence\b/i,
  /\bmachine learning\b/i,
  /\bdeep learning\b/i,
  /\bneural (net|network)s?\b/i,
  /\bLLMs?\b/,
  /\blarge language models?\b/i,
  /\bgenerative\b/i,
  /\b(gpt|chatgpt|claude|gemini|llama|mistral|grok|copilot|deepseek|qwen)\b/i,
  /\b(openai|anthropic|deepmind|hugging ?face|xai|perplexity)\b/i,
  /\b(transformer|diffusion model|foundation model|frontier model|multimodal)\b/i,
  /\b(agentic|ai agents?|autonomous (system|weapon|drone|vehicle)s?)\b/i,
  /\b(gpu|tpu|npu|accelerator|h100|h200|b200|gb200|blackwell|rubin)\b/i,
  /\b(robot|robotics|humanoid)s?\b/i,
  /\b(computer vision|reinforcement learning|inference|fine-?tun)/i,
];

// Categories. An item can belong to several; the first match is its primary category.
export const CATEGORIES = [
  {
    id: 'models',
    label: 'Models & Labs',
    patterns: [
      /\b(gpt-?\d|o\d|chatgpt|claude|gemini|llama|mistral|grok|deepseek|qwen|phi-?\d)\b/i,
      /\b(openai|anthropic|deepmind|meta ai|xai|mistral|cohere|ai21|perplexity)\b/i,
      /\b(new model|model release|frontier model|foundation model|llm|reasoning model|open-?weights?)\b/i,
      /\b(benchmark|leaderboard|context window|multimodal)\b/i,
    ],
  },
  {
    id: 'defense',
    label: 'Military & Defense',
    patterns: [
      /\b(military|defen[cs]e|pentagon|dod|army|navy|air force|marines|space force|nato)\b/i,
      /\b(weapon|warfare|battlefield|drone|uav|munition|missile|targeting|isr|c2|jadc2)\b/i,
      /\b(darpa|cdao|anduril|palantir|shield ai|helsing|scale ai|national security|intelligence community)\b/i,
    ],
  },
  {
    id: 'hardware',
    label: 'Chips & Compute',
    patterns: [
      /\b(nvidia|amd|intel|tsmc|cerebras|groq|sambanova|broadcom|arm)\b/i,
      /\b(gpu|tpu|npu|asic|chip|semiconductor|accelerator|h100|h200|b200|gb200|blackwell|rubin|hbm)\b/i,
      /\b(data ?cent(er|re)|supercomputer|compute cluster|gigawatt|power grid)\b/i,
    ],
  },
  {
    id: 'robotics',
    label: 'Robotics',
    patterns: [/\b(robot|robotics|humanoid|embodied|self-driving|autonomous vehicle|waymo|optimus|figure ai)\b/i],
  },
  {
    id: 'policy',
    label: 'Policy & Safety',
    patterns: [
      /\b(regulat|legislat|congress|senate|white house|executive order|ai act|eu |ftc|lawsuit|court|copyright)\w*/i,
      /\b(ai safety|alignment|misuse|deepfake|election|ban|governance|safety institute)\b/i,
    ],
  },
  {
    id: 'business',
    label: 'Business & Funding',
    patterns: [
      /\b(raises|funding|series [a-f]|valuation|ipo|acquir|acquisition|merger|revenue|earnings|investment|invests?)\w*/i,
      /\$\d+(\.\d+)?\s?(m|b|bn|million|billion)\b/i,
    ],
  },
  {
    id: 'research',
    label: 'Research',
    patterns: [/\b(paper|arxiv|study|researchers?|preprint|dataset|novel method|we propose)\b/i],
  },
  {
    id: 'tools',
    label: 'Open Source & Tools',
    patterns: [/\b(open[- ]source|github|repo|library|framework|sdk|api|plugin|release[sd]?|v\d+\.\d+)\b/i],
  },
];
