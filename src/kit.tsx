// Slim kit: ToolHero, ScoreCard, SectionBreakdown, CompareLayout, Rewrites, CrossPromo, and track().
// Local copies of `~/Projects/Bilko/src/components/tool-page/*` with HeadlineGrader's indigo
// theme baked in (heroGradient + glowColor from src/config/tools.ts).

import { useState, type ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────
// Analytics — same wire format as the host's usePageView.track().
// Calls bilko.run/api/analytics/event same-origin once deployed.

const HOST = 'https://bilko.run';
const API = `${HOST}/api`;

let visitorId: string | null = null;
function getVisitorId(): string {
  if (visitorId) return visitorId;
  try {
    let v = localStorage.getItem('bilko_vid');
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem('bilko_vid', v);
    }
    visitorId = v;
    return v;
  } catch {
    return 'anon';
  }
}

let sessionId: string | null = null;
function getSessionId(): string {
  if (sessionId) return sessionId;
  try {
    sessionId = sessionStorage.getItem('bilko_sid') ?? crypto.randomUUID();
    sessionStorage.setItem('bilko_sid', sessionId);
    return sessionId;
  } catch {
    return 'anon';
  }
}

export function track(event: string, props?: { tool?: string; metadata?: unknown }): void {
  try {
    const body = JSON.stringify({
      event,
      tool: props?.tool ?? 'headline-grader',
      path: typeof window !== 'undefined' ? window.location.pathname : null,
      metadata: props?.metadata ?? null,
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
    });
    const url = `${API}/analytics/event`;
    if (typeof navigator?.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // analytics never breaks the app
  }
}

// ─────────────────────────────────────────────────────────────
// Color helpers (was: src/components/tool-page/colors.ts).

function gradeColorLight(grade: string): string {
  if (grade.startsWith('A')) return 'text-green-400';
  if (grade.startsWith('B')) return 'text-blue-400';
  if (grade.startsWith('C')) return 'text-yellow-400';
  if (grade === 'D') return 'text-orange-400';
  return 'text-red-400';
}

function gradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-green-700';
  if (grade.startsWith('B')) return 'text-blue-700';
  if (grade.startsWith('C')) return 'text-yellow-700';
  if (grade === 'D') return 'text-orange-700';
  return 'text-red-700';
}

