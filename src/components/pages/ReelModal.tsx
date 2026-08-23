// src/components/pages/ReelModal.tsx
"use client"

import React, { useMemo, useState, useEffect } from 'react';
import { Film, X, Sparkles, AlertTriangle, ImageIcon, Pencil, ArrowLeft, Check } from 'lucide-react';

// ─── Reel layout ratios (from video generator config 1080×1920) ──────────────

const RL = {
  header: { yRatio: 0.035, borderColor: '#5b21b6', borderWidth: 2.5, color: '#7c3aed' },
  cover: { topRatio: 0.07, bottomRatio: 0.72, scale: 0.93 },
  marker: { strokeWidth: 22, color: '#dc2626', highlight: '#ef4444' },
  cta: { yRatio: 0.88, widthRatio: 0.78, heightRatio: 0.0625, borderRadius: 8, from: '#9333ea', to: '#4f46e5', shadow: '0 8px 24px rgba(79,70,229,0.4)' },
  captions: {
    yRatio: 0.76,
    lineSpacing: 1.35,
    maxCharsPerLine: 22,
    activeColor: '#6d28d9',
    inactiveColor: 'rgba(0, 0, 0, 0.25)',
    fontWeightNormal: 500,
    fontWeightActive: 700,
    highlightWordIndex: 1,
  },
};

// ─── Separator used between intro paragraphs ─────────────────────────────────

const PAUSE = ' [short pause] ';

// ─── Marker SVG generator (seeded, dense Catmull-Rom, per-segment pressure) ──

function generateMarkerSegments(width: number, height: number, seed: number = 42) {
  const marker = { centerX: 0.50, centerY: 0.72, radiusX: 0.42, radiusY: 0.12 };
  let s = seed;
  const rng = () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };

  const cx = width * marker.centerX;
  const cy = height * marker.centerY;
  const rx = width * marker.radiusX;
  const ry = height * marker.radiusY;

  const N = 10;
  const tilt = (rng() - 0.5) * 0.2;
  const arcSpan = Math.PI * 2 * (0.88 + rng() * 0.06);
  const startAngle = -Math.PI * 0.75;

  const controlPoints: { x: number; y: number; pressure: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = startAngle - (i / N) * arcSpan;
    const radiusNoise = 1 + (rng() - 0.5) * 0.12;
    const angleNoise = (rng() - 0.5) * 0.12;
    const x = cx + Math.cos(t + tilt + angleNoise) * rx * radiusNoise;
    const y = cy + Math.sin(t + tilt + angleNoise) * ry * radiusNoise;
    const drawRatio = i / N;
    const pressureBase = 0.7 + 0.3 * Math.cos(drawRatio * Math.PI * 1.5);
    const pressureNoise = 1 + (rng() - 0.5) * 0.45;
    const startBoost = i < 2 ? 1.3 : 1.0;
    const endTaper = i > N - 3 ? 0.2 + 0.8 * ((N - i) / 3) : 1.0;
    controlPoints.push({ x, y, pressure: pressureBase * pressureNoise * startBoost * endTaper });
  }

  const dense: { x: number; y: number; pressure: number }[] = [];
  const interpPerSeg = 30;

  for (let i = 0; i < controlPoints.length - 1; i++) {
    const p0 = controlPoints[Math.max(0, i - 1)];
    const p1 = controlPoints[i];
    const p2 = controlPoints[i + 1];
    const p3 = controlPoints[Math.min(controlPoints.length - 1, i + 2)];

    for (let j = 0; j < interpPerSeg; j++) {
      const t = j / interpPerSeg;
      const t2 = t * t, t3 = t2 * t;
      const h = 0.5;
      const x = h * ((-p0.x + 3*p1.x - 3*p2.x + p3.x)*t3 + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*t2 + (-p0.x + p2.x)*t + 2*p1.x);
      const y = h * ((-p0.y + 3*p1.y - 3*p2.y + p3.y)*t3 + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*t2 + (-p0.y + p2.y)*t + 2*p1.y);
      const pressure = p1.pressure + (p2.pressure - p1.pressure) * t;
      dense.push({ x, y, pressure });
    }
  }
  dense.push(controlPoints[controlPoints.length - 1]);

  const segments: { x1: number; y1: number; x2: number; y2: number; pressure: number }[] = [];
  for (let i = 0; i < dense.length - 1; i++) {
    segments.push({
      x1: dense[i].x, y1: dense[i].y,
      x2: dense[i + 1].x, y2: dense[i + 1].y,
      pressure: (dense[i].pressure + dense[i + 1].pressure) / 2,
    });
  }

  return segments;
}

// ─── Caption segment builder ─────────────────────────────────────────────────

