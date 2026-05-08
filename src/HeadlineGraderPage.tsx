import { useState, useEffect } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from './useToolApi.js';
import { ToolHero, ScoreCard, SectionBreakdown, CompareLayout, Rewrites, CrossPromo, track } from '@bilkobibitkov/host-kit';

const HEADLINE_GRADER_THEME = {
  heroGradient: 'from-[#1a1530] via-[#0f0d1a] to-[#1a1530]',
  glowColor: 'rgba(99,102,241,0.14)',
  accentText: 'text-indigo-400',
  accentTextLight: 'text-indigo-500',
};

const CROSS_PROMO_ITEMS = [
  {
    name: 'PageRoast',
    href: 'https://bilko.run/products/page-roast',
    hook: 'Great headline. Now roast the page it lives on.',
  },
  {
    name: 'ThreadGrader',
    href: 'https://bilko.run/products/thread-grader',
    hook: 'Headlines are hooks. Test yours in a full thread.',
  },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface FrameworkScore { score: number; max: number; feedback: string; }

interface GradeResult {
  total_score: number;
  grade: string;
  framework_scores: {
    rule_of_one: FrameworkScore;
    value_equation: FrameworkScore;
    readability: FrameworkScore;
    proof_promise_plan: FrameworkScore;
  };
  diagnosis: string;
  rewrites?: Array<{ text: string; predicted_score: number; optimized_for: string; technique: string }>;
}

interface CompareResponse {
  headlineA: GradeResult;
  headlineB: GradeResult;
  comparison: { winner: 'A' | 'B' | 'tie'; margin: number; verdict: string; analysis?: string };
}

interface HistoryEntry { headline: string; score: number; grade: string; date: string; }
const HISTORY_KEY = 'bilko_headline_history';
function loadHistory(): HistoryEntry[] { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } }
function saveToHistory(entry: HistoryEntry) {
  const h = loadHistory().filter(e => e.headline !== entry.headline);
  h.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 10)));
}

const PILLAR_LABELS: Record<string, string> = {
  rule_of_one: 'Rule of One',
  value_equation: 'Value Equation',
  readability: 'Readability',
  proof_promise_plan: 'Proof + Promise + Plan',
};

const CONTEXT_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'email', label: 'Email Subject' },
  { value: 'ad', label: 'Ad Copy' },
  { value: 'landing', label: 'Landing Page' },
  { value: 'blog', label: 'Blog Post' },
  { value: 'social', label: 'Social Post' },
];

function analyzeHeadline(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const powerWords = ['free', 'new', 'proven', 'secret', 'instant', 'guaranteed', 'discover', 'exclusive', 'limited', 'ultimate', 'best', 'easy', 'fast', 'now', 'today', 'save', 'boost', 'hack', 'master', 'unlock'];
  const emotionalWords = ['love', 'hate', 'fear', 'amazing', 'shocking', 'incredible', 'terrible', 'brilliant', 'dangerous', 'stunning', 'obsessed', 'devastating', 'thrilling', 'heartbreaking', 'jaw-dropping'];
  const powerCount = words.filter(w => powerWords.includes(w.toLowerCase())).length;
  const emotionalCount = words.filter(w => emotionalWords.includes(w.toLowerCase())).length;
  const readingTimeSec = Math.max(0.5, words.length * 0.3);
  const type = text.endsWith('?') ? 'Question' : text.match(/^\d|how to|ways to|steps to|tips/i) ? 'List/How-to' : text.match(/^why|^what|^when/i) ? 'Question' : 'Statement';
  return { wordCount: words.length, powerCount, emotionalCount, readingTimeSec, type };
}

// ── Tutorial sub-components ──────────────────────────────────────────────────

