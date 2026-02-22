#!/usr/bin/env node

/**
 * Voice Modulation Reel Generator v9 — "Grounded Echo + Captions"
 *
 * Bazuje na v8 (Grounded Echo), dodaje:
 * - Napisy (captions) wyświetlane w 2 liniach powyżej fali modulacji
 * - Podświetlanie aktualnie wymawianego słowa
 * - Automatyczna konwersja character-level timestamps → word-level timestamps
 * - Inteligentny podział tekstu na 2-liniowe segmenty
 */

const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;

// ─── Font Registration ───────────────────────────────────────────────────────

function registerFonts() {
  // Ścieżki szukania fontów (w kolejności priorytetu)
  const searchPaths = [
    path.join(SCRIPT_DIR, 'fonts'),                              // reels/fonts/ (kontener)
    path.join(SCRIPT_DIR, '..', 'public', 'fonts', 'Inter', 'static'), // public/fonts/Inter/static/
  ];

  const fontPairs = [
    { file: 'Inter_28pt-Medium.ttf', weight: 500 },
    { file: 'Inter_28pt-Bold.ttf', weight: 700 },
  ];

  let fontsDir = null;
  for (const dir of searchPaths) {
    if (fs.existsSync(path.join(dir, fontPairs[0].file))) {
      fontsDir = dir;
      break;
    }
  }

  if (!fontsDir) {
    console.error('❌ Brak fontów Inter! Szukano w:');
    searchPaths.forEach(p => console.error(`   - ${p}`));
    console.error(`   Potrzebne: ${fontPairs.map(f => f.file).join(', ')}`);
    process.exit(1);
  }

  console.log(`📁 Fonty: ${fontsDir}`);
  for (const { file } of fontPairs) {
    GlobalFonts.registerFromPath(path.join(fontsDir, file), 'Inter');
    console.log(`   ✅ ${file}`);
  }
}

registerFonts();

// ─── Configuration ───────────────────────────────────────────────────────────

