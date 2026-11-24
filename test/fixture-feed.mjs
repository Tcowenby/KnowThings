// Builds a placeholder feed for local UI testing only (clearly fake data; never deployed).
import fs from 'node:fs';
import { normalize, cluster, score } from '../scraper/rank.js';
const now = Date.now();
const src = [['TechCrunch','rss'],['The Verge','rss'],['DefenseScoop','rss'],['Hacker News','hn'],['r/LocalLLaMA','reddit'],['Bluesky','bluesky'],['HF Papers','papers'],['GitHub','github'],['Two Minute Papers','youtube'],['Reuters','google']];
const titles = [
  'Sample: Lab releases new open-weights reasoning model with long context',
  'Sample: Lab releases new open-weights reasoning model, long context',
  'Sample: Army pilots autonomous drone targeting system in field exercise',
  'Sample: Chipmaker unveils next-gen GPU for AI data centers',
  'Sample: Humanoid robot startup raises $400M Series C',
  'Sample: Senate committee advances AI safety bill',
  'Sample paper: Scaling laws for agentic tool use in LLMs',
  'Sample repo: lightweight MCP server framework for AI agents',
  'Sample video: This new diffusion model edits video in real time',
  'Sample: Pentagon CDAO expands AI program for logistics',
  'Sample: Open-source LLM inference engine hits 2x throughput',
  'Sample: EU publishes guidance for general-purpose AI models',
];
const raw = titles.map((t, i) => ({ title: t, url: `https://example.com/story-${i}`, source: src[i % src.length][0], origin: src[i % src.length][1], published: new Date(now - i * 47 * 60e3).toISOString(), summary: 'Placeholder summary text for layout testing. This is not a real story; it exists so the interface can be previewed offline.', image: i % 3 === 0 ? 'icons/icon-512.png' : '', engagement: i % 2 ? { points: 120 * i, comments: 14 * i } : undefined, weight: 1 }));
const items = cluster(raw.map((r) => normalize(r, now)).filter(Boolean)).map((it) => ({ ...it, score: score(it, now) })).sort((a, b) => b.score - a.score);
const feed = { generated: new Date(now - 5 * 60e3).toISOString(), categories: [{id:'models',label:'Models & Labs'},{id:'defense',label:'Military & Defense'},{id:'hardware',label:'Chips & Compute'},{id:'robotics',label:'Robotics'},{id:'policy',label:'Policy & Safety'},{id:'business',label:'Business & Funding'},{id:'research',label:'Research'},{id:'tools',label:'Open Source & Tools'},{id:'general',label:'General'}], sources: [{label:'TechCrunch',ok:true,count:20},{label:'r/LocalLLaMA',ok:false,error:'HTTP 403'}], items };
fs.writeFileSync(process.argv[2], JSON.stringify(feed));