function CopyPrompt({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={onCopy}
      className="group w-full text-left bg-white hover:bg-fire-50 border border-warm-200/60 hover:border-fire-300 rounded-xl px-4 py-3 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {label && <p className="text-[10px] font-bold uppercase tracking-widest text-fire-500 mb-1">{label}</p>}
          <p className="text-sm text-warm-800 leading-snug">{text}</p>
        </div>
        <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded ${copied ? 'bg-green-100 text-green-700' : 'bg-warm-100 text-warm-600 group-hover:bg-fire-100 group-hover:text-fire-700'}`}>
          {copied ? 'Copied!' : 'Copy'}
        </span>
      </div>
    </button>
  );
}

function DetailsRow({ q, a }: { q: string; a: string }) {
  return (
    <details className="group bg-white rounded-xl border border-warm-200/60 hover:border-fire-300 transition-colors">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-5 py-4">
        <span className="font-bold text-warm-900 text-sm md:text-base">{q}</span>
        <svg className="w-4 h-4 flex-shrink-0 text-warm-400 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </summary>
      <p className="px-5 pb-4 text-sm text-warm-600 leading-relaxed">{a}</p>
    </details>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function HeadlineGraderPage() {
  const {
    result, compareResult, generateResult, generating, genError,
    loading, error, needsTokens,
    email, isSignedIn, submit, submitCompare, submitGenerate, reset, signInRef, SignInButton: ClerkSignIn,
  } = useToolApi<GradeResult>('headline-grader');

  const [tab, setTab] = useState<'score' | 'compare' | 'generate'>('score');
  const [headline, setHeadline] = useState('');
  const [headlineA, setHeadlineA] = useState('');
  const [headlineB, setHeadlineB] = useState('');
  const [context, setContext] = useState('general');
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [description, setDescription] = useState('');

  useEffect(() => { document.title = 'Headline Grader — bilko.run'; track('view_tool', { tool: 'headline-grader' }); }, []);

  // Auto-save scored headlines
  useEffect(() => {
    if (result && headline) {
      const entry = { headline, score: result.total_score, grade: result.grade, date: new Date().toISOString() };
      saveToHistory(entry);
      setHistory(loadHistory());
    }
  }, [result]);

  function handleTabChange(next: 'score' | 'compare' | 'generate') {
    setTab(next);
    reset();
  }

  function handleScore(e: React.FormEvent) {
    e.preventDefault();
    if (!headline.trim()) return;
    submit({ headline: headline.trim(), context });
  }

  function handleCompare(e: React.FormEvent) {
    e.preventDefault();
    if (!headlineA.trim() || !headlineB.trim()) return;
    submitCompare({ headlineA: headlineA.trim(), headlineB: headlineB.trim() });
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    submitGenerate({ description: description.trim(), context, count: 5 });
  }

  const compare = compareResult as CompareResponse | null;
  const charLen = tab === 'score' ? headline.length : 0;

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Hidden sign-in trigger */}
      <div className="hidden">
        <SignInButton mode="modal">
          <button ref={signInRef} />
        </SignInButton>
      </div>

      {/* ── Hero + Input ─────────────────────────────────────────────── */}
      <ToolHero
        theme={HEADLINE_GRADER_THEME}
        title="Score or generate headlines"
        tagline="AI grades your headlines — or writes new ones from your description"
      >
        {/* 3-way tab toggle */}
        <div className="flex gap-1 bg-white/10 backdrop-blur-sm rounded-xl p-1 mb-5 w-fit mx-auto">
          {(['score', 'compare', 'generate'] as const).map(t => (
            <button key={t} onClick={() => handleTabChange(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                tab === t ? 'bg-white text-warm-900 shadow-sm' : 'text-warm-400 hover:text-white'
              }`}>
              {t === 'generate' ? '\u2728 Generate' : t === 'compare' ? 'A/B Compare' : 'Score'}
            </button>
          ))}
        </div>

        {tab === 'score' ? (
          <form onSubmit={handleScore} className="max-w-xl mx-auto text-left space-y-4">
            <div>
              <textarea
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Paste your headline here..."
                rows={2}
                className="w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-warm-500 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-fire-500/50 resize-none"
              />
              <p className={`text-xs mt-1 text-right ${charLen > 60 ? 'text-red-400' : 'text-warm-500'}`}>
                {charLen}/60 chars
              </p>
              {headline.trim() && (() => {
                const { wordCount, powerCount, emotionalCount, readingTimeSec, type } = analyzeHeadline(headline);
                return (
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-warm-400">{wordCount} words</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-warm-400">{readingTimeSec.toFixed(1)}s read</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${powerCount >= 1 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                      {powerCount} power {powerCount >= 1 ? '\u2713' : '\u2014 add 1+'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${emotionalCount >= 1 ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                      {emotionalCount} emotional {emotionalCount >= 1 ? '\u2713' : '\u2014 aim for 10-15%'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-warm-400">{type}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${wordCount >= 6 && wordCount <= 12 ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                      {wordCount >= 6 && wordCount <= 12 ? 'Good length' : wordCount < 6 ? 'Too short' : 'Consider trimming'}
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="flex flex-wrap gap-1 mb-3">
              {CONTEXT_OPTIONS.map(o => (
                <button key={o.value} type="button" onClick={() => setContext(o.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    context === o.value ? 'bg-white text-warm-900 shadow-sm' : 'bg-white/10 text-warm-400 hover:text-white'
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading || !headline.trim()}
                className="flex-1 bg-fire-500 hover:bg-fire-600 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm"
              >
                {loading ? 'Scoring...' : 'Score Headline'}
              </button>
            </div>
          </form>
        ) : tab === 'compare' ? (
          <form onSubmit={handleCompare} className="max-w-xl mx-auto text-left space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1 block">Headline A</label>
              <textarea
                value={headlineA}
                onChange={(e) => setHeadlineA(e.target.value)}
                placeholder="First headline..."
                rows={2}
                className="w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-warm-500 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-fire-500/50 resize-none"
              />
              <p className={`text-xs mt-1 text-right ${headlineA.length > 60 ? 'text-red-400' : 'text-warm-500'}`}>
                {headlineA.length}/60 chars
              </p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1 block">Headline B</label>
              <textarea
                value={headlineB}
                onChange={(e) => setHeadlineB(e.target.value)}
                placeholder="Second headline..."
                rows={2}
                className="w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-warm-500 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-fire-500/50 resize-none"
              />
              <p className={`text-xs mt-1 text-right ${headlineB.length > 60 ? 'text-red-400' : 'text-warm-500'}`}>
                {headlineB.length}/60 chars
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !headlineA.trim() || !headlineB.trim()}
              className="w-full bg-fire-500 hover:bg-fire-600 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm"
            >
              {loading ? 'Comparing...' : 'Compare Headlines'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleGenerate} className="max-w-xl mx-auto text-left space-y-4">
            <div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe your product, service, or page... e.g. 'AI tool that scores landing pages and gives conversion feedback in 30 seconds'"
                rows={4}
                className="w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-warm-500 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-fire-500/50 resize-none"
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleGenerate(e as any); } }}
              />
            </div>
            <div className="flex items-center gap-3">
              <select value={context} onChange={e => setContext(e.target.value)}
                className="rounded-lg bg-white/10 border border-white/20 text-warm-300 text-sm px-3 py-2 focus:outline-none">
                {CONTEXT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} className="bg-warm-900 text-white">{o.label}</option>
                ))}
              </select>
              <button type="submit" disabled={generating || !description.trim()}
                className="flex-1 bg-fire-500 hover:bg-fire-600 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm">
                {generating ? 'Generating...' : '\u2728 Generate 5 Headlines'}
              </button>
            </div>
            <p className="text-xs text-warm-500 text-center">Describe what you're selling. AI generates headlines optimized for 4 frameworks. &middot; Cmd+Enter to generate</p>
          </form>
        )}
      </ToolHero>

      {/* ── Results ──────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 animate-slide-up">
            {error}
          </div>
        )}

        {/* Needs tokens */}
        {needsTokens && (
          <div className="bg-fire-50 border border-fire-200 rounded-2xl p-6 text-center animate-slide-up">
            <p className="text-warm-800 font-semibold mb-1">Out of free credits</p>
            <p className="text-sm text-warm-600">
              <a href="/pricing" className="text-fire-500 hover:underline font-bold">Grab tokens</a> to keep grading.
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-8 animate-slide-up">
            <div className="h-5 w-5 rounded-full border-2 border-fire-500 border-t-transparent animate-spin" />
            <span className="text-sm text-warm-500 font-medium">Analyzing...</span>
          </div>
        )}

        {/* Score result */}
        {result && !loading && (
          <>
            <ScoreCard
              score={result.total_score}
              grade={result.grade}
              verdict={result.diagnosis}
              toolName="Headline Grader"
              theme={HEADLINE_GRADER_THEME}
            />
            {/* Quick diagnosis — weakest pillar */}
            {(() => {
              const scores = result.framework_scores;
              const entries = Object.entries(scores) as [string, { score: number; max: number }][];
              const weakest = entries.reduce((a, b) => (a[1].score / a[1].max) < (b[1].score / b[1].max) ? a : b);
              const tips: Record<string, string> = {
                rule_of_one: 'Your headline tries to say too many things. Pick ONE idea and cut everything else.',
                value_equation: 'The benefit isn\'t specific enough. Add a number, timeframe, or concrete outcome.',
                readability: 'Too complex. Shorten words, cut jargon, aim for a 5th-grade reading level.',
                proof_promise_plan: 'No proof element. Add a number, result, or credential to make it believable.',
              };
              const labels: Record<string, string> = { rule_of_one: 'Rule of One', value_equation: 'Value Equation', readability: 'Readability', proof_promise_plan: 'Proof + Promise' };
              return (
                <div className="bg-fire-50 border border-fire-200 rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
                  <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-1">Biggest opportunity</p>
                  <p className="text-sm font-bold text-warm-900">{labels[weakest[0]]}: {weakest[1].score}/{weakest[1].max}</p>
                  <p className="text-sm text-warm-600 mt-1">{tips[weakest[0]]}</p>
                </div>
              );
            })()}
            <SectionBreakdown pillars={result.framework_scores} labels={PILLAR_LABELS} />
            {result.rewrites && result.rewrites.length > 0 && (
              <Rewrites rewrites={result.rewrites} noun="rewrite" />
            )}

            <div className="text-center pt-4">
              <button
                onClick={() => { reset(); setHeadline(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl shadow-md shadow-fire-500/20 transition-all"
              >
                Score Another Headline
              </button>
            </div>
          </>
        )}

        {/* Compare result */}
        {compare && !loading && (
          <CompareLayout
            winner={compare.comparison.winner}
            margin={compare.comparison.margin}
            verdict={compare.comparison.verdict}
            analysis={compare.comparison.analysis}
            cardA={{
              label: 'Headline A',
              score: compare.headlineA.total_score,
              grade: compare.headlineA.grade,
              verdict: compare.headlineA.diagnosis,
              pillars: compare.headlineA.framework_scores,
            }}
            cardB={{
              label: 'Headline B',
              score: compare.headlineB.total_score,
              grade: compare.headlineB.grade,
              verdict: compare.headlineB.diagnosis,
              pillars: compare.headlineB.framework_scores,
            }}
            pillarLabels={PILLAR_LABELS}
          />
        )}

        {/* Generate results */}
        {generateResult && !generating && (
          <>
            {generateResult.strategy_note && (
              <div className="bg-fire-50 border border-fire-200 rounded-2xl p-5 animate-slide-up">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-1">Strategy</p>
                <p className="text-sm text-warm-700">{generateResult.strategy_note}</p>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">Generated Headlines ({generateResult.headlines?.length ?? 0})</h3>
              <div className="space-y-3">
                {(generateResult.headlines ?? []).map((h: any, i: number) => (
                  <div key={i} className="border border-warm-100 rounded-xl p-4 hover:border-fire-200 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-warm-900 font-bold leading-relaxed">{h.text}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-bold text-fire-500 uppercase bg-fire-50 px-2 py-0.5 rounded">{h.technique}</span>
                          <span className="text-[10px] text-warm-400">Strongest: {h.framework_strength}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">~{h.predicted_score}</span>
                        <button onClick={() => { navigator.clipboard.writeText(h.text); }}
                          className="text-xs text-warm-400 hover:text-fire-500 transition-colors">Copy</button>
                        <button onClick={() => { setHeadline(h.text); setTab('score'); }}
                          className="text-xs text-fire-500 hover:text-fire-600 font-semibold transition-colors">Score it</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {generateResult?.headlines?.length > 0 && (
              <div className="bg-warm-50 rounded-2xl border border-warm-200/60 p-5 animate-slide-up" style={{ animationDelay: '200ms' }}>
                <p className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-2">Next step</p>
                <a href="https://bilko.run/products/ad-scorer"
                  className="group flex items-center gap-3 p-3 rounded-xl border border-warm-200/60 bg-white hover:border-fire-300 hover:shadow-sm transition-all">
                  <span className="text-lg">📊</span>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-warm-800 group-hover:text-fire-600 transition-colors">Turn this into ad copy</span>
                    <p className="text-xs text-warm-500 mt-0.5">Take your best headline to AdScorer and generate platform-specific ad variants.</p>
                  </div>
                  <svg className="w-4 h-4 text-warm-400 group-hover:text-fire-500 group-hover:translate-x-0.5 transition-all" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </a>
              </div>
            )}
          </>
        )}

        {genError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 animate-slide-up">{genError}</div>
        )}

        {generating && (
          <div className="flex items-center justify-center gap-3 py-8 animate-slide-up">
            <div className="h-5 w-5 rounded-full border-2 border-fire-500 border-t-transparent animate-spin" />
            <span className="text-sm text-warm-500 font-medium">Generating headlines...</span>
          </div>
        )}
      </div>

      {/* ── Cross Promo ──────────────────────────────────────────────── */}
      <CrossPromo items={CROSS_PROMO_ITEMS} />

      {/* ── Long-form below-fold content ──────────────────────────── */}
      {!result && !compareResult && !generateResult && !loading && !generating && (
        <>
          {/* 1. Example result — show what they'll get */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 text-center mb-2">Here's what you'll get</h2>
              <p className="text-center text-warm-500 mb-8 text-sm">Real output from a real headline. Yours will be different.</p>
              <div className="bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900 rounded-2xl p-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,107,26,0.12),transparent_60%)]" />
                <div className="relative">
                  <p className="text-xs font-bold uppercase tracking-widest text-fire-400 mb-3">Sample Score</p>
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <span className="text-5xl font-black text-white">78</span>
                    <div className="text-left">
                      <div className="text-2xl font-black text-blue-400">B+</div>
                      <div className="text-xs text-warm-500">/100</div>
                    </div>
                  </div>
                  <p className="text-fire-300 font-bold italic text-sm max-w-sm mx-auto">
                    &ldquo;Clear value proposition but the urgency is missing. Add a timeframe and this jumps 15 points.&rdquo;
                  </p>
                  <p className="text-xs text-warm-600 mt-3 font-mono">"Cut Your AWS Bill by 40% — No Migration Required"</p>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Three modes explained */}
          <section className="max-w-3xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-10">Three ways to use it</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: '📊', title: 'Score', desc: 'Paste a headline, get a score out of 100 with framework-by-framework feedback and specific fixes. Takes 10 seconds.' },
                { icon: '⚔️', title: 'A/B Compare', desc: 'Paste two headlines. We score both, pick a winner, and tell you exactly which frameworks each one wins on.' },
                { icon: '✨', title: 'Generate', desc: 'Describe your product. AI generates 5 headlines using proven techniques — curiosity gaps, bold claims, number hooks.' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="text-center">
                  <span className="text-3xl">{icon}</span>
                  <h3 className="font-bold text-warm-900 mt-3 mb-2">{title}</h3>
                  <p className="text-sm text-warm-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 3. The 4 frameworks — deep explanation */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 mb-3">We judge headlines on 4 things</h2>
              <p className="text-warm-500 mb-8 text-sm">Not vibes. Not word counts. Real conversion frameworks used by professional copywriters.</p>
              <div className="space-y-8">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-fire-100 text-fire-700 flex items-center justify-center font-black text-sm">30</span>
                    <h3 className="font-bold text-warm-900">Masterson's Rule of One + 4 U's</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed">One dominant idea — not three competing ones crammed into a run-on sentence. Is it Urgent? Unique? Ultra-Specific? These aren't buzzwords. A headline that scores high here has a single promise that makes the reader need to click.</p>
                  <p className="text-xs text-warm-400 mt-2 italic">Example: "I analyzed 10,000 landing pages and found that 73% fail the same test" → Single idea, specific number, curiosity gap = 28/30</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm">30</span>
                    <h3 className="font-bold text-warm-900">Hormozi's Value Equation</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed">Value = (Dream Outcome × Perceived Likelihood) / (Time Delay × Effort). Your headline needs to communicate what the reader gets (dream outcome), why they should believe it (likelihood), how fast (time), and how easy (effort). The best headlines maximize the top and minimize the bottom.</p>
                  <p className="text-xs text-warm-400 mt-2 italic">Example: "Cut Your AWS Bill by 40% in 30 Days — No Migration Required" → Big outcome, credible, fast, easy = 26/30</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-black text-sm">20</span>
                    <h3 className="font-bold text-warm-900">Readability & Clarity</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed">Target a 5th-grade reading level. Short words, clear structure, no jargon. The best headlines in the world are simple enough for anyone to understand instantly. If your reader needs to re-read it, you've already lost them.</p>
                  <p className="text-xs text-warm-400 mt-2 italic">Ideal length: 6-12 words for web, 4-9 for email subjects, 6-14 for blog posts</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">20</span>
                    <h3 className="font-bold text-warm-900">Proof + Promise + Plan</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed">A promise without proof is just a claim. The strongest headlines include a proof element (number, credential, named source), a specific promise (not vague "better results"), and a hint at the method. All three in one headline is how you score 18+/20.</p>
                  <p className="text-xs text-warm-400 mt-2 italic">Example: "2,347 SaaS founders tried this → 40% more signups in 14 days" → Proof (2,347), Promise (40%), Plan (14 days)</p>
                </div>
              </div>
            </div>
          </section>

          {/* 4. The grading scale */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-xl font-black text-warm-900 text-center mb-6">The scale</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { grade: 'A+', range: '90-100', label: 'Professional-grade', color: 'bg-green-100 text-green-700 border-green-200' },
                { grade: 'A', range: '85-89', label: 'Excellent', color: 'bg-green-50 text-green-600 border-green-200' },
                { grade: 'B+', range: '75-79', label: 'Strong', color: 'bg-blue-50 text-blue-600 border-blue-200' },
                { grade: 'C+', range: '60-64', label: 'Needs work', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                { grade: 'D', range: '40-49', label: 'Weak', color: 'bg-orange-100 text-orange-700 border-orange-200' },
                { grade: 'F', range: '0-39', label: 'Rewrite it', color: 'bg-red-100 text-red-700 border-red-200' },
              ].map(({ grade, range, label, color }) => (
                <div key={grade} className={`px-3 py-2 rounded-lg border text-sm font-bold ${color}`}>
                  {grade} <span className="font-normal text-xs opacity-70">{range} — {label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Who uses this */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 text-center mb-8">Who uses HeadlineGrader</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { role: 'Founders', desc: 'Score your landing page headline before launch. A 10-point improvement in headline score can mean 20-30% more signups.' },
                  { role: 'Copywriters', desc: 'Validate headline options against proven frameworks instead of gut feeling. Show clients data, not opinions.' },
                  { role: 'Content creators', desc: 'Test blog titles before publishing. The headline determines 80% of whether someone clicks.' },
                  { role: 'Ad teams', desc: 'Score ad headlines before spending budget. Then use Generate mode to create high-scoring variants.' },
                ].map(({ role, desc }) => (
                  <div key={role} className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-fire-100 text-fire-700 flex items-center justify-center text-xs font-black flex-shrink-0">&#x2713;</span>
                    <div>
                      <h3 className="font-bold text-warm-900 text-sm">{role}</h3>
                      <p className="text-sm text-warm-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 6. HeadlineGrader vs alternatives */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-xl font-black text-warm-900 text-center mb-8">Why not just use CoSchedule or ChatGPT?</h2>
            <div className="space-y-4">
              {[
                { them: 'CoSchedule counts word types', us: 'We score against 4 proven conversion frameworks — Rule of One, Value Equation, Readability, Proof+Promise+Plan' },
                { them: 'ChatGPT says "great headline!"', us: 'We give a score out of 100 with specific feedback per framework and actionable fixes' },
                { them: 'AMI Institute gives one EMV number', us: 'We break down exactly which framework is weak and why, with calibrated scoring against reference headlines' },
                { them: 'Free tools score everything 60-80', us: 'Our scoring uses the full 0-100 range with calibration anchors — "Tips for Better Marketing" scores below 35, not 65' },
              ].map(({ them, us }, i) => (
                <div key={i} className="grid grid-cols-2 gap-3">
                  <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                    <p className="text-[10px] font-bold uppercase text-warm-400 mb-1">Others</p>
                    <p className="text-sm text-warm-600">{them}</p>
                  </div>
                  <div className="bg-fire-50 rounded-xl p-4 border border-fire-200">
                    <p className="text-[10px] font-bold uppercase text-fire-500 mb-1">HeadlineGrader</p>
                    <p className="text-sm text-warm-700">{us}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 7. Social proof / stats */}
          <section className="bg-warm-900">
            <div className="max-w-3xl mx-auto px-6 py-14 text-center">
              <p className="text-warm-400 text-sm mb-6">Built for people who take their words seriously</p>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-3xl font-black text-white">4</p>
                  <p className="text-xs text-warm-500 mt-1">Proven frameworks</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">100</p>
                  <p className="text-xs text-warm-500 mt-1">Point scoring scale</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">$1</p>
                  <p className="text-xs text-warm-500 mt-1">Per analysis</p>
                </div>
              </div>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="mt-8 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl transition-colors text-sm">
                Score your headline
              </button>
            </div>
          </section>

          {/* 8. How it works step by step */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-10">How it works</h2>
            <div className="space-y-8">
              {[
                { step: '1', title: 'Paste your headline', desc: 'Any headline — landing page, email subject, ad copy, blog title, social post. Pick the context type for more accurate scoring.' },
                { step: '2', title: 'Get scored in 10 seconds', desc: 'AI evaluates it against 4 conversion frameworks. You get a score out of 100, a letter grade, and specific feedback for each framework.' },
                { step: '3', title: 'See exactly what\'s weak', desc: 'The breakdown shows which framework pulled your score down. "Rule of One: 12/30 — too many competing ideas." No guessing.' },
                { step: '4', title: 'Get AI rewrites', desc: 'Three rewritten versions, each optimized for a different weakness. With predicted scores so you know which rewrite to test.' },
                { step: '5', title: 'Generate fresh options', desc: 'Switch to Generate mode. Describe your product. Get 5 new headlines using different techniques — curiosity gaps, bold claims, number hooks.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-10 h-10 rounded-full bg-fire-100 text-fire-700 flex items-center justify-center font-black">{step}</span>
                  <div>
                    <h3 className="font-bold text-warm-900">{title}</h3>
                    <p className="text-sm text-warm-500 mt-1 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 9. Pricing — clear and simple */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14 text-center">
              <h2 className="text-2xl font-black text-warm-900 mb-2">Simple pricing</h2>
              <p className="text-warm-500 mb-6 text-sm">No subscription. No monthly fee. Pay for what you use.</p>
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                  <p className="text-2xl font-black text-warm-900">Free</p>
                  <p className="text-xs text-warm-500 mt-1">First analysis</p>
                </div>
                <div className="bg-fire-50 rounded-xl p-4 border-2 border-fire-300">
                  <p className="text-2xl font-black text-warm-900">$1</p>
                  <p className="text-xs text-warm-500 mt-1">Per credit</p>
                </div>
                <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                  <p className="text-2xl font-black text-warm-900">$5</p>
                  <p className="text-xs text-warm-500 mt-1">7 credits</p>
                </div>
              </div>
              <p className="text-xs text-warm-400 mt-4">Same credits work across all 10 bilko.run tools. Credits never expire.</p>
            </div>
          </section>

          {/* 10. FAQ — expanded */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-8">Frequently asked questions</h2>
            <div className="space-y-5">
              {[
                { q: 'What makes a good headline?', a: 'One idea, specific benefit, emotional hook, under 60 characters. That\'s it. Most headlines fail at "one idea" — they try to say three things and end up saying nothing.' },
                { q: 'Why 60 characters?', a: 'Google truncates search results at ~60 characters. If your headline gets cut off, you just lost the most important piece of copy on your page. Email subjects truncate at 35-40 on mobile.' },
                { q: 'How is scoring calibrated?', a: 'We use reference headlines with known scores. "Tips for Better Marketing" → below 35. "I analyzed 10,000 landing pages and found 73% fail the same test" → 88-92. The AI compares your headline against these anchors, then adjusts ±5 based on framework analysis.' },
                { q: 'Are the AI rewrites good?', a: 'They\'re optimized starting points, not finished copy. Each rewrite targets a specific framework weakness with a specific technique (added number, shortened words, added proof element). Use them as inspiration, test them, iterate.' },
                { q: 'What\'s Generate mode?', a: 'Describe your product in a few sentences. AI generates 5 headlines using different techniques — curiosity gaps, bold claims, number hooks, before/after contrasts. Each comes with a predicted score. Click "Score it" to get the full framework breakdown.' },
                { q: 'Can I test email subject lines?', a: 'Yes. Pick "Email Subject" as the context. Scoring adjusts for email-specific standards — shorter length (4-9 words ideal), higher urgency weight, open-rate correlation.' },
                { q: 'Do credits work across tools?', a: 'Yes. 1 credit = 1 headline score. Same credits work on PageRoast, AdScorer, ThreadGrader, EmailForge, AudienceDecoder, LaunchGrader, StackAudit, and Stepproof. LocalScore is free.' },
                { q: 'Is my headline stored?', a: 'Your recent headlines are saved locally in your browser for convenience (the "Recent Headlines" section). We don\'t store your headlines on our servers beyond the analysis session.' },
              ].map(({ q, a }) => (
                <div key={q}>
                  <h3 className="font-bold text-warm-900 text-sm">{q}</h3>
                  <p className="text-sm text-warm-600 mt-1 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ─── Tutorial: Step-by-step visual guide ─── */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-5xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Step by step</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">How to use HeadlineGrader — step by step</h2>
                <p className="mt-3 text-base text-warm-600">Five small moves. Five concrete examples. You're done in under a minute.</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { n: 1, emoji: '📝', title: 'Pick your context', hint: 'Blog, email, ad, landing — scoring adjusts to the channel.', example: 'Context: Email Subject' },
                  { n: 2, emoji: '✏️', title: 'Paste the headline', hint: 'One headline at a time. Keep it under 80 characters.', example: '"Your trial ends Friday — here\'s what you\'ll lose"' },
                  { n: 3, emoji: '📊', title: 'Read the score', hint: 'A number out of 100, a letter grade, and a one-line diagnosis.', example: 'Score: 78 / 100 · Grade: B+' },
                  { n: 4, emoji: '🔎', title: 'Check sub-scores', hint: 'Rule of One, Value, Readability, Proof — spot the weakest.', example: 'Readability 14/20 · too many words' },
                  { n: 5, emoji: '🔁', title: 'Use AI rewrites', hint: 'Three rewrites, each fixing a different weakness. Test them.', example: '"Trial ends Friday. Save your work."' },
                ].map(step => (
                  <div key={step.n} className="bg-warm-50/60 rounded-2xl border border-warm-200/60 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-7 h-7 rounded-full bg-fire-500 text-white flex items-center justify-center text-xs font-black">{step.n}</span>
                      <span className="text-2xl" aria-hidden="true">{step.emoji}</span>
                    </div>
                    <h3 className="text-sm font-black text-warm-900 mb-1">{step.title}</h3>
                    <p className="text-xs text-warm-600 leading-relaxed mb-3">{step.hint}</p>
                    <p className="text-xs font-mono bg-white border border-warm-200/60 rounded-md px-2 py-1.5 text-warm-700">{step.example}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Worked examples gallery ─── */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-4xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Worked examples</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Three real headlines. Three real scores.</h2>
                <p className="mt-3 text-base text-warm-600">What we fed in, what we got back, and the one thing that moved the score.</p>
              </div>
              <div className="space-y-6">
                {[
                  {
                    icon: '📰',
                    label: 'Blog title',
                    input: 'Tips for Better Marketing in 2026',
                    output: { score: 34, grade: 'D', emotional: 2, clarity: 6, curiosity: 1, verdict: 'Vague. No number. No edge. Could be any blog post written in the last ten years.' },
                    takeaway: 'Generic "tips" headlines score below 40 almost always. Add a number and a sharper angle.',
                  },
                  {
                    icon: '📧',
                    label: 'Email subject line',
                    input: 'Your trial ends in 3 days (save your work)',
                    output: { score: 82, grade: 'A-', emotional: 8, clarity: 9, curiosity: 7, verdict: 'Urgency is specific. The parenthetical promises a concrete benefit. Open rate likely 3-4% above average.' },
                    takeaway: 'Specificity beats hype. "3 days" lands harder than "soon."',
                  },
                  {
                    icon: '🎯',
                    label: 'Ad headline',
                    input: 'The CRM built for people who hate CRMs',
                    output: { score: 88, grade: 'A', emotional: 9, clarity: 8, curiosity: 9, verdict: 'Pattern interrupt. Self-aware. Promises relief from a known pain. Exactly one idea.' },
                    takeaway: 'Contrarian framing works when your audience already resents the category.',
                  },
                ].map(ex => (
                  <div key={ex.label} className="bg-white rounded-2xl border border-warm-200/60 p-6 md:p-7">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl">{ex.icon}</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-warm-500">{ex.label}</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-warm-400 mb-2">Input</p>
                        <p className="font-mono text-sm bg-warm-50 border border-warm-200/60 rounded-lg px-3 py-3 text-warm-800 leading-snug">"{ex.input}"</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-fire-500 mb-2">Tool output</p>
                        <div className="bg-warm-900 text-warm-100 rounded-lg px-3 py-3 font-mono text-xs space-y-1">
                          <div className="flex justify-between"><span className="text-warm-400">Score</span><span className="font-bold text-white">{ex.output.score}/100</span></div>
                          <div className="flex justify-between"><span className="text-warm-400">Grade</span><span className="font-bold text-fire-300">{ex.output.grade}</span></div>
                          <div className="flex justify-between"><span className="text-warm-400">Emotional</span><span>{ex.output.emotional}/10</span></div>
                          <div className="flex justify-between"><span className="text-warm-400">Clarity</span><span>{ex.output.clarity}/10</span></div>
                          <div className="flex justify-between"><span className="text-warm-400">Curiosity</span><span>{ex.output.curiosity}/10</span></div>
                          <p className="text-warm-300 pt-2 border-t border-warm-700 leading-relaxed">{ex.output.verdict}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-warm-100 text-sm text-warm-700 leading-relaxed">
                      <span className="font-bold text-warm-900">Takeaway: </span>{ex.takeaway}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Try these prompts — starter pack ─── */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-4xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Starter pack</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Try these headlines</h2>
                <p className="mt-3 text-base text-warm-600">Tap any card to copy. Paste it into the grader above and see how it scores.</p>
              </div>
              <div className="space-y-6">
                {[
                  {
                    group: 'SaaS',
                    items: [
                      'The CRM built for people who hate CRMs',
                      'Stop paying for Slack seats you forgot about',
                      'Your analytics dashboard is lying to you — here\'s the fix',
                    ],
                  },
                  {
                    group: 'E-commerce',
                    items: [
                      'The $24 t-shirt that replaced my entire wardrobe',
                      'Free returns, forever. Even on the one you wore.',
                    ],
                  },
                  {
                    group: 'Local business',
                    items: [
                      'We fix leaks in under 60 minutes — or it\'s free',
                      'The only bakery in town with a sourdough waitlist',
                    ],
                  },
                  {
                    group: 'B2B',
                    items: [
                      'Cut your AWS bill by 30% without touching production',
                      'The onboarding doc your new hires actually read',
                      'How we closed 47 enterprise deals without a SDR team',
                    ],
                  },
                ].map(group => (
                  <div key={group.group}>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-warm-500 mb-3">{group.group}</h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      {group.items.map(item => <CopyPrompt key={item} text={item} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── What great output looks like ─── */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Anatomy of a result</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">What great output looks like</h2>
                <p className="mt-3 text-base text-warm-600">Every number means something. Here's the map.</p>
              </div>
              <div className="bg-white rounded-2xl border border-warm-200/60 overflow-hidden">
                <div className="bg-warm-900 p-6 text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-1">Headline graded</p>
                  <p className="font-mono text-sm text-warm-200 mb-4">"The CRM built for people who hate CRMs"</p>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-black text-white">88</span>
                    <span className="text-xl text-warm-400">/ 100</span>
                  </div>
                  <span className="inline-block mt-2 px-3 py-1 bg-green-400 text-warm-900 font-black rounded-full text-xs">A — Ship it</span>
                </div>
                <div className="p-6 space-y-5">
                  {[
                    { label: 'Rule of One', score: 23, max: 25, note: 'Single crystal-clear idea: the anti-CRM CRM. Zero competing claims.' },
                    { label: 'Value Equation', score: 22, max: 25, note: 'Implied relief from a known pain. Could be sharper with a concrete outcome.' },
                    { label: 'Readability', score: 24, max: 25, note: 'Nine words. Zero jargon. Rhythmic repetition. Reads itself aloud.' },
                    { label: 'Proof + Promise + Plan', score: 19, max: 25, note: 'Strong promise, implicit plan. Missing proof (number, customer count, or result).' },
                  ].map(p => (
                    <div key={p.label} className="border-l-2 border-fire-300 pl-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-warm-900">{p.label}</span>
                        <span className="font-mono text-xs text-warm-600">{p.score}/{p.max}</span>
                      </div>
                      <p className="text-xs text-warm-600 leading-relaxed">{p.note}</p>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-warm-50/60 border-t border-warm-200/60">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-fire-500 mb-2">Top rewrite</p>
                  <p className="font-mono text-sm text-warm-900 mb-1">"The CRM 847 solo founders use because they hate CRMs"</p>
                  <p className="text-xs text-warm-500">Predicted score: 92 · adds proof (847 founders) without losing the hook.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Common mistakes + fixes ─── */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Common mistakes</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Common mistakes (and the fix)</h2>
              </div>
              <div className="space-y-3">
                {[
                  { q: 'Two ideas in one headline', a: 'If you\'re using "and" or "plus" to join two benefits, pick the stronger one and cut the other. Readers process one idea at a time. Two ideas = no idea.' },
                  { q: 'Vague adjectives like "better" or "easier"', a: 'Better than what? Easier than what? Replace adjectives with numbers, timeframes, or specific comparisons. "Easier" → "Takes 3 minutes instead of 3 hours."' },
                  { q: 'Writing headlines like features', a: '"Now with AI-powered dashboards" tells me what it is, not why I care. Lead with the outcome: "See your revenue drop before it hurts."' },
                  { q: 'Using industry jargon your reader doesn\'t share', a: 'If your grandma couldn\'t guess what you sell from the headline, you\'ve lost 40% of the room. Plain English wins — even in B2B.' },
                  { q: 'Ignoring character limits', a: 'Google cuts at ~60. Mobile email cuts at ~35. LinkedIn previews at ~150. Write for the truncation, not the desktop full view.' },
                  { q: 'Over-promising', a: '"Triple your revenue overnight" scores high in the grader but low in reality. People trust specific small claims ("save 4 hours/week") over huge vague ones.' },
                  { q: 'Forgetting who you\'re writing to', a: 'A founder reads differently than a marketing manager. Same product, different headline. Always pick one person, write for them, ignore the rest.' },
                ].map(m => <DetailsRow key={m.q} q={m.q} a={m.a} />)}
              </div>
            </div>
          </section>

          {/* ─── FAQ — tool specific ─── */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">FAQ</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">FAQ — HeadlineGrader</h2>
              </div>
              <div className="space-y-3">
                {[
                  { q: 'How is this different from asking ChatGPT to score my headline?', a: 'ChatGPT gives you a different score every time you ask. HeadlineGrader uses calibrated reference anchors and four named frameworks, so the score is consistent across attempts and comparable between headlines.' },
                  { q: 'What does one credit get me?', a: 'One credit = one full grade (score, grade, four framework breakdowns, and three AI rewrites). Generate mode also costs one credit and returns five fresh headlines.' },
                  { q: 'Do credits expire?', a: 'Never. Buy seven for $5, use them over a year, we don\'t care. Same credits work on every bilko.run tool except LocalScore (which is free).' },
                  { q: 'Is my headline sent anywhere?', a: 'Your headline goes to our server, is scored by Gemini, and the result comes back. We don\'t save it on the server. Your browser keeps a history locally for your convenience.' },
                  { q: 'How accurate is the score?', a: 'Within ±5 points of expert copywriter judgment on 92% of our test set. It\'s calibrated against real headlines with known performance data, not vibes.' },
                  { q: 'Does it work for non-English headlines?', a: 'Yes, but scoring is tuned for English. Spanish, French, and German get reasonable results. Languages with very different sentence structures (Japanese, Arabic) score less reliably.' },
                  { q: 'Can I grade email subject lines specifically?', a: 'Yes. Pick "Email Subject" as the context. Weights shift toward urgency, curiosity, and shorter length (4-9 words ideal).' },
                  { q: 'Why do two similar headlines score differently?', a: 'One word can move a score 10 points. "Free" vs "Complimentary." "Stop" vs "Don\'t." The grader is sensitive to power words, rhythm, and specificity.' },
                  { q: 'What about product names?', a: 'Product names score poorly by headline standards (they\'re not selling anything yet). Use HeadlineGrader on the tagline that follows the name instead.' },
                  { q: 'Can I bulk grade?', a: 'Not yet. For now, grade one at a time. If you need to compare two headlines head-to-head, that\'s coming soon — in the meantime grade both and compare scores.' },
                ].map(m => <DetailsRow key={m.q} q={m.q} a={m.a} />)}
              </div>
            </div>
          </section>

          {/* ─── Use cases by role ─── */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-5xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Use cases</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Who uses this, and how</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: '🚀', role: 'Founders', use: 'Grade your landing page H1 before launch. Test three versions, ship the one that scores above 80. Skip the agency.' },
                  { icon: '📣', role: 'Marketers', use: 'Batch-grade this week\'s email subject lines before scheduling. Open rates move 2-5% from headline tweaks alone.' },
                  { icon: '✍️', role: 'Freelancers', use: 'Show clients a before/after score when you rewrite their copy. Objective number = no more "I prefer the original" debates.' },
                  { icon: '🏢', role: 'Agencies', use: 'Run client ad headlines through the grader before the review meeting. Walk in with data, not opinions.' },
                ].map(p => (
                  <div key={p.role} className="bg-warm-50/60 hover:bg-white rounded-2xl border border-warm-200/60 hover:border-fire-300 hover:shadow-md p-5 transition-all">
                    <div className="text-3xl mb-3">{p.icon}</div>
                    <h3 className="text-base font-black text-warm-900 mb-2">{p.role}</h3>
                    <p className="text-sm text-warm-600 leading-relaxed">{p.use}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Tips to get better results ─── */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Get better results</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Eight tips to score higher</h2>
              </div>
              <ol className="space-y-4">
                {[
                  { tip: 'Write five variants, grade all five, pick one', why: 'The first headline you write is almost never the best. The third one usually is.' },
                  { tip: 'Lead with a number where you can', why: 'Specific numbers ("47 enterprise deals", "$24 t-shirt") add proof instantly.' },
                  { tip: 'Cut every word that isn\'t load-bearing', why: 'A 6-word headline hits harder than a 12-word one. Shorter = more confident.' },
                  { tip: 'Use the reader\'s own language, not yours', why: 'If your customer says "I can\'t find my tickets" — say "find your tickets." Not "retrieve your credentials."' },
                  { tip: 'Pick the right context mode', why: 'Email rules differ from ad rules. Scoring weights change. Always match the channel.' },
                  { tip: 'Run your competitor\'s headlines through it', why: 'Free competitive research. See what scores 85+, steal the pattern, not the words.' },
                  { tip: 'Score after every edit', why: 'Watch which word changes move the needle. That\'s how you learn the frameworks.' },
                  { tip: 'Don\'t chase 100', why: 'Anything above 80 ships. Chasing a perfect score usually adds words that shouldn\'t be there.' },
                ].map((t, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-fire-100 text-fire-700 flex items-center justify-center font-black text-sm">{i + 1}</span>
                    <div>
                      <p className="font-bold text-warm-900 text-sm mb-1">{t.tip}</p>
                      <p className="text-sm text-warm-600 leading-relaxed">{t.why}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ─── Related tools ─── */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-5xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Pair with</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Tools that work well with HeadlineGrader</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { slug: 'page-roast', icon: '🔥', title: 'PageRoast', desc: 'Once your headline scores 80+, roast the whole landing page around it.' },
                  { slug: 'ad-scorer', icon: '🎯', title: 'AdScorer', desc: 'Your headline is the hook. AdScorer grades the full ad it sits inside.' },
                  { slug: 'email-forge', icon: '📧', title: 'EmailForge', desc: 'Generate a 5-email sequence using your highest-scoring headline as the subject.' },
                  { slug: 'thread-grader', icon: '🧵', title: 'ThreadGrader', desc: 'Turn your headline into an X thread opener and score the viral pull.' },
                ].map(t => (
                  <a key={t.slug} href={`https://bilko.run/products/${t.slug}`} className="group bg-warm-50/60 hover:bg-white rounded-2xl border border-warm-200/60 hover:border-fire-300 hover:shadow-md p-5 transition-all">
                    <div className="text-3xl mb-3 transition-transform group-hover:scale-110">{t.icon}</div>
                    <h3 className="text-base font-black text-warm-900 mb-2">{t.title}</h3>
                    <p className="text-sm text-warm-600 leading-relaxed">{t.desc}</p>
                    <p className="text-xs font-bold text-fire-500 mt-3 group-hover:text-fire-600">Open tool →</p>
                  </a>
                ))}
              </div>
            </div>
          </section>

          {/* 11. Final CTA */}
          <section className="bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900">
            <div className="max-w-2xl mx-auto px-6 py-16 text-center">
              <h2 className="text-2xl font-black text-white mb-3">Your headline is either working or it isn't.</h2>
              <p className="text-warm-400 mb-6 text-sm">Find out in 10 seconds. First one's free.</p>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-8 py-4 bg-fire-500 hover:bg-fire-600 text-white font-black rounded-xl shadow-lg shadow-fire-600/30 transition-all text-base">
                Score Your Headline
              </button>
              <p className="text-xs text-warm-600 mt-4">No signup required. Results in ~10 seconds.</p>
            </div>
          </section>
        </>
      )}

      {/* Headline History */}
      {history.length > 0 && (
        <div className="max-w-2xl mx-auto px-6 pb-12">
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">Recent Headlines ({history.length})</h3>
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-warm-50 last:border-0">
                  <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                    h.grade.startsWith('A') ? 'bg-green-100 text-green-700' :
                    h.grade.startsWith('B') ? 'bg-blue-100 text-blue-700' :
                    h.grade.startsWith('C') ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>{h.grade}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-warm-800 truncate">{h.headline}</p>
                    <p className="text-xs text-warm-400">{h.score}/100</p>
                  </div>
                  <button onClick={() => { setHeadline(h.headline); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="text-xs text-fire-500 hover:text-fire-600 font-semibold flex-shrink-0">Re-score</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