const CONFIG = {
  defaultInput: path.join(SCRIPT_DIR, 'speech.mp3'),
  defaultTimestamps: path.join(SCRIPT_DIR, 'tts_1770575454961_timestamps.json'),
  defaultRawText: path.join(SCRIPT_DIR, 'tts_1770575454961_rawtext.txt'),

  width: 1080,
  height: 1920,
  fps: 30,
  paddingSeconds: 1.0,
  trailingPaddingSeconds: 5.0,   // dodatkowe sekundy po audio na CTA
  finalVideoSpeed: 1.2,          // finalna prędkość video (post-processing, 0.5-2.0)

  backgroundColor: '#FFFFFF',
  yPositionRatio: 0.88,

  // Nagłówek nad cover image
  header: {
    text: 'Ebook, którego potrzebujesz',
    fontSize: 64,
    fontFamily: 'Inter',
    fontWeight: 700,
    color: '#7c3aed',           // purple-600 (jak linia modulacji)
    borderColor: '#5b21b6',     // purple-800 (ciemniejszy odcień)
    borderWidth: 2.5,
    paddingX: 52,
    paddingY: 26,
    borderRadius: 0,
    yPosition: 0.035,           // ratio od góry ekranu
  },

  // Cover image
  cover: {
    searchPaths: [
      path.join(SCRIPT_DIR, 'sample_cover.png'),
      path.join(SCRIPT_DIR, '..', 'public', 'sample_cover.png'),
    ],
    topPadding: 0.07,            // tuż pod nagłówkiem, bez dodatkowego marginesu
    bottomGap: 0.0,
    scale: 0.93,                // lekko zmniejszony
  },

  // Marker (zakreślenie flamastrem na cover image)
  marker: {
    enabled: true,
    seed: 42,             // seed dla kształtu (zmień = inny kształt)

    // Pozycja i rozmiar — jako ratio względem cover image (0-1)
    centerX: 0.50,        // środek X w cover image
    centerY: 0.72,        // środek Y w cover image
    radiusX: 0.42,        // promień X (% szerokości cover)
    radiusY: 0.12,        // promień Y (% wysokości cover)

    // Timing (w sekundach audio, 0 = start mowy)
    showAtAudioTime: 0.0, // kiedy zaczyna się rysowanie
    drawDuration: 1.8,    // czas animacji rysowania (wolniej = bardziej ludzko)
    hideAtAudioTime: null, // null = nie chowaj (zostaje do końca)

    // Styl flamastra
    baseWidth: 22,        // grubość bazowa (gruby marker)
    color: '#dc2626',     // red-600
    highlightColor: '#ef4444', // red-500
    glowColor: '#fca5a5', // red-300

    // Pulsowanie
    pulse: {
      frequency: 1.2,
      opacityAmount: 0.12,
      scaleAmount: 0.012,
    },
  },

  analysis: {
    sampleRate: 44100,
    fftSize: 2048,
    attackFactor: 0.2,
    decayFactor: 0.85,
    smoothing: 0.8,
  },

  waves: {
    count: 6,
    resolution: 300,
    maxAmplitude: 360,
    baseSpeed: 2.0,
    echoSpread: 0.15,
    colors: [
      '#7c3aed',
      '#a855f7',
      '#d946ef',
      '#c026d3',
    ],
  },

  captions: {
    // Pozycja tekstu — środek Y dwóch linii (jako ratio od góry ekranu)
    yPositionRatio: 0.72,
    lineSpacing: 1.35,           // Interlinia (mnożnik rozmiaru fontu)

    fontSize: 68,
    fontFamily: 'Inter',
    fontWeightNormal: 500,
    fontWeightActive: 700,

    // Kolory
    inactiveColor: 'rgba(0, 0, 0, 0.25)',     // Słowa jeszcze nie wypowiedziane
    spokenColor: 'rgba(0, 0, 0, 0.25)',        // Słowa już wypowiedziane
    activeColor: '#7c3aed',                     // Aktualnie wymawiane słowo

    // Max znaków na linię (orientacyjnie, do dzielenia segmentów)
    maxCharsPerLine: 22,

    // Animacja: czas fade-in/out segmentu (sekundy)
    segmentFadeTime: 0.15,
  },

  // ─── CTA Button Transformation ───
  cta: {
    // Kiedy (w sekundach audio) zaczyna się transformacja fali → przycisk
    transformAtAudioTime: 10,
    // Czas trwania animacji transformacji (sekundy)
    transformDuration: 2.0,

    // Tekst przycisku
    text: 'Pobierz darmowy E-BOOK',
    fontSize: 42,
    fontFamily: 'Inter',
    fontWeight: 600,

    // Wymiary przycisku
    widthRatio: 0.78,   // 78% szerokości ekranu
    height: 120,
    borderRadius: 16,

    // Gradient (from-purple-600 to-indigo-600)
    gradientFrom: '#9333ea',
    gradientTo: '#4f46e5',
    textColor: '#FFFFFF',

    // Cień
    shadowColor: 'rgba(79, 70, 229, 0.4)',
    shadowBlur: 24,
    shadowOffsetY: 8,

    // Pulsowanie po pojawieniu się
    pulse: {
      frequency: 0.5,        // pulsów na sekundę
      scaleAmount: 0.04,     // +/- 4% skali
      glowAmount: 12,        // dodatkowy blur cienia w szczytach
    },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function q(p) { return `"${p}"`; }
function clamp(v, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }
function smoothstep(x) { x = clamp(x); return x * x * (3 - 2 * x); }

// ─── Cover Image ─────────────────────────────────────────────────────────────

async function loadCoverImage() {
  for (const p of CONFIG.cover.searchPaths) {
    if (fs.existsSync(p)) {
      console.log(`🖼️  Cover: ${p}`);
      return await loadImage(p);
    }
  }
  console.warn('⚠️  Brak cover image, pomijam');
  return null;
}

function renderCoverImage(ctx, width, height, coverImg, growProgress) {
  if (!coverImg) return null;
  growProgress = growProgress || 0;

  const cap = CONFIG.captions;
  const cover = CONFIG.cover;
  const cta = CONFIG.cta;
  const scale = cover.scale || 1.0;

  // Obszar dostępny: od topPadding do dolnej granicy
  const topY = height * cover.topPadding;
  const captionTopY = height * cap.yPositionRatio - cap.fontSize * cap.lineSpacing;
  const normalBottom = captionTopY - height * cover.bottomGap;

  // Rozszerzona dolna granica: tuż nad przyciskiem CTA (z 30px gapem)
  const ctaCenterY = height * CONFIG.yPositionRatio;
  const expandedBottom = ctaCenterY - cta.height / 2 - 30;

  // Interpolacja dolnej granicy
  const bottomY = normalBottom + (expandedBottom - normalBottom) * growProgress;
  const availableHeight = bottomY - topY;

  if (availableHeight <= 0) return null;

  // Skaluj proporcjonalnie: dopasuj do szerokości lub wysokości
  const imgAspect = coverImg.width / coverImg.height;
  const areaAspect = width / availableHeight;

  let drawW, drawH;
  if (imgAspect > areaAspect) {
    drawW = width;
    drawH = width / imgAspect;
  } else {
    drawH = availableHeight;
    drawW = availableHeight * imgAspect;
  }

  // Skalowanie: interpoluj od zmniejszonego do pełnego przy grow
  const effectiveScale = scale + (1.0 - scale) * growProgress;
  drawW *= effectiveScale;
  drawH *= effectiveScale;

  // Wycentruj w dostępnym obszarze
  const drawX = (width - drawW) / 2;
  const drawY = topY + (availableHeight - drawH) / 2;

  ctx.drawImage(coverImg, drawX, drawY, drawW, drawH);

  // Zwróć bounds dla markera
  return { x: drawX, y: drawY, w: drawW, h: drawH };
}

// ─── Header (nagłówek nad cover image) ───────────────────────────────────────

function renderHeader(ctx, width, height) {
  const h = CONFIG.header;
  const y = height * h.yPosition;

  ctx.save();
  ctx.font = `${h.fontWeight} ${h.fontSize}px ${h.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const tm = ctx.measureText(h.text);
  const boxW = tm.width + h.paddingX * 2;
  const boxH = h.fontSize + h.paddingY * 2;
  const boxX = (width - boxW) / 2;
  const r = h.borderRadius;

  // Rounded rect border
  ctx.beginPath();
  ctx.moveTo(boxX + r, y);
  ctx.lineTo(boxX + boxW - r, y);
  ctx.arcTo(boxX + boxW, y, boxX + boxW, y + r, r);
  ctx.lineTo(boxX + boxW, y + boxH - r);
  ctx.arcTo(boxX + boxW, y + boxH, boxX + boxW - r, y + boxH, r);
  ctx.lineTo(boxX + r, y + boxH);
  ctx.arcTo(boxX, y + boxH, boxX, y + boxH - r, r);
  ctx.lineTo(boxX, y + r);
  ctx.arcTo(boxX, y, boxX + r, y, r);
  ctx.closePath();

  ctx.strokeStyle = h.borderColor;
  ctx.lineWidth = h.borderWidth;
  ctx.stroke();

  // Tekst
  ctx.fillStyle = h.color;
  ctx.fillText(h.text, width / 2, y + boxH / 2);

  ctx.restore();
}

// ─── Marker (zakreślenie flamastrem) ────────────────────────────────────────

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function generateMarkerPath(coverBounds) {
  const m = CONFIG.marker;
  if (!m.enabled || !coverBounds) return null;

  const rng = seededRandom(m.seed);

  const cx = coverBounds.x + coverBounds.w * m.centerX;
  const cy = coverBounds.y + coverBounds.h * m.centerY;
  const rx = coverBounds.w * m.radiusX;
  const ry = coverBounds.h * m.radiusY;

  // Mało punktów kontrolnych = gładkie krzywe Beziera
  const N = 10;
  const controlPoints = [];
  const tilt = (rng() - 0.5) * 0.2;

  // Nie domykaj — ~90% okręgu
  const arcSpan = Math.PI * 2 * (0.88 + rng() * 0.06);
  // Start z lewego górnego rogu (~225°), kierunek: przeciwnie do zegara
  const startAngle = -Math.PI * 0.75;

  for (let i = 0; i <= N; i++) {
    const t = startAngle - (i / N) * arcSpan;  // minus = counter-clockwise
    const radiusNoise = 1 + (rng() - 0.5) * 0.12;
    const angleNoise = (rng() - 0.5) * 0.12;
    const x = cx + Math.cos(t + tilt + angleNoise) * rx * radiusNoise;
    const y = cy + Math.sin(t + tilt + angleNoise) * ry * radiusNoise;

    // Grubość oparta na postępie rysowania (i/N), NIE na kącie geometrycznym
    const drawRatio = i / N;  // 0=start, 1=koniec
    // Naturalny profil nacisku ręki: grubiej na początku, fala w środku, cieniej na końcu
    const pressureBase = 0.7 + 0.3 * Math.cos(drawRatio * Math.PI * 1.5);
    const pressureNoise = 1 + (rng() - 0.5) * 0.45;
    // Początek: dociśnięcie markera do papieru (grubszy)
    const startBoost = i < 2 ? 1.3 : 1.0;
    // Koniec: odrywanie markera (stopniowo cieńszy — ostatnie 3 punkty)
    const endTaper = i > N - 3 ? 0.2 + 0.8 * ((N - i) / 3) : 1.0;
    const pressure = pressureBase * pressureNoise * startBoost * endTaper;

    controlPoints.push({ x, y, pressure });
  }

  // Gęsta interpolacja Catmull-Rom
  const dense = [];
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

  let totalLen = 0;
  for (let i = 1; i < dense.length; i++) {
    const dx = dense[i].x - dense[i-1].x, dy = dense[i].y - dense[i-1].y;
    totalLen += Math.sqrt(dx*dx + dy*dy);
  }

  console.log(`🖊️  Marker: center=(${Math.round(cx)},${Math.round(cy)}) r=(${Math.round(rx)}×${Math.round(ry)}) ${dense.length} pts, ${Math.round(totalLen)}px`);
  return { pts: dense, totalLen, cx, cy };
}

function renderMarker(ctx, markerData, audioTime) {
  if (!markerData) return;
  const m = CONFIG.marker;

  const drawStart = m.showAtAudioTime;
  const drawEnd = drawStart + m.drawDuration;
  if (audioTime < drawStart) return;

  let fadeOut = 1.0;
  if (m.hideAtAudioTime !== null && audioTime > m.hideAtAudioTime) {
    fadeOut = 1 - clamp((audioTime - m.hideAtAudioTime) / 0.3);
    if (fadeOut <= 0) return;
  }

  const rawProgress = clamp((audioTime - drawStart) / m.drawDuration);
  // Ease-in-out: ruch ręki — przyspieszenie na start, zwolnienie na koniec
  const drawProgress = rawProgress < 0.5
    ? 2 * rawProgress * rawProgress
    : 1 - Math.pow(-2 * rawProgress + 2, 2) / 2;
  const isFullyDrawn = rawProgress >= 1.0;

  let pulseOpacity = 0.90;
  let pulseScale = 1.0;
  const ctaStart = CONFIG.cta.transformAtAudioTime;
  if (isFullyDrawn) {
    const pulseTime = audioTime - drawEnd;
    // Puls zanika gdy zbliża się CTA (fade-out 0.5s przed transformacją)
    const pulseKill = 1 - clamp((audioTime - (ctaStart - 0.5)) / 0.5);
    const easeIn = clamp(pulseTime / 0.5);
    const wave = Math.sin(pulseTime * Math.PI * 2 * m.pulse.frequency);
    pulseOpacity = 0.90 + wave * m.pulse.opacityAmount * easeIn * pulseKill;
    pulseScale = 1.0 + wave * m.pulse.scaleAmount * easeIn * pulseKill;
  }

  const alpha = pulseOpacity * fadeOut;
  // Płynne znikanie markera podczas transformacji CTA (0.6s)
  const ctaFade = 1 - clamp((audioTime - ctaStart) / 0.6);
  const finalAlpha = alpha * ctaFade;
  if (finalAlpha <= 0) return;

  const pts = markerData.pts;
  const totalPts = Math.max(2, Math.floor(pts.length * drawProgress));

  ctx.save();

  // Config overrides: scale + offsetY z modala (identycznie jak SVG transform w preview)
  const renderScale = CONFIG.marker.renderScale || 1.0;
  const renderOffsetY = CONFIG.marker.renderOffsetY || 0.0;
  if (renderScale !== 1.0 || renderOffsetY !== 0.0) {
    const pivotX = markerData.cx;
    const pivotY = markerData.cy;
    const offsetPx = renderOffsetY * (markerData.coverH || 0);
    ctx.translate(pivotX, pivotY + offsetPx);
    ctx.scale(renderScale, renderScale);
    ctx.translate(-pivotX, -pivotY);
  }

  if (pulseScale !== 1.0) {
    ctx.translate(markerData.cx, markerData.cy);
    ctx.scale(pulseScale, pulseScale);
    ctx.translate(-markerData.cx, -markerData.cy);
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Pass 1: gruba baza (cień flamastra)
  for (let i = 0; i < totalPts - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    const avgP = (p1.pressure + p2.pressure) / 2;
    ctx.globalAlpha = finalAlpha * 0.35;
    ctx.lineWidth = m.baseWidth * avgP;
    ctx.strokeStyle = m.color;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    if (i + 2 < totalPts) {
      const p3 = pts[i + 2];
      ctx.quadraticCurveTo(p2.x, p2.y, (p2.x + p3.x) / 2, (p2.y + p3.y) / 2);
    } else {
      ctx.lineTo(p2.x, p2.y);
    }
    ctx.stroke();
  }

  // Pass 2: jaśniejszy rdzeń
  for (let i = 0; i < totalPts - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    const avgP = (p1.pressure + p2.pressure) / 2;
    ctx.globalAlpha = finalAlpha * 0.5;
    ctx.lineWidth = m.baseWidth * avgP * 0.5;
    ctx.strokeStyle = m.highlightColor;
    ctx.beginPath();
    ctx.moveTo(p1.x + 0.3, p1.y + 0.3);
    if (i + 2 < totalPts) {
      const p3 = pts[i + 2];
      ctx.quadraticCurveTo(p2.x + 0.3, p2.y + 0.3, (p2.x + p3.x)/2 + 0.3, (p2.y + p3.y)/2 + 0.3);
    } else {
      ctx.lineTo(p2.x + 0.3, p2.y + 0.3);
    }
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Word Timestamps Builder ─────────────────────────────────────────────────

function buildWordTimestamps(timestampsPath, rawTextPath) {
  console.log('📝 Budowanie word-level timestamps...');

  const tsData = JSON.parse(fs.readFileSync(timestampsPath, 'utf-8'));
  const rawText = fs.readFileSync(rawTextPath, 'utf-8').trim();

  // Odfiltruj padding (kropki na początku/końcu)
  let firstRealIdx = 0;
  for (let i = 0; i < tsData.timestamps.length; i++) {
    if (tsData.timestamps[i].character !== '.') { firstRealIdx = i; break; }
  }
  let lastRealIdx = tsData.timestamps.length - 1;
  for (let i = tsData.timestamps.length - 1; i >= 0; i--) {
    if (tsData.timestamps[i].character !== '.') { lastRealIdx = i; break; }
  }

  const realChars = tsData.timestamps.slice(firstRealIdx, lastRealIdx + 1);

  // Buduj słowa z char timestamps
  const words = [];
  let currentWord = '';
  let wordStart = null;
  let wordEnd = null;

  for (let i = 0; i < realChars.length; i++) {
    const c = realChars[i];
    if (c.character === ' ') {
      if (currentWord.length > 0) {
        words.push({ text: currentWord, start_time: wordStart, end_time: wordEnd });
        currentWord = '';
        wordStart = null;
        wordEnd = null;
      }
    } else {
      if (wordStart === null) wordStart = c.start_time;
      wordEnd = c.end_time;
      currentWord += c.character;
    }
  }
  if (currentWord.length > 0) {
    words.push({ text: currentWord, start_time: wordStart, end_time: wordEnd });
  }

  // Wyczyść tekst ze znaków specjalnych do wyświetlania
  words.forEach(w => {
    w.display = w.text.replace(/^["„"]+|["„"]+$/g, '').replace(/["""]/g, '');
  });

  // ── Wykryj ostatni [short pause] → moment startu CTA ──
  let lastPauseTime = null;
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i].text.startsWith('[') || words[i].text.endsWith(']')) {
      if (lastPauseTime === null) {
        lastPauseTime = words[i].end_time;
      }
    }
  }
  if (lastPauseTime !== null) {
    CONFIG.cta.transformAtAudioTime = lastPauseTime;
    console.log(`   🎯 CTA trigger z ostatniego [pause] @ ${lastPauseTime.toFixed(2)}s`);
  } else {
    console.log(`   ⚠️  Brak [pause] w tekście, CTA @ ${CONFIG.cta.transformAtAudioTime}s (domyślne)`);
  }

  // ── Odfiltruj dyrektywy [short pause] itp. z napisów ──
  const filtered = words.filter(w => !w.text.startsWith('[') && !w.text.endsWith(']'));

  console.log(`   Znaleziono ${filtered.length} słów (odfiltrowano ${words.length - filtered.length} dyrektyw)`);
  return filtered;
}

// ─── Caption Segment Builder ─────────────────────────────────────────────────

function buildCaptionSegments(words) {
  const maxChars = CONFIG.captions.maxCharsPerLine;
  const segments = [];

  // Najpierw znajdź naturalne punkty łamania (koniec zdania: ., !, ?)
  const sentenceBreaks = new Set();
  for (let i = 0; i < words.length; i++) {
    const d = words[i].display;
    if (d.endsWith('.') || d.endsWith('!') || d.endsWith('?')) {
      sentenceBreaks.add(i + 1); // łam PO tym słowie
    }
  }

  let i = 0;
  while (i < words.length) {
    const segWords = [];
    let totalChars = 0;
    const maxTotal = maxChars * 2 + 4;

    while (i < words.length && totalChars + words[i].display.length + 1 <= maxTotal) {
      segWords.push(i);
      totalChars += words[i].display.length + 1;
      i++;

      // Jeśli trafiliśmy na koniec zdania i mamy już ≥3 słowa, łamiemy segment
      if (sentenceBreaks.has(i) && segWords.length >= 3) {
        break;
      }
    }

    if (segWords.length === 0) { segWords.push(i); i++; }

    // Podziel segment na 2 linie — szukaj najlepszego podziału
    let bestSplit = Math.ceil(segWords.length / 2);
    let bestDiff = Infinity;

    for (let s = 1; s < segWords.length; s++) {
      const line1 = segWords.slice(0, s).map(idx => words[idx].display).join(' ');
      const line2 = segWords.slice(s).map(idx => words[idx].display).join(' ');
      const diff = Math.abs(line1.length - line2.length);

      if (diff < bestDiff) {
        bestDiff = diff;
        bestSplit = s;
      }
    }

    segments.push({
      wordIndices: segWords,
      line1: segWords.slice(0, bestSplit),
      line2: segWords.slice(bestSplit),
      start_time: words[segWords[0]].start_time,
      end_time: words[segWords[segWords.length - 1]].end_time,
    });
  }

  console.log(`   Utworzono ${segments.length} segmentów napisów:`);
  segments.forEach((seg, idx) => {
    const l1 = seg.line1.map(i => words[i].display).join(' ');
    const l2 = seg.line2.map(i => words[i].display).join(' ');
    console.log(`   [${idx}] "${l1}" / "${l2}" (${seg.start_time.toFixed(2)}s - ${seg.end_time.toFixed(2)}s)`);
  });

  return segments;
}

// ─── Audio Analysis ──────────────────────────────────────────────────────────

function extractPCM(inputPath) {
  console.log('📊 Ekstrakcja PCM...');
  const rawPath = inputPath + '.raw';
  execSync(`ffmpeg -y -v error -i ${q(inputPath)} -ac 1 -ar ${CONFIG.analysis.sampleRate} -f f32le -acodec pcm_f32le ${q(rawPath)}`, { stdio: 'inherit' });
  const buf = fs.readFileSync(rawPath);
  fs.unlinkSync(rawPath);
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}

function findGlobalMaxRms(samples) {
  const sr = CONFIG.analysis.sampleRate;
  const hop = Math.floor(sr / CONFIG.fps);
  const win = Math.floor(sr * 0.05);
  let maxRms = 0;
  for (let i = 0; i < samples.length; i += hop) {
    let sq = 0, c = 0;
    for (let j = Math.max(0, i - win); j < Math.min(samples.length, i + win); j++) { sq += samples[j] * samples[j]; c++; }
    maxRms = Math.max(maxRms, Math.sqrt(sq / (c || 1)));
  }
  return maxRms || 0.1;
}

class Analyzer {
  constructor() { this.rms = 0; }

  update(samples, audioTime, globalMaxRms) {
    const { sampleRate, attackFactor, decayFactor } = CONFIG.analysis;
    const center = Math.floor(audioTime * sampleRate);
    const winSize = Math.floor(sampleRate * 0.04);
    let sq = 0, count = 0;
    for (let i = Math.max(0, center - winSize); i < Math.min(samples.length, center + winSize); i++) {
      sq += samples[i] * samples[i]; count++;
    }
    const currentRms = Math.sqrt(sq / (count || 1));
    const target = clamp(currentRms / globalMaxRms, 0, 1.0);
    if (target > this.rms) this.rms += (target - this.rms) * attackFactor;
    else this.rms += (target - this.rms) * decayFactor;
  }

  getValue() { return this.rms; }
}

// ─── Wave Rendering (unchanged from v8) ──────────────────────────────────────

function catmullRom(ctx, pts) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) { ctx.lineTo(pts[1].x, pts[1].y); return; }

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const t = 0.5;
    const cp1x = p1.x + (p2.x - p0.x) / 6 * t;
    const cp1y = p1.y + (p2.y - p0.y) / 6 * t;
    const cp2x = p2.x - (p3.x - p1.x) / 6 * t;
    const cp2y = p2.y - (p3.y - p1.y) / 6 * t;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
}

function renderEchoWaves(ctx, width, height, rms, time, ctaProgress) {
  const { waves, yPositionRatio } = CONFIG;
  const centerY = height * yPositionRatio;
  const cta = CONFIG.cta;

  // ── CTA morph phases ──
  const p1 = smoothstep(clamp(ctaProgress / 0.30));           // Collapse: amplitude → 0, layers merge
  const p2 = smoothstep(clamp((ctaProgress - 0.30) / 0.20));  // Contract: line shrinks to button width
  const p3 = smoothstep(clamp((ctaProgress - 0.50) / 0.20));  // Expand: line → rounded rect with fill
  const p4 = smoothstep(clamp((ctaProgress - 0.70) / 0.30));  // Polish: text + shadow fade in

  // ── Button geometry ──
  const btnW = width * cta.widthRatio;
  const btnH = cta.height;
  const btnLeft = (width - btnW) / 2;
  const btnRight = btnLeft + btnW;
  const btnTop = centerY - btnH / 2;

  // ── Phase 3+4: Draw button (underneath waves during transition) ──
  if (p3 > 0) {
    ctx.save();

    // ── Pulse after full appearance ──
    const pulse = cta.pulse;
    const isFullyFormed = ctaProgress >= 1.0;
    let pulseScale = 1.0;
    let pulseGlow = 0;

    if (isFullyFormed) {
      // Czas od zakończenia transformacji
      const ctaEndTime = cta.transformAtAudioTime + cta.transformDuration;
      const pulseTime = time - CONFIG.paddingSeconds - ctaEndTime;
      if (pulseTime > 0) {
        const wave = Math.sin(pulseTime * Math.PI * 2 * pulse.frequency);
        // Ease-in pulse (narasta przez pierwszą sekundę)
        const pulseEaseIn = clamp(pulseTime / 1.0);
        pulseScale = 1.0 + wave * pulse.scaleAmount * pulseEaseIn;
        pulseGlow = ((wave + 1) / 2) * pulse.glowAmount * pulseEaseIn;  // 0..glowAmount
      }
    }

    // Transformacja skalowania — od centrum przycisku
    ctx.translate(width / 2, centerY);
    ctx.scale(pulseScale, pulseScale);
    ctx.translate(-width / 2, -centerY);

    // Rect grows vertically: from 3px line height to full button height
    const rectH = 3 + (btnH - 3) * p3;
    const rectY = centerY - rectH / 2;
    const radius = cta.borderRadius * p3;

    // Shadow fades in during phase 4 + pulse glow
    if (p4 > 0) {
      ctx.shadowColor = cta.shadowColor;
      ctx.shadowBlur = (cta.shadowBlur + pulseGlow) * p4;
      ctx.shadowOffsetY = cta.shadowOffsetY * p4;
    }

    // Gradient fill — opacity ramps with p3
    const grad = ctx.createLinearGradient(btnLeft, 0, btnRight, 0);
    grad.addColorStop(0, cta.gradientFrom);
    grad.addColorStop(1, cta.gradientTo);

    ctx.globalAlpha = p3;
    ctx.fillStyle = grad;

    // Rounded rect
    ctx.beginPath();
    ctx.moveTo(btnLeft + radius, rectY);
    ctx.lineTo(btnRight - radius, rectY);
    ctx.arcTo(btnRight, rectY, btnRight, rectY + radius, radius);
    ctx.lineTo(btnRight, rectY + rectH - radius);
    ctx.arcTo(btnRight, rectY + rectH, btnRight - radius, rectY + rectH, radius);
    ctx.lineTo(btnLeft + radius, rectY + rectH);
    ctx.arcTo(btnLeft, rectY + rectH, btnLeft, rectY + rectH - radius, radius);
    ctx.lineTo(btnLeft, rectY + radius);
    ctx.arcTo(btnLeft, rectY, btnLeft + radius, rectY, radius);
    ctx.closePath();
    ctx.fill();

    // Reset shadow before text
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Text fades in during phase 4
    if (p4 > 0) {
      ctx.globalAlpha = p4;
      ctx.fillStyle = cta.textColor;
      ctx.font = `${cta.fontWeight} ${cta.fontSize}px ${cta.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cta.text, width / 2, centerY);
    }

    ctx.restore();
  }

  // ── Waves (fade out as button appears) ──
  // Don't draw waves once button is fully formed
  if (p3 >= 1) return;

  // Reference line — fades during phase 1
  if (p1 < 1) {
    ctx.save();
    ctx.beginPath();
    ctx.globalAlpha = 1 - p1;
    const refLeft = p2 > 0 ? btnLeft * p2 + 0 * (1 - p2) : 0;
    const refRight = p2 > 0 ? btnRight * p2 + width * (1 - p2) : width;
    ctx.moveTo(refLeft, centerY);
    ctx.lineTo(refRight, centerY);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
    ctx.stroke();
    ctx.restore();
  }

  const energy = Math.pow(rms, 1.2);
  const baseAmp = waves.maxAmplitude * energy + (waves.maxAmplitude * 0.05);

  // Amplitude collapses during phase 1
  const morphedAmp = baseAmp * (1 - p1);

  // During contraction (phase 2), all waves rendered as one
  const effectiveCount = p2 > 0 ? 1 : waves.count;
  // Wave opacity decreases as button fills in (phase 3)
  const waveOpacity = 1 - p3;

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  waves.colors.forEach((col, idx) => {
    gradient.addColorStop(idx / (waves.colors.length - 1), col);
  });

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < effectiveCount; i++) {
    const layerRatio = effectiveCount > 1 ? i / (effectiveCount - 1) : 0;

    // Echo spread collapses during phase 1
    const morphedSpread = waves.echoSpread * (1 - p1);
    const phaseOffset = i * morphedSpread;
    const ampFactor = 1.0 - (layerRatio * 0.4 * (1 - p1));

    // Line width converges to 2.5 during phase 1, then grows during phase 2
    const baseLineWidth = 2.5 - (layerRatio * 1.5 * (1 - p1));
    ctx.lineWidth = baseLineWidth + p2 * 1.5;

    // Alpha: all layers → 1.0 during phase 1, then fade with waveOpacity
    const baseAlpha = 1.0 - (layerRatio * 0.6 * (1 - p1));
    ctx.globalAlpha = baseAlpha * waveOpacity;
    ctx.strokeStyle = gradient;

    const points = [];

    // X range contracts from [0, width] to [btnLeft, btnRight] during phase 2
    const xStart = 0 + (btnLeft - 0) * p2;
    const xEnd = width + (btnRight - width) * p2;
    const xRange = xEnd - xStart;

    for (let x = 0; x <= waves.resolution; x++) {
      const frac = x / waves.resolution;
      const xPos = xStart + frac * xRange;
      const normX = (frac - 0.5) * 2;
      const fade = Math.pow(Math.cos(normX * Math.PI * 0.5), 2.5);
      const travel = time * waves.baseSpeed;
      const sine1 = Math.sin(frac * Math.PI * 4 + travel - phaseOffset);
      const sine2 = Math.sin(frac * Math.PI * 10 + travel * 1.5 + phaseOffset);
      const waveShape = (sine1 * 0.7 + sine2 * 0.3);
      const displacement = waveShape * morphedAmp * ampFactor * fade;
      points.push({ x: xPos, y: centerY + displacement });
    }

    ctx.beginPath();
    catmullRom(ctx, points);
    ctx.stroke();
  }

  ctx.globalAlpha = 1.0;
}