function buildFirstCaptionSegment(text: string): { line1: string[]; line2: string[] } | null {
  if (!text || !text.trim()) return null;
  const words = text.trim().split(/\s+/).map(w => w.replace(/^["„"]+|["„"]+$/g, '').replace(/["""]/g, ''));
  if (words.length === 0) return null;

  const maxTotal = RL.captions.maxCharsPerLine * 2 + 4;
  const segWords: string[] = [];
  let totalChars = 0;

  for (let i = 0; i < words.length && totalChars + words[i].length + 1 <= maxTotal; i++) {
    segWords.push(words[i]);
    totalChars += words[i].length + 1;
    if (segWords.length >= 3 && /[.!?]$/.test(words[i])) break;
  }
  if (segWords.length === 0) { segWords.push(words[0]); }

  let bestSplit = Math.ceil(segWords.length / 2);
  let bestDiff = Infinity;
  for (let s = 1; s < segWords.length; s++) {
    const l1 = segWords.slice(0, s).join(' ').length;
    const l2 = segWords.slice(s).join(' ').length;
    const diff = Math.abs(l1 - l2);
    if (diff < bestDiff) { bestDiff = diff; bestSplit = s; }
  }

  return { line1: segWords.slice(0, bestSplit), line2: segWords.slice(bestSplit) };
}

// ─── Inline Reel Preview ─────────────────────────────────────────────────────

function ReelPreviewInline({
  headerText, ctaText, coverUrl, placeholderHeader, placeholderCta,
  markerEnabled = true, markerScale = 1.0, markerOffsetY = 0.0, markerSeed = 42,
  introText, placeholderIntro,
}: {
  headerText: string;
  ctaText: string;
  coverUrl?: string;
  placeholderHeader?: string;
  placeholderCta?: string;
  markerEnabled?: boolean;
  markerScale?: number;
  markerOffsetY?: number;
  markerSeed?: number;
  introText?: string;
  placeholderIntro?: string;
}) {
  const markerSegments = useMemo(() => {
    if (!markerEnabled) return [];
    const cW = 1080 * RL.cover.scale;
    const cH = 1920 * (RL.cover.bottomRatio - RL.cover.topRatio) * RL.cover.scale;
    return generateMarkerSegments(cW, cH, markerSeed);
  }, [markerSeed, markerEnabled]);

  // Caption preview uses only the first paragraph (before first [short pause])
  const captionSource = (introText || placeholderIntro || '').split(PAUSE)[0];
  const isPlaceholderCaption = !introText && !!placeholderIntro;
  const captionSegment = useMemo(() => buildFirstCaptionSegment(captionSource), [captionSource]);

  const showHeader = headerText || placeholderHeader || '';
  const showCta = ctaText || placeholderCta || '';
  const svgW = 1080 * RL.cover.scale;
  const svgH = 1920 * (RL.cover.bottomRatio - RL.cover.topRatio) * RL.cover.scale;

  return (
    <div className="relative h-full" style={{ aspectRatio: '9 / 16' }}>
      <div className="absolute inset-0 bg-white rounded-xl overflow-hidden shadow-2xl" style={{ containerType: 'size' as any }}>

        {/* ═══ HEADER ═══ */}
        <div className="absolute left-0 right-0 flex justify-center" style={{ top: `${RL.header.yRatio * 100}%` }}>
          <div
            className="whitespace-nowrap text-center leading-none transition-colors duration-200"
            style={{
              padding: '1.4% 4.8%',
              border: `${RL.header.borderWidth}px solid ${headerText ? RL.header.borderColor : 'rgba(91,33,182,0.25)'}`,
              color: headerText ? RL.header.color : 'rgba(124,58,237,0.3)',
              fontWeight: 700,
              fontSize: 'clamp(8px, 3.4cqh, 26px)',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {showHeader}
          </div>
        </div>

        {/* ═══ COVER IMAGE ═══ */}
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
          style={{
            top: `${RL.cover.topRatio * 100}%`,
            bottom: `${(1 - RL.cover.bottomRatio) * 100}%`,
            width: `${RL.cover.scale * 100}%`,
          }}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {coverUrl ? (
              <img src={coverUrl} alt="Cover" className="max-w-full max-h-full object-contain" draggable={false} />
            ) : (
              <div className="w-4/5 h-4/5 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <ImageIcon className="text-gray-300 mb-1" style={{ width: '15%', height: '15%' }} />
                <span className="text-gray-400" style={{ fontSize: 'clamp(6px, 1.4cqh, 12px)' }}>Mockup</span>
              </div>
            )}

            {/* ═══ MARKER SVG ═══ */}
            {markerEnabled && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${svgW} ${svgH}`}
                preserveAspectRatio="xMidYMid meet"
                fill="none"
              >
                <g transform={`translate(${svgW * 0.5}, ${svgH * 0.72 + (markerOffsetY + 0.015) * svgH}) scale(${markerScale * 0.9266}, ${markerScale * 1.0938}) translate(${-svgW * 0.5}, ${-svgH * 0.72})`}>
                  {markerSegments.map((seg, i) => (
                    <line key={`s${i}`} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                      stroke={RL.marker.color} strokeWidth={RL.marker.strokeWidth * seg.pressure}
                      strokeLinecap="round" opacity={0.35} />
                  ))}
                  {markerSegments.map((seg, i) => (
                    <line key={`h${i}`} x1={seg.x1 + 0.3} y1={seg.y1 + 0.3} x2={seg.x2 + 0.3} y2={seg.y2 + 0.3}
                      stroke={RL.marker.highlight} strokeWidth={RL.marker.strokeWidth * seg.pressure * 0.5}
                      strokeLinecap="round" opacity={0.5} />
                  ))}
                </g>
              </svg>
            )}
          </div>
        </div>

        {/* ═══ CAPTIONS ═══ */}
        {captionSegment && (
          <div
            className="absolute left-0 right-0 flex flex-col items-center pointer-events-none"
            style={{
              top: `${RL.captions.yRatio * 100}%`,
              transform: 'translateY(-50%)',
              gap: '1.24cqh',
              opacity: isPlaceholderCaption ? 0.45 : 1,
            }}
          >
            {[captionSegment.line1, captionSegment.line2].map((lineWords, lineIdx) => {
              if (!lineWords.length) return null;
              const lineStartIdx = lineIdx === 0 ? 0 : captionSegment.line1.length;
              return (
                <div key={lineIdx} className="text-center whitespace-nowrap" style={{ fontSize: 'clamp(7px, 3.54cqh, 24px)', fontFamily: "'Inter', sans-serif", lineHeight: 1 }}>
                  {lineWords.map((word, wi) => {
                    const globalIdx = lineStartIdx + wi;
                    const isActive = globalIdx === RL.captions.highlightWordIndex;
                    return (
                      <React.Fragment key={wi}>
                        {wi > 0 && ' '}
                        <span style={{
                          color: isActive ? RL.captions.activeColor : RL.captions.inactiveColor,
                          fontWeight: isActive ? RL.captions.fontWeightActive : RL.captions.fontWeightNormal,
                        }}>
                          {word}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ CTA BUTTON ═══ */}
        <div
          className="absolute left-1/2 flex items-center justify-center text-white text-center transition-opacity duration-200"
          style={{
            top: `${RL.cta.yRatio * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: `${RL.cta.widthRatio * 100}%`,
            height: `${RL.cta.heightRatio * 100}%`,
            borderRadius: RL.cta.borderRadius,
            background: ctaText
              ? `linear-gradient(to right, ${RL.cta.from}, ${RL.cta.to})`
              : 'linear-gradient(to right, rgba(147,51,234,0.25), rgba(79,70,229,0.25))',
            boxShadow: ctaText ? RL.cta.shadow : 'none',
            fontWeight: 600,
            fontSize: 'clamp(7px, 2.2cqh, 20px)',
            fontFamily: "'Inter', sans-serif",
            opacity: ctaText ? 1 : 0.5,
            padding: '0 4%',
          }}
        >
          {showCta}
        </div>
      </div>
    </div>
  );
}

// ─── Toggle Switch row ────────────────────────────────────────────────────────

function ToggleRow({ value, onChange, label, sublabel }: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sublabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-left ${
        value
          ? 'bg-purple-500/15 border-purple-500/30 hover:bg-purple-500/20'
          : 'bg-white/5 border-white/10 opacity-60 hover:opacity-80'
      }`}
    >
      <div className="min-w-0 flex-1 mr-3">
        <p className={`text-xs font-medium truncate ${value ? 'text-purple-200' : 'text-gray-400'}`}>{label}</p>
        {sublabel && (
          <p className="text-[10px] text-gray-500 truncate mt-0.5">{sublabel}</p>
        )}
      </div>
      <div className={`flex-shrink-0 w-9 h-5 rounded-full transition-colors relative ${value ? 'bg-purple-500' : 'bg-white/15'}`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-4' : 'left-0.5'}`} />
      </div>
    </button>
  );
}

// ─── Intro Editor ─────────────────────────────────────────────────────────────

interface IntroEditorProps {
  ebookTitle?: string;
  ebookSubtitle?: string;
  initialText: string;
  onSave: (composed: string) => void;
  onCancel: () => void;
}

function IntroEditor({ ebookTitle, ebookSubtitle, initialText, onSave, onCancel }: IntroEditorProps) {

  // Parse existing text back to structured fields — split on PAUSE separator
  const parseInitial = () => {
    const parts = initialText.split(PAUSE).map(p => p.trim()).filter(Boolean);
    let idx = 0;
    let uTitle = false, uSubtitle = false;
    if (ebookTitle    && parts[idx] === ebookTitle)    { uTitle    = true; idx++; }
    if (ebookSubtitle && parts[idx] === ebookSubtitle) { uSubtitle = true; idx++; }
    return {
      uTitle,
      uSubtitle,
      p1: parts[idx]     ?? '',
      p2: parts[idx + 1] ?? '',
      p3: parts[idx + 2] ?? '',
    };
  };

  const init = parseInitial();
  const [useTitle,    setUseTitle]    = useState(init.uTitle);
  const [useSubtitle, setUseSubtitle] = useState(init.uSubtitle);
  const [para1, setPara1] = useState(init.p1);
  const [para2, setPara2] = useState(init.p2);
  const [para3, setPara3] = useState(init.p3);

  // Gdy dane ebooka dotrą asynchronicznie (fetch po mount), przebuduj stan
  useEffect(() => {
    if (!ebookTitle && !ebookSubtitle) return;
    const reparsed = parseInitial();
    setUseTitle(reparsed.uTitle);
    setUseSubtitle(reparsed.uSubtitle);
    // Akapity przepisujemy tylko gdy są puste — nie nadpisuj edycji użytkownika
    if (!para1 && reparsed.p1) setPara1(reparsed.p1);
    if (!para2 && reparsed.p2) setPara2(reparsed.p2);
    if (!para3 && reparsed.p3) setPara3(reparsed.p3);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ebookTitle, ebookSubtitle]);

  const isValid = para1.trim().length > 0 && para2.trim().length > 0 && para3.trim().length > 0;

  const handleSave = () => {
    const parts: string[] = [];
    if (useTitle    && ebookTitle)    parts.push(ebookTitle);
    if (useSubtitle && ebookSubtitle) parts.push(ebookSubtitle);
    parts.push(para1.trim(), para2.trim(), para3.trim());
    onSave(parts.join(PAUSE));
  };

  const charBadge = (n: number) => (
    <span className={`text-[10px] font-mono tabular-nums ${n > 130 ? 'text-amber-400' : 'text-gray-600'}`}>{n}</span>
  );

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 flex-shrink-0">
        <button
          onClick={onCancel}
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
        >
          <ArrowLeft size={15} />
        </button>
        <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">
          Tekst intro (TTS)
        </span>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

        {/* Tytuł / Podtytuł toggles — dane z tabeli ebooks */}
        {(ebookTitle || ebookSubtitle) && (
          <div className="space-y-1.5 pb-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium px-0.5">
              Nagłówki e-booka (opcjonalne)
            </p>
            {ebookTitle && (
              <ToggleRow
                value={useTitle}
                onChange={setUseTitle}
                label="Tytuł"
                sublabel={ebookTitle}
              />
            )}
            {ebookSubtitle && (
              <ToggleRow
                value={useSubtitle}
                onChange={setUseSubtitle}
                label="Podtytuł"
                sublabel={ebookSubtitle}
              />
            )}
          </div>
        )}

        {/* ── 3 akapity ── */}
        <div className="space-y-2.5">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium px-0.5">
            Treść — 3 akapity (wymagane)
          </p>

          {([
            { label: 'Akapit 1', placeholder: 'Otwierające zdanie — przyciąga uwagę...', value: para1, set: setPara1 },
            { label: 'Akapit 2', placeholder: 'Rozwinięcie — buduje napięcie...', value: para2, set: setPara2 },
            { label: 'Akapit 3', placeholder: 'Zakończenie — prowadzi do CTA...', value: para3, set: setPara3 },
          ] as const).map(({ label, placeholder, value, set }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-gray-400 font-medium">{label}</label>
                {charBadge(value.length)}
              </div>
              <textarea
                  value={value}
                  onChange={e => set(e.target.value)}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = el.scrollHeight + 'px';
                  }}
                  ref={(el) => {
                    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
                  }}
                  rows={1}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/12 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all resize-none leading-relaxed overflow-hidden"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-white/10 flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 transition-all cursor-pointer border border-white/8"
        >
          Anuluj
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
            isValid
              ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
              : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
          }`}
        >
          <Check size={14} />
          Zapisz tekst
        </button>
      </div>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ReelModalProps {
  // refs & control
  reelModalRef: React.RefObject<HTMLDivElement | null>;
  closeReelModal: () => void;
  currentLang: 'pl' | 'en';
  t: Record<string, string>;

  // state — saving / generating
  reelIsSaving: boolean;
  reelGenerating: boolean;
  reelGenerateError: string | null;
  reelReadyUrl: string | null;

  // form fields
  reelHeader: string;
  setReelHeader: (v: string) => void;
  reelCTA: 'download' | 'comment';
  setReelCTA: (v: 'download' | 'comment') => void;
  reelCTAPassword: string;
  setReelCTAPassword: (v: string) => void;
  reelVoice: 'male' | 'female';
  setReelVoice: (v: 'male' | 'female') => void;
  reelMarkerEnabled: boolean;
  setReelMarkerEnabled: (v: boolean) => void;
  reelMarkerScale: number;
  setReelMarkerScale: (v: number) => void;
  reelMarkerOffsetY: number;
  setReelMarkerOffsetY: (v: number) => void;
  reelMarkerSeed: number;
  setReelMarkerSeed: (v: number) => void;
  reelIntroText: string;
  setReelIntroText: (v: string) => void;

  // dane e-booka (z tabeli ebooks, przez reels.ebookId → ebooks.id)
  ebookTitle?: string;
  ebookSubtitle?: string;

  // computed / preview
  reelCtaDisplayText: string;
  reelCoverUrl?: string;
  ctaOptionKeys: string[];
  reelCtaOptions: Record<string, string>;
  selectedCtaKey: string;
  setSelectedCtaKey: (v: string) => void;
  ctaPreviewText: string;
  hasReelPage: boolean;

  // actions
  isReelFormValid: () => boolean;
  handleGenerateReel: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReelModal({
  reelModalRef, closeReelModal, currentLang, t,
  reelIsSaving, reelGenerating, reelGenerateError, reelReadyUrl,
  reelHeader, setReelHeader,
  reelCTA, setReelCTA,
  reelCTAPassword, setReelCTAPassword,
  reelVoice, setReelVoice,
  reelMarkerEnabled, setReelMarkerEnabled,
  reelMarkerScale, setReelMarkerScale,
  reelMarkerOffsetY, setReelMarkerOffsetY,
  reelMarkerSeed, setReelMarkerSeed,
  reelIntroText, setReelIntroText,
  ebookTitle, ebookSubtitle,
  reelCtaDisplayText, reelCoverUrl,
  ctaOptionKeys, reelCtaOptions, selectedCtaKey, setSelectedCtaKey,
  ctaPreviewText, hasReelPage,
  isReelFormValid, handleGenerateReel,
}: ReelModalProps) {

  const [isEditingIntro, setIsEditingIntro] = useState(false);

  useEffect(() => {
    if (reelReadyUrl) setIsEditingIntro(false);
  }, [reelReadyUrl]);

  const handleIntroSave = (composed: string) => {
    setReelIntroText(composed);
    setIsEditingIntro(false);
  };

  const hasIntro = reelIntroText.trim().length > 0;

  // Snippetem jest pierwszy akapit (przed pierwszym PAUSE)
  const introPreviewSnippet = hasIntro
    ? reelIntroText.split(PAUSE)[0]
    : '';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] backdrop-blur-sm p-4 sm:py-3">
      <div
        ref={reelModalRef}
        className={`relative w-full flex flex-col bg-gray-900 rounded-2xl animate-fadeIn overflow-hidden transition-all duration-500 ease-in-out ${
          reelReadyUrl
            ? 'max-w-[400px] h-auto max-h-[95vh]'
            : 'max-w-[340px] sm:max-w-6xl h-[95vh] max-h-[95vh] sm:h-[95vh] sm:max-h-[95vh]'
        }`}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Film className="h-4 w-4 text-purple-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm truncate">{t.reelGenerator}</h3>
          </div>
          <button onClick={closeReelModal} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden min-h-0">
          {reelReadyUrl ? (
            /* ═══ PLAYER VIEW ═══ */
            <div className="flex flex-col items-center h-full p-3 animate-fadeIn">
              <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '9 / 16' }}>
                <video
                  src={reelReadyUrl}
                  controls
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                />
              </div>
              <a
                href={reelReadyUrl}
                download
                className="w-full flex items-center justify-center gap-2 py-3 mt-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-900/30 active:scale-[0.98] transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {currentLang === 'pl' ? 'Pobierz rolkę' : 'Download reel'}
              </a>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row h-full">

              {/* ── Preview (lewa kolumna) ── */}
              <div className="relative flex items-center justify-center py-3 sm:py-0 bg-black/30 sm:bg-black/40 sm:w-[500px] sm:border-r sm:border-white/10 flex-shrink-0 px-3 sm:p-4">
                {(reelIsSaving || reelGenerating) && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-md rounded-l-2xl">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 border-[3px] border-purple-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-white/80 text-sm font-medium">{reelGenerating ? t.generating : 'Saving...'}</span>
                    </div>
                  </div>
                )}
                <div className="relative flex items-center justify-center h-[calc(95vh-380px)] sm:h-[calc(95vh-100px)]">
                  <ReelPreviewInline
                    headerText={reelHeader}
                    ctaText={reelCtaDisplayText}
                    coverUrl={reelCoverUrl}
                    placeholderHeader={t.reelHeaderPlaceholder}
                    placeholderCta={t.reelCTA + '...'}
                    markerEnabled={reelMarkerEnabled}
                    markerScale={reelMarkerScale}
                    markerOffsetY={reelMarkerOffsetY}
                    markerSeed={reelMarkerSeed}
                    introText={reelIntroText}
                    placeholderIntro={t.reelIntroPlaceholder}
                  />
                  <div className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 bg-black/60 text-white/70 px-2 py-0.5 rounded-full text-[9px] font-medium tracking-wide uppercase whitespace-nowrap z-10">
                    {t.reelPreview}
                  </div>
                </div>
              </div>

              {/* ── Prawa kolumna: Config ↔ IntroEditor ── */}
              <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-opacity duration-300 ${reelIsSaving || reelGenerating ? 'opacity-30 pointer-events-none select-none' : ''}`}>

                {isEditingIntro ? (
                  /* ═══ TRYB EDYCJI INTRO ═══ */
                  <IntroEditor
                    ebookTitle={ebookTitle}
                    ebookSubtitle={ebookSubtitle}
                    initialText={reelIntroText}
                    onSave={handleIntroSave}
                    onCancel={() => setIsEditingIntro(false)}
                  />
                ) : (
                  /* ═══ TRYB KONFIGURACJI ═══ */
                  <>
                    <div className="hidden sm:block px-5 pt-5 pb-1 flex-shrink-0">
                      <h4 className="font-semibold text-white/90 flex items-center text-xs uppercase tracking-wider">
                        <Sparkles size={14} className="mr-2 text-purple-400" />{t.reelConfig}
                      </h4>
                    </div>

                    {/* ═══ MOBILE FORM ═══ */}
                    <div className="sm:hidden px-4 pt-3 pb-2 space-y-3">

                      <div>
                        <label className="block text-[11px] font-medium text-gray-400 mb-1">{t.reelHeader}</label>
                        <input
                          type="text"
                          value={reelHeader}
                          onChange={(e) => setReelHeader(e.target.value)}
                          placeholder={t.reelHeaderPlaceholder}
                          className="w-full px-3 py-2 text-sm bg-white/5 border border-white/15 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-gray-400 mb-1 text-center">{t.reelCTA}</label>
                          <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/10">
                            <button onClick={() => setReelCTA('download')} className={`flex-1 text-center py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${reelCTA === 'download' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>{t.ctaDownload}</button>
                            <button onClick={() => setReelCTA('comment')} className={`flex-1 text-center py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${reelCTA === 'comment' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>{t.ctaCommentShort}</button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-gray-400 mb-1 text-center">{t.voice}</label>
                          <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/10">
                            <button onClick={() => setReelVoice('male')} className={`flex-1 text-center py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${reelVoice === 'male' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>{t.voiceMale}</button>
                            <button onClick={() => setReelVoice('female')} className={`flex-1 text-center py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${reelVoice === 'female' ? 'bg-pink-600 text-white' : 'text-gray-400'}`}>{t.voiceFemale}</button>
                          </div>
                        </div>
                      </div>

                      {reelCTA === 'comment' && (
                        <div className="animate-fadeIn">
                          <label className="block text-[11px] font-medium text-gray-400 mb-1">{t.ctaPassword}</label>
                          <input
                            type="text"
                            value={reelCTAPassword}
                            onChange={(e) => setReelCTAPassword(e.target.value.toUpperCase())}
                            placeholder={t.ctaPasswordPlaceholder}
                            className="w-full px-3 py-2 text-sm bg-white/5 border border-white/15 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
                          />
                        </div>
                      )}

                      {/* Intro button */}
                      <button
                        onClick={() => setIsEditingIntro(true)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                          hasIntro
                            ? 'bg-purple-500/10 border-purple-500/25 hover:bg-purple-500/20'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="min-w-0 flex-1 text-left mr-2">
                          <span className={`text-[11px] font-medium ${hasIntro ? 'text-purple-200' : 'text-gray-400'}`}>
                            {hasIntro ? 'Edytuj tekst intro' : 'Dodaj tekst intro'}
                          </span>
                          {hasIntro && introPreviewSnippet && (
                            <p className="text-[10px] text-gray-500 truncate mt-0.5">{introPreviewSnippet}</p>
                          )}
                        </div>
                        <Pencil size={11} className={`flex-shrink-0 ${hasIntro ? 'text-purple-400' : 'text-gray-500'}`} />
                      </button>

                      {/* Marker toggle */}
                      <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/10">
                        <button
                          onClick={() => setReelMarkerEnabled(true)}
                          className={`flex-1 text-center py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${reelMarkerEnabled ? 'bg-red-600/80 text-white' : 'text-gray-400'}`}
                        >
                          Zaznaczenie ✓
                        </button>
                        <button
                          onClick={() => setReelMarkerEnabled(false)}
                          className={`flex-1 text-center py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${!reelMarkerEnabled ? 'bg-white/20 text-white' : 'text-gray-400'}`}
                        >
                          Bez zaznaczenia
                        </button>
                      </div>

                      {reelMarkerEnabled && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-gray-400 mb-1">
                              {t.markerScale} <span className="text-purple-400">{reelMarkerScale.toFixed(2)}</span>
                            </label>
                            <input type="range" min="0.3" max="2.0" step="0.05" value={reelMarkerScale} onChange={(e) => setReelMarkerScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-gray-400 mb-1">
                              {t.markerPosition} <span className="text-purple-400">{reelMarkerOffsetY > 0 ? '+' : ''}{reelMarkerOffsetY.toFixed(2)}</span>
                            </label>
                            <input type="range" min="-0.6" max="0.15" step="0.01" value={reelMarkerOffsetY} onChange={(e) => setReelMarkerOffsetY(parseFloat(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500" />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[11px] font-medium text-gray-400 mb-1">
                              {t.markerSeed} <span className="text-purple-400">#{reelMarkerSeed}</span>
                            </label>
                            <input type="range" min="1" max="100" step="1" value={reelMarkerSeed} onChange={(e) => setReelMarkerSeed(parseInt(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ═══ DESKTOP FORM ═══ */}
                    <div className="hidden sm:flex sm:flex-col px-5 py-3 space-y-3 flex-1 overflow-y-auto min-h-0">

                      {/* ── Nagłówek rolki ── */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1.5">{t.reelHeader}</label>
                        <input
                          type="text"
                          value={reelHeader}
                          onChange={(e) => setReelHeader(e.target.value)}
                          placeholder={t.reelHeaderPlaceholder}
                          className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/15 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
                        />
                      </div>

                      {/* ── Głos ── */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1.5">{t.voice}</label>
                        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
                          <button onClick={() => setReelVoice('male')} className={`flex-1 text-center py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${reelVoice === 'male' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>{t.voiceMale}</button>
                          <button onClick={() => setReelVoice('female')} className={`flex-1 text-center py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${reelVoice === 'female' ? 'bg-pink-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>{t.voiceFemale}</button>
                        </div>
                      </div>

                      {/* ── Przycisk CTA ── */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1.5">{t.reelCTA}</label>
                        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
                          <button onClick={() => setReelCTA('download')} className={`flex-1 text-center py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${reelCTA === 'download' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>{t.ctaDownload}</button>
                          <button onClick={() => setReelCTA('comment')} className={`flex-1 text-center py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${reelCTA === 'comment' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>{t.ctaComment}</button>
                        </div>
                      </div>

                      {/* ── Hasło CTA ── */}
                      {reelCTA === 'comment' && (
                        <div className="animate-fadeIn">
                          <label className="block text-xs font-medium text-gray-300 mb-1.5">{t.ctaPassword}</label>
                          <input
                            type="text"
                            value={reelCTAPassword}
                            onChange={(e) => setReelCTAPassword(e.target.value.toUpperCase())}
                            placeholder={t.ctaPasswordPlaceholder}
                            className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/15 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
                          />
                        </div>
                      )}

                      {/* ── Wariant CTA ── */}
                      {ctaOptionKeys.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-300 mb-1.5">{t.ctaOption}</label>
                          <div className="relative">
                            <select
                              value={selectedCtaKey}
                              onChange={(e) => setSelectedCtaKey(e.target.value)}
                              className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/15 rounded-xl text-white appearance-none cursor-pointer focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all pr-10"
                              style={{ backgroundImage: 'none' }}
                            >
                              {ctaOptionKeys.map((key) => (
                                <option key={key} value={key} className="bg-gray-800 text-white">
                                  (...) {reelCtaOptions[key]}
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      )}

                      {ctaOptionKeys.length === 0 && hasReelPage && (
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
                          <span className="text-xs text-amber-300">{t.noCtaOptions}</span>
                        </div>
                      )}

                      {/* ── Podgląd tekstu CTA ── */}
                      {ctaPreviewText && (
                        <div className="animate-fadeIn">
                          <label className="block text-xs font-medium text-gray-300 mb-1.5">{t.ctaTextPreview}</label>
                          <div className="relative px-3 py-2.5 text-sm bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-200 leading-relaxed min-h-[44px]">
                            <div className="absolute -top-px -right-px">
                              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                            </div>
                            {ctaPreviewText}
                          </div>
                        </div>
                      )}

                      {/* ── Tekst intro ── */}
                      <div className="border-t border-white/5 pt-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-gray-300">Tekst intro (TTS)</label>
                          {hasIntro && (
                            <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                              skonfigurowany
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setIsEditingIntro(true)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all cursor-pointer group ${
                            hasIntro
                              ? 'bg-purple-500/10 border-purple-500/25 hover:bg-purple-500/20'
                              : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
                          }`}
                        >
                          <div className="min-w-0 flex-1 text-left mr-2">
                            <span className={`text-sm ${hasIntro ? 'text-purple-200' : 'text-gray-400'}`}>
                              {hasIntro ? 'Edytuj tekst intro' : 'Dodaj tekst intro'}
                            </span>
                            {hasIntro && introPreviewSnippet && (
                              <p className="text-[10px] text-gray-500 truncate mt-0.5 leading-relaxed">{introPreviewSnippet}</p>
                            )}
                          </div>
                          <Pencil size={13} className={`flex-shrink-0 transition-transform group-hover:scale-110 ${hasIntro ? 'text-purple-400' : 'text-gray-500'}`} />
                        </button>
                      </div>

                      {/* ── Marker ── */}
                      <div className="border-t border-white/5 pt-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-gray-300">Zaznaczenie markera</label>
                          <button
                            onClick={() => setReelMarkerEnabled(!reelMarkerEnabled)}
                            className={`flex-shrink-0 w-10 h-5 rounded-full transition-colors relative cursor-pointer ${reelMarkerEnabled ? 'bg-red-500' : 'bg-white/15'}`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${reelMarkerEnabled ? 'left-5' : 'left-0.5'}`} />
                          </button>
                        </div>

                        {reelMarkerEnabled && (
                          <div className="space-y-2 animate-fadeIn">
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-medium text-gray-300">{t.markerScale}</label>
                                <span className="text-xs font-mono text-purple-400 bg-white/5 px-2 py-0.5 rounded">{reelMarkerScale.toFixed(2)}</span>
                              </div>
                              <input type="range" min="0.3" max="2.0" step="0.05" value={reelMarkerScale} onChange={(e) => setReelMarkerScale(parseFloat(e.target.value))} className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500" />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-medium text-gray-300">{t.markerPosition}</label>
                                <span className="text-xs font-mono text-purple-400 bg-white/5 px-2 py-0.5 rounded">{reelMarkerOffsetY > 0 ? '+' : ''}{reelMarkerOffsetY.toFixed(2)}</span>
                              </div>
                              <input type="range" min="-0.6" max="0.15" step="0.01" value={reelMarkerOffsetY} onChange={(e) => setReelMarkerOffsetY(parseFloat(e.target.value))} className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500" />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-medium text-gray-300">{t.markerSeed}</label>
                                <span className="text-xs font-mono text-purple-400 bg-white/5 px-2 py-0.5 rounded">#{reelMarkerSeed}</span>
                              </div>
                              <input type="range" min="1" max="100" step="1" value={reelMarkerSeed} onChange={(e) => setReelMarkerSeed(parseInt(e.target.value))} className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Generate Button ── */}
                    <div className="px-4 sm:px-5 py-3 border-t border-white/10 flex-shrink-0">
                      <button
                        onClick={handleGenerateReel}
                        disabled={!isReelFormValid() || reelGenerating}
                        className={`w-full py-2.5 sm:py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                          isReelFormValid() && !reelGenerating
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-900/30 active:scale-[0.98]'
                            : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                        }`}
                      >
                        {reelGenerating ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            {t.generating}
                          </span>
                        ) : t.generate}
                      </button>
                      {reelGenerating && (
                        <p className="text-purple-300/80 text-xs text-center mt-3 leading-relaxed px-2">{t.generatingMessage}</p>
                      )}
                      {reelGenerateError && (
                        <p className="text-red-400 text-xs text-center mt-2">{reelGenerateError}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}