// "Ask the stars": shared by the browser (offline fallback) and functions/api/ask.js.
// Every answer must come from the corpus built out of profile.yaml; nothing else is known.

const CASE = (id) => (id.startsWith('milansathi') ? '/work/milansathi/' : `/work/#${id}`);

// Flattens profile.yaml into citable entries: {id, title, text, keys?, href}.
export function buildCorpus(profile) {
  const p = profile.person, edu = profile.education;
  const out = profile.facts.map((f) => ({
    id: f.id,
    title: f.title,
    text: f.text + (f.metrics?.length ? ` Results: ${f.metrics.join('; ')}.` : ''),
    keys: [f.plain, ...(f.tags ?? []), ...f.kind].filter(Boolean).join(' '),
    href: CASE(f.id),
  }));
  out.push(
    {
      id: 'contact', title: 'Contact and location', href: `mailto:${p.email}`,
      text: `${p.name}, ${p.headline}. Based in ${p.location}, open to relocating to ${p.relocation}. Email ${p.email}. LinkedIn ${p.links.linkedin}. GitHub ${p.links.github}.`,
    },
    {
      id: 'education', title: 'Education', href: '/about/#education',
      text: `${edu.degree}, ${edu.school}, ${edu.years}, CGPA ${edu.cgpa}. ${edu.oneliner} ${edu.highlights.map(([n, t]) => `${n} ${t}`).join('. ')}.`,
    },
    {
      id: 'experience', title: 'Experience', href: '/about/#experience',
      text: profile.roles.map((r) => `${r.title}, ${r.org}, ${r.dates}: ${r.oneliner}`).join(' '),
    },
    {
      id: 'skills', title: 'Skills', href: '/about/#skills',
      text: Object.entries(profile.skills).map(([k, v]) => `${k}: ${v.join(', ')}`).join('. '),
    },
    {
      id: 'how-i-work', title: 'How I work', href: '/about/#how',
      text: profile.principles.map((r) => `${r.title}: ${r.text}`).join(' '),
    },
    {
      id: 'path', title: 'My path', href: '/about/#path',
      text: profile.path.map((s) => `${s.when}: ${s.what}`).join('. '),
    },
    {
      id: 'services', title: 'What I can do', href: '/#can',
      text: profile.capabilities.map((c) => `${c.title}: ${c.promise}`).join(' '),
    },
  );
  return out;
}

const STOP = new Set('a an the is are was were be been to of in on for and or with at by from as it its this that what which who whom how does do did has have had can could would should will his he him you your i me my about tell any some there their they them than then so if just more most much'.split(' '));
const ALIAS = {
  ai: ['llm', 'llms', 'genai', 'gpt', 'gemini', 'rag', 'agents'], llm: ['ai', 'genai', 'gpt', 'gemini'],
  money: ['saved', 'cost', 'saving'], save: ['saved', 'cost'], saved: ['cost', 'saving'], cost: ['saved', 'saving'],
  college: ['education', 'nit', 'patna', 'cgpa'], degree: ['education', 'b.tech'], study: ['education', 'nit'],
  job: ['experience', 'engineer', 'info', 'edge'], work: ['experience', 'built'], company: ['info', 'edge', 'jeevansathi'],
  contact: ['email', 'linkedin'], reach: ['email', 'contact'], hire: ['contact', 'email', 'relocating'],
  location: ['based', 'noida', 'relocating'], live: ['based', 'noida'], relocate: ['relocating', 'bangalore'],
  astrology: ['milansathi', 'kundli'], kundli: ['milansathi', 'astrology'], leetcode: ['competitive', 'knight', 'rating'],
  dsa: ['leetcode', 'problems', 'competitive'], stack: ['skills'], tech: ['skills'], languages: ['skills', 'java', 'python'],
  kafka: ['event-driven'], scale: ['requests', 'kafka', 'users'],
};

export const words = (s) => (s.toLowerCase().match(/[a-z0-9$][a-z0-9.+#$-]*/g) ?? []).map((w) => w.replace(/[.,-]+$/, ''));

// Keyword retrieval with a few aliases; titles count double.
export function retrieve(q, corpus, k = 3) {
  const terms = new Set();
  for (const w of words(q)) {
    if (STOP.has(w) || w.length < 2) continue;
    terms.add(w);
    (ALIAS[w] ?? []).forEach((a) => terms.add(a));
  }
  if (!terms.size) return [];
  return corpus
    .map((e) => {
      const body = words(`${e.text} ${e.keys ?? ''}`), title = words(e.title);
      let s = 0;
      for (const t of terms) {
        if (title.includes(t)) s += 2;
        if (body.some((w) => w === t || (t.length > 3 && w.startsWith(t)))) s += 1;
      }
      return [s, e];
    })
    .filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0])
    .slice(0, k)
    .map(([, e]) => e);
}

// Numbers the answer may use: only those that appear in the corpus or the question.
const nums = (s) => (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ''));
export function numbersOk(answer, corpusText, question = '') {
  const known = new Set([...nums(corpusText), ...nums(question)]);
  return nums(answer).every((n) => known.has(n) || (n.length === 1 && +n <= 9));
}

export const UNKNOWN = "The stars are quiet on that one. It isn't covered by anything on this site, so I'd rather not guess. Email me and I'll answer it myself.";

// Offline answer: the best-matching facts, quoted as they are.
export function localAnswer(q, corpus) {
  const hits = retrieve(q, corpus, 2);
  if (!hits.length) return { answer: UNKNOWN, sources: [{ id: 'contact', title: 'Email me', href: corpus.find((e) => e.id === 'contact')?.href }] };
  const first = hits[0];
  const sentences = first.text.split(/(?<=\.)\s+/).slice(0, 3).join(' ');
  return { answer: sentences, sources: hits.map(({ id, title, href }) => ({ id, title, href })) };
}