// ─── Caption Rendering ───────────────────────────────────────────────────────

function renderCaptions(ctx, width, height, audioTime, words, segments) {
  const cap = CONFIG.captions;
  const centerY = height * cap.yPositionRatio;

  // Znajdź aktywny segment
  let activeSegIdx = -1;
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    const segStart = words[seg.wordIndices[0]].start_time;
    const nextSegStart = (s + 1 < segments.length) ? words[segments[s + 1].wordIndices[0]].start_time : Infinity;

    if (audioTime >= segStart - 0.05 && audioTime < nextSegStart - 0.05) {
      activeSegIdx = s;
      break;
    }
  }

  if (activeSegIdx < 0) return;

  const seg = segments[activeSegIdx];

  // Oblicz fade segmentu
  const segStart = words[seg.wordIndices[0]].start_time;
  const segEnd = words[seg.wordIndices[seg.wordIndices.length - 1]].end_time;
  const nextStart = (activeSegIdx + 1 < segments.length)
    ? words[segments[activeSegIdx + 1].wordIndices[0]].start_time
    : segEnd + 1;

  let segAlpha = 1.0;
  const fadeIn = audioTime - segStart;
  const fadeOut = nextStart - audioTime;
  if (fadeIn < cap.segmentFadeTime) segAlpha = clamp(fadeIn / cap.segmentFadeTime);
  if (fadeOut < cap.segmentFadeTime) segAlpha = clamp(fadeOut / cap.segmentFadeTime);

  ctx.save();
  ctx.globalAlpha = segAlpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lineHeight = cap.fontSize * cap.lineSpacing;

  // Rysuj obie linie
  const lines = [seg.line1, seg.line2];
  const totalLinesHeight = lines.length * lineHeight;
  const startY = centerY - totalLinesHeight / 2 + lineHeight / 2;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineWords = lines[lineIdx];
    if (lineWords.length === 0) continue;

    const y = startY + lineIdx * lineHeight;
    const wordTexts = lineWords.map(i => words[i].display);
    const space = ' ';

    // Faza 1: Zmierz każde słowo indywidualnie (z właściwą wagą)
    const wordMeasurements = [];
    let totalLineWidth = 0;

    ctx.font = `${cap.fontWeightNormal} ${cap.fontSize}px ${cap.fontFamily}`;
    const spaceWidth = ctx.measureText(space).width;

    for (let wi = 0; wi < lineWords.length; wi++) {
      const wordIdx = lineWords[wi];
      const word = words[wordIdx];
      const display = word.display;
      const isActive = audioTime >= word.start_time && audioTime < word.end_time + 0.05;

      const weight = isActive ? cap.fontWeightActive : cap.fontWeightNormal;
      ctx.font = `${weight} ${cap.fontSize}px ${cap.fontFamily}`;
      const w = ctx.measureText(display).width;

      wordMeasurements.push({ display, wordIdx, isActive, weight, width: w });
      totalLineWidth += w;
      if (wi < lineWords.length - 1) totalLineWidth += spaceWidth;
    }

    // Faza 2: Rysuj z prawidłowym centrowaniem
    let x = (width - totalLineWidth) / 2;

    for (let wi = 0; wi < wordMeasurements.length; wi++) {
      const wm = wordMeasurements[wi];
      const word = words[wm.wordIdx];
      const isSpoken = audioTime >= word.end_time + 0.05;

      if (wm.isActive) {
        ctx.fillStyle = cap.activeColor;
      } else if (isSpoken) {
        ctx.fillStyle = cap.spokenColor;
      } else {
        ctx.fillStyle = cap.inactiveColor;
      }

      ctx.font = `${wm.weight} ${cap.fontSize}px ${cap.fontFamily}`;
      ctx.textAlign = 'left';
      ctx.fillText(wm.display, x, y);

      x += wm.width + spaceWidth;
    }
  }

  ctx.restore();
}