function barColor(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 60) return 'bg-blue-500';
  if (pct >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

// ─────────────────────────────────────────────────────────────
// ToolHero — HeadlineGrader's indigo theme baked in (was: getToolTheme('headline-grader')).
// The page renders its own 3-tab toggle (Score / Compare / Generate) inside children,
// so we don't expose tab/onTabChange/hasCompare here.

export function ToolHero({ title, tagline, children }: {
  title: string;
  tagline: string;
  children: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1530] via-[#0f0d1a] to-[#1a1530]" />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.14), transparent 70%)' }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="relative max-w-3xl mx-auto px-6 py-16 md:py-24 text-center">
        <h1 className="text-display-lg text-white animate-slide-up">{title}</h1>
        <p
          className="mt-4 text-base md:text-lg text-warm-400 max-w-lg mx-auto leading-relaxed animate-slide-up"
          style={{ animationDelay: '60ms' }}
        >
          {tagline}
        </p>
        <div className="mt-6 animate-slide-up" style={{ animationDelay: '160ms' }}>
          {children}
        </div>
        <p className="mt-4 text-xs text-warm-500 flex items-center justify-center gap-2">
          <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Free to try &middot; Results in ~30 seconds &middot; No credit card
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// ScoreCard — indigo theme baked in.

export function ScoreCard({ score, grade, verdict, toolName }: {
  score: number;
  grade: string;
  verdict: string;
  toolName: string;
}) {
  const [copied, setCopied] = useState(false);
  const shareText = `Just scored ${score}/100 (${grade}) on ${toolName}\n\n"${verdict}"\n\nFree at bilko.run`;

  return (
    <div className="bg-gradient-to-br from-[#1a1530] via-[#0f0d1a] to-[#1a1530] rounded-2xl p-6 md:p-8 text-center relative overflow-hidden animate-slide-up shadow-dark-elevation">
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 30%, rgba(99,102,241,0.14), transparent 60%)' }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="relative">
        <p className="text-label text-indigo-400 mb-4">{toolName}</p>
        <div className="flex items-center justify-center gap-4 mb-3">
          <span className="text-6xl md:text-7xl font-black text-white" style={{ letterSpacing: '-0.04em' }}>
            {score}
          </span>
          <div className="text-left">
            <div
              className={`text-4xl md:text-5xl font-black ${gradeColorLight(grade)}`}
              style={{ letterSpacing: '-0.03em' }}
            >
              {grade}
            </div>
            <div className="text-xs text-warm-500">/100</div>
          </div>
        </div>
        <p className="text-indigo-400 font-bold italic text-sm md:text-base max-w-md mx-auto mb-5">
          &ldquo;{verdict}&rdquo;
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareText).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="px-4 py-2 border border-white/10 hover:border-white/20 text-warm-400 hover:text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {copied ? 'Copied!' : 'Copy Result'}
          </button>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify({ score, grade, verdict, tool: toolName }, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${toolName.toLowerCase().replace(/\s+/g, '-')}-result.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-4 py-2 border border-white/10 hover:border-white/20 text-warm-400 hover:text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Download JSON
          </button>
          <button
            onClick={() =>
              window.open(
                `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
                '_blank',
                'width=550,height=420',
              )
            }
            className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Share on X
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SectionBreakdown — score bar per pillar.

export interface PillarScore {
  score: number;
  max: number;
  feedback: string;
}

export function SectionBreakdown({ pillars, labels }: {
  pillars: Record<string, PillarScore>;
  labels: Record<string, string>;
}) {
  return (
    <div
      className="bg-white rounded-2xl shadow-elevation-1 p-6 animate-slide-up"
      style={{ animationDelay: '100ms' }}
    >
      <h3 className="text-label text-warm-400 mb-6">Score Breakdown</h3>
      <div className="space-y-6">
        {Object.entries(pillars).map(([key, pillar]) => {
          const pct = Math.round((pillar.score / pillar.max) * 100);
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-warm-800">{labels[key] ?? key}</span>
                <span className="text-sm font-bold text-warm-700 tabular-nums">
                  {pillar.score}/{pillar.max}
                </span>
              </div>
              <div className="h-2 bg-warm-100 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor(pct)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-sm text-warm-500 leading-relaxed">{pillar.feedback}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CompareLayout — A/B compare result with winner banner + side-by-side cards.
// Faithful copy of host's CompareLayout.tsx; uses local color helpers.

interface CompareCardProps {
  label: string;
  score: number;
  grade: string;
  verdict: string;
  pillars: Record<string, PillarScore>;
  pillarLabels: Record<string, string>;
  isWinner: boolean;
  isDimmed: boolean;
}

function CompareCard({ label, score, grade, verdict, pillars, pillarLabels, isWinner, isDimmed }: CompareCardProps) {
  return (
    <div className={`relative bg-white rounded-2xl p-5 transition-all ${
      isWinner ? 'shadow-elevation-2 ring-2 ring-green-200' : isDimmed ? 'shadow-elevation-1 opacity-55' : 'shadow-elevation-1'
    }`}>
      {isWinner && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">Winner</div>
      )}
      <div className="text-center mb-4">
        <div className="text-label text-warm-400 mb-2">{label}</div>
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl font-black text-warm-900" style={{ letterSpacing: '-0.03em' }}>{score}</span>
          <span className={`text-2xl font-black ${gradeColor(grade)}`}>{grade}</span>
        </div>
        <p className="text-sm text-warm-600 italic mt-2 line-clamp-2">&ldquo;{verdict}&rdquo;</p>
      </div>
      <div className="space-y-2 border-t border-warm-100/80 pt-3">
        {Object.entries(pillars).map(([key, s]) => {
          const pct = Math.round((s.score / s.max) * 100);
          return (
            <div key={key}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-warm-500">{pillarLabels[key] ?? key}</span>
                <span className="font-bold text-warm-600 tabular-nums">{s.score}/{s.max}</span>
              </div>
              <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CompareLayout({ winner, margin, verdict, analysis, cardA, cardB, pillarLabels }: {
  winner: 'A' | 'B' | 'tie';
  margin: number;
  verdict: string;
  analysis?: string;
  cardA: { label: string; score: number; grade: string; verdict: string; pillars: Record<string, PillarScore> };
  cardB: { label: string; score: number; grade: string; verdict: string; pillars: Record<string, PillarScore> };
  pillarLabels: Record<string, string>;
}) {
  return (
    <div className="space-y-6">
      {/* Winner Banner */}
      {winner !== 'tie' ? (
        <div className="bg-green-50 rounded-2xl p-6 text-center animate-slide-up shadow-elevation-1">
          <p className="text-display-sm text-green-700">{cardA.label.includes(winner) ? cardA.label : cardB.label} wins</p>
          <p className="text-sm text-green-600 mt-1 tabular-nums">+{margin} points ahead</p>
        </div>
      ) : (
        <div className="bg-amber-50 rounded-2xl p-6 text-center animate-slide-up shadow-elevation-1">
          <p className="text-display-sm text-amber-700">It's a tie!</p>
        </div>
      )}

      {/* Side-by-side */}
      <div className="grid md:grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <CompareCard {...cardA} pillarLabels={pillarLabels} isWinner={winner === 'A'} isDimmed={winner === 'B'} />
        <CompareCard {...cardB} pillarLabels={pillarLabels} isWinner={winner === 'B'} isDimmed={winner === 'A'} />
      </div>

      {/* Verdict */}
      <div className="bg-white rounded-2xl shadow-elevation-1 p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
        <h3 className="text-label text-warm-400 mb-3">Verdict</h3>
        <p className="text-sm text-warm-700 leading-relaxed">{verdict}</p>
      </div>

      {/* Analysis */}
      {analysis && (
        <div className="bg-gradient-to-r from-fire-50/80 to-warm-50 rounded-2xl shadow-elevation-1 p-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <h3 className="text-label text-fire-500 mb-3">Strategic Analysis</h3>
          <p className="text-sm text-warm-700 leading-relaxed">{analysis}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Rewrites — AI rewrite suggestions with copy buttons.

interface Rewrite {
  text: string;
  predicted_score?: number;
  optimized_for?: string;
  technique?: string;
  label?: string;
  why_better?: string;
}

export function Rewrites({ rewrites, noun = 'rewrite' }: { rewrites: Rewrite[]; noun?: string }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (!rewrites || rewrites.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-elevation-1 p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
      <h3 className="text-label text-warm-400 mb-4">
        AI {noun}s ({rewrites.length})
      </h3>
      <div className="space-y-3">
        {rewrites.map((rw, i) => (
          <div key={i} className="border border-warm-100/80 rounded-xl p-4 hover:border-warm-200 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {(rw.label || rw.optimized_for) && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-fire-500 mb-1 block">
                    {rw.label || rw.optimized_for?.replace(/_/g, ' ')}
                  </span>
                )}
                <p className="text-sm text-warm-800 font-medium leading-relaxed">{rw.text}</p>
                {rw.why_better && (
                  <p className="text-xs text-warm-500 mt-1.5 italic">{rw.why_better}</p>
                )}
                {rw.technique && (
                  <p className="text-xs text-warm-400 mt-1">{rw.technique}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {rw.predicted_score !== undefined && (
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md tabular-nums">
                    ~{rw.predicted_score}
                  </span>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(rw.text);
                    setCopiedIdx(i);
                    setTimeout(() => setCopiedIdx(null), 1500);
                  }}
                  className="text-xs font-medium text-warm-400 hover:text-warm-700 transition-colors"
                >
                  {copiedIdx === i ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CrossPromo — hardcoded list. Targets are full URLs back to bilko.run so the
// click triggers a full page load (host MaybeStandaloneRedirect resolves the
// canonical product/project URL based on each target's host kind).

const CROSS_PROMO: { name: string; href: string; hook: string }[] = [
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

export function CrossPromo() {
  return (
    <div className="max-w-2xl mx-auto px-6 pb-12">
      <div className="bg-warm-50/80 rounded-2xl shadow-elevation-1 p-6">
        <h3 className="text-label text-warm-400 mb-4">Next up</h3>
        <div className="space-y-3">
          {CROSS_PROMO.map(p => (
            <a
              key={p.name}
              href={p.href}
              className="group flex items-center gap-3 p-3 rounded-xl bg-white shadow-elevation-1 hover:shadow-elevation-2 hover:-translate-y-0.5 transition-all"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-warm-800 group-hover:text-warm-900 transition-colors">
                  {p.name}
                </span>
                <p className="text-xs text-warm-500 mt-0.5">{p.hook}</p>
              </div>
              <svg
                className="w-4 h-4 text-warm-400 group-hover:text-fire-500 group-hover:translate-x-0.5 transition-all flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