// ─── Frame Rendering ─────────────────────────────────────────────────────────

function renderFrame(ctx, analyzer, time, words, segments, coverImg, markerData) {
  const { width, height, backgroundColor } = CONFIG;
  const cta = CONFIG.cta;

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const audioTime = time - CONFIG.paddingSeconds;

  // CTA progress: 0 = czysta fala, 1 = pełny przycisk
  const ctaStart = cta.transformAtAudioTime;
  const ctaProgress = clamp((audioTime - ctaStart) / cta.transformDuration);

  // Cover grow: zaczyna się 0.6s po starcie CTA, trwa 1.2s (po zniknięciu napisów)
  const lastSegEnd = segments.length > 0
    ? words[segments[segments.length - 1].wordIndices.slice(-1)[0]].end_time
    : ctaStart;
  const growProgress = smoothstep(clamp((audioTime - lastSegEnd) / 1.2));

  // Nagłówek (nad cover image)
  renderHeader(ctx, width, height);

  // Cover image (rośnie w dół gdy napisy znikają)
  renderCoverImage(ctx, width, height, coverImg, growProgress);

  // Marker (zakreślenie flamastrem na cover)
  renderMarker(ctx, markerData, audioTime);

  // Fale + CTA morph
  renderEchoWaves(ctx, width, height, analyzer.getValue(), time, ctaProgress);

  // Napisy
  renderCaptions(ctx, width, height, audioTime, words, segments);
}

// ─── Main Pipeline ───────────────────────────────────────────────────────────

async function generateVideo(inputPath, timestampsPath, rawTextPath) {
  const t0 = Date.now();
  if (!fs.existsSync(inputPath)) { console.error(`❌ Brak pliku audio: ${inputPath}`); process.exit(1); }
  if (!fs.existsSync(timestampsPath)) { console.error(`❌ Brak pliku timestamps: ${timestampsPath}`); process.exit(1); }
  if (!fs.existsSync(rawTextPath)) { console.error(`❌ Brak pliku tekstu: ${rawTextPath}`); process.exit(1); }

  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(dir, `${base}_grounded_echo.mp4`);

  console.log(`\n🎬 Generowanie: Grounded Echo Waves + Captions`);
  console.log(`   Input:  ${inputPath}`);
  console.log(`   Output: ${outputPath}`);

  // 1. Buduj word timestamps
  const words = buildWordTimestamps(timestampsPath, rawTextPath);
  const segments = buildCaptionSegments(words);

  // 2. Załaduj cover image
  const coverImg = await loadCoverImage();

  // 3. Generuj marker path (wymaga cover bounds)
  let markerData = null;
  if (coverImg && CONFIG.marker.enabled) {
    // Oblicz bounds cover bez rysowania (ta sama logika co renderCoverImage)
    const cap = CONFIG.captions;
    const cover = CONFIG.cover;
    const scale = cover.scale || 1.0;
    const topY = CONFIG.height * cover.topPadding;
    const captionTopY = CONFIG.height * cap.yPositionRatio - cap.fontSize * cap.lineSpacing;
    const bottomY = captionTopY - CONFIG.height * cover.bottomGap;
    const availableHeight = bottomY - topY;
    const imgAspect = coverImg.width / coverImg.height;
    const areaAspect = CONFIG.width / availableHeight;
    let drawW, drawH;
    if (imgAspect > areaAspect) { drawW = CONFIG.width; drawH = CONFIG.width / imgAspect; }
    else { drawH = availableHeight; drawW = availableHeight * imgAspect; }
    drawW *= scale; drawH *= scale;
    const coverBounds = {
      x: (CONFIG.width - drawW) / 2,
      y: topY + (availableHeight - drawH) / 2,
      w: drawW, h: drawH
    };
    markerData = generateMarkerPath(coverBounds);
    if (markerData) {
      markerData.coverW = coverBounds.w;
      markerData.coverH = coverBounds.h;
    }
  }

  // 4. Ekstrakcja audio
  const samples = extractPCM(inputPath);
  const globalMaxRms = findGlobalMaxRms(samples);
  const sr = CONFIG.analysis.sampleRate;
  const audioDuration = samples.length / sr;
  const totalDuration = CONFIG.paddingSeconds + audioDuration + CONFIG.trailingPaddingSeconds;
  const totalFrames = Math.ceil(totalDuration * CONFIG.fps);

  const paddedPath = path.join(dir, `${base}_tmp_pad.mp3`);
  execSync(`ffmpeg -y -v error -i ${q(inputPath)} -af "adelay=${CONFIG.paddingSeconds * 1000}|${CONFIG.paddingSeconds * 1000},apad=pad_dur=${CONFIG.trailingPaddingSeconds}" -t ${totalDuration} ${q(paddedPath)}`);

  const canvas = createCanvas(CONFIG.width, CONFIG.height);
  const ctx = canvas.getContext('2d');
  const analyzer = new Analyzer();

  const ff = spawn('ffmpeg', [
    '-y',
    '-f', 'rawvideo',
    '-pixel_format', 'rgba',
    '-video_size', `${CONFIG.width}x${CONFIG.height}`,
    '-framerate', String(CONFIG.fps),
    '-i', 'pipe:0',
    '-i', paddedPath,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '17',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest',
    outputPath
  ], { stdio: ['pipe', 'pipe', 'inherit'] });

  console.log(`🎥 Rendering ${totalFrames} frames...`);

  for (let f = 0; f < totalFrames; f++) {
    const time = f / CONFIG.fps;
    const audioTime = time - CONFIG.paddingSeconds;

    analyzer.update(samples, audioTime, globalMaxRms);
    renderFrame(ctx, analyzer, time, words, segments, coverImg, markerData);

    const buf = Buffer.from(ctx.getImageData(0, 0, CONFIG.width, CONFIG.height).data);
    const ok = ff.stdin.write(buf);
    if (!ok) await new Promise(r => ff.stdin.once('drain', r));

    if (f % 30 === 0) process.stdout.write(`\r   ${Math.round(f / totalFrames * 100)}%`);
  }

  ff.stdin.end();

  await new Promise((resolve, reject) => {
    ff.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg error ${code}`)));
    ff.on('error', reject);
  });

  try { fs.unlinkSync(paddedPath); } catch { }

  // ── Post-processing: zmiana prędkości finalnego wideo ──
  if (CONFIG.finalVideoSpeed !== 1.0) {
    const speed = CONFIG.finalVideoSpeed;
    const speedPath = outputPath.replace('.mp4', '_speed.mp4');
    console.log(`\n⏩ Zmiana prędkości wideo: ×${speed}...`);

    // setpts=PTS/speed dla wideo, atempo=speed dla audio
    // atempo działa w zakresie 0.5-2.0, dla ekstremalnych wartości łańcuchujemy
    let atempoChain = '';
    let remaining = speed;
    while (remaining > 2.0) { atempoChain += 'atempo=2.0,'; remaining /= 2.0; }
    while (remaining < 0.5) { atempoChain += 'atempo=0.5,'; remaining /= 0.5; }
    atempoChain += `atempo=${remaining.toFixed(4)}`;

    execSync(`ffmpeg -y -v error -i ${q(outputPath)} -filter:v "setpts=PTS/${speed}" -filter:a "${atempoChain}" -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k ${q(speedPath)}`);

    // Zamień pliki
    fs.unlinkSync(outputPath);
    fs.renameSync(speedPath, outputPath);
    console.log(`   ✅ Prędkość zmieniona na ×${speed}`);
  }

  console.log(`\n✅ Gotowe! Czas: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const inputFile = process.argv[2] || CONFIG.defaultInput;
const timestampsFile = process.argv[3] || CONFIG.defaultTimestamps;
const rawTextFile = process.argv[4] || CONFIG.defaultRawText;
const configOverridePath = process.argv[5];

// Nadpisania z pliku JSON (przekazywane z API)
if (configOverridePath) {
  const absPath = path.resolve(configOverridePath);
  if (fs.existsSync(absPath)) {
    try {
      const overrides = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
      if (overrides.header?.text) CONFIG.header.text = overrides.header.text;
      if (overrides.cta?.text) CONFIG.cta.text = overrides.cta.text;
      if (overrides.marker?.enabled !== undefined) CONFIG.marker.enabled = overrides.marker.enabled;
      if (overrides.marker?.seed !== undefined) CONFIG.marker.seed = overrides.marker.seed;
      if (overrides.marker?.renderScale !== undefined) CONFIG.marker.renderScale = overrides.marker.renderScale;
      if (overrides.marker?.renderOffsetY !== undefined) CONFIG.marker.renderOffsetY = overrides.marker.renderOffsetY;
      if (overrides.cover?.imagePath) CONFIG.cover.searchPaths = [overrides.cover.imagePath];
      console.log('📋 Config overrides:', JSON.stringify(overrides, null, 2));
    } catch (e) {
      console.error('⚠️  Błąd config override:', e.message);
    }
  }
}

generateVideo(
  path.resolve(inputFile),
  path.resolve(timestampsFile),
  path.resolve(rawTextFile)
).catch(console.error);