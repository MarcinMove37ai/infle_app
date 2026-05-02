// src/components/views/demo.tsx
"use client"

import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, CheckCircle, Shield, Clock, Heart,
  Target, ChevronDown, ChevronRight, ArrowRight, Download, Check,
  TrendingUp,
  // Pełna whitelista ikon dla benefits.items[].icon (16 nazw — generator AI używa tylko tych)
  Bell, Filter, Users, ListChecks, Calculator, Zap,
  BrainCircuit, Lightbulb, Compass, Rocket, Database, Award,
  // Hamburger menu (mobile nav)
  Menu, X
} from 'lucide-react';
import Image from 'next/image';
import EditableText from '@/components/ui/EditableText';
import { useEditMode } from '@/contexts/EditModeContext';

// ---------------------------------------------------------------------------
// Layout constants — single source of truth for spacing & sizing
// ---------------------------------------------------------------------------
const LAYOUT = {
  /** Max-width class shared by every section's inner container */
  maxW: 'max-w-7xl',
  /** Horizontal padding on every section container */
  px: 'px-4 sm:px-6 lg:px-8',
  /** Vertical padding for full-height sections */
  sectionPy: 'py-16 sm:py-24',
  /** Internal card padding */
  cardP: 'p-5 sm:p-7',
  /** Grid gap between cards */
  gap: 'gap-5 sm:gap-6',
  /** Margin below section headings */
  headingMb: 'mb-10 sm:mb-14',
  /** Section heading text size */
  headingSize: 'text-2xl sm:text-3xl lg:text-4xl',
} as const;

// ---------------------------------------------------------------------------
// Benefit icons map — string z bazy (whitelist 16) → komponent lucide-react
// ---------------------------------------------------------------------------
// Generator AI zapisuje icon jako string (np. "Compass", "Target") z whitelisty.
// Mapowanie pozwala uniknąć if-else łańcucha w renderze.
const BENEFIT_ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Target, Bell, Filter, Users, ListChecks, Calculator,
  Shield, Zap, BookOpen, BrainCircuit, TrendingUp, Lightbulb,
  Compass, Rocket, Database, Award,
};

// Fallback gdy ikona w bazie jest nieprawidłowa lub null — Compass jako neutralna domyślna
const FALLBACK_BENEFIT_ICON = Compass;

// ---------------------------------------------------------------------------
// Editable field definitions (from database)
// ---------------------------------------------------------------------------
// Whitelist edytowalnych pól. Konwencja: dot notation = ścieżka do pola w jsonb.
// Dodawaj nowe sekcje wraz z refactorem (pliki 7-12: problem, promise, benefits, content, faq, form).
const EDITABLE_FIELDS = [
  // HERO (plik 6)
  'hero.headline_l1',
  'hero.headline_l2',
  'hero.subheadline',
  'hero.barriers.0',
  'hero.barriers.1',
  'hero.barriers.2',
  'hero.cta_primary',

  // PROBLEM (plik 7) — pains do 8 sztuk (max ze specki generatora)
  'problem.headline',
  'problem.intro',
  'problem.summary',
  'problem.pains.0.title', 'problem.pains.0.text',
  'problem.pains.1.title', 'problem.pains.1.text',
  'problem.pains.2.title', 'problem.pains.2.text',
  'problem.pains.3.title', 'problem.pains.3.text',
  'problem.pains.4.title', 'problem.pains.4.text',
  'problem.pains.5.title', 'problem.pains.5.text',
  'problem.pains.6.title', 'problem.pains.6.text',
  'problem.pains.7.title', 'problem.pains.7.text',

  // PROMISE (plik 8) — most z bólu do rozwiązania
  'promise.label',
  'promise.headline',
  'promise.text',
  'promise.outcomes.0',
  'promise.outcomes.1',
  'promise.outcomes.2',

  // BENEFITS (plik 9) — items do 8 sztuk (max ze specki generatora)
  'benefits.headline',
  'benefits.subheadline',
  'benefits.items.0.title', 'benefits.items.0.text', 'benefits.items.0.icon',
  'benefits.items.1.title', 'benefits.items.1.text', 'benefits.items.1.icon',
  'benefits.items.2.title', 'benefits.items.2.text', 'benefits.items.2.icon',
  'benefits.items.3.title', 'benefits.items.3.text', 'benefits.items.3.icon',
  'benefits.items.4.title', 'benefits.items.4.text', 'benefits.items.4.icon',
  'benefits.items.5.title', 'benefits.items.5.text', 'benefits.items.5.icon',
  'benefits.items.6.title', 'benefits.items.6.text', 'benefits.items.6.icon',
  'benefits.items.7.title', 'benefits.items.7.text', 'benefits.items.7.icon',

  // CONTENT (plik 10) — DOKŁADNIE 4 WIIFM milestones
  'content.headline',
  'content.subheadline',
  'content.items.0.title', 'content.items.0.text',
  'content.items.1.title', 'content.items.1.text',
  'content.items.2.title', 'content.items.2.text',
  'content.items.3.title', 'content.items.3.text',

  // FAQ (plik 11) — items 7-9 sztuk (max ze specki generatora)
  'faq.headline',
  'faq.items.0.question', 'faq.items.0.answer',
  'faq.items.1.question', 'faq.items.1.answer',
  'faq.items.2.question', 'faq.items.2.answer',
  'faq.items.3.question', 'faq.items.3.answer',
  'faq.items.4.question', 'faq.items.4.answer',
  'faq.items.5.question', 'faq.items.5.answer',
  'faq.items.6.question', 'faq.items.6.answer',
  'faq.items.7.question', 'faq.items.7.answer',
  'faq.items.8.question', 'faq.items.8.answer',

  // FORM (plik 12) — 4 pola edytowalne
  'form.headline',
  'form.subheadline',
  'form.cta',
  'form.trust_line',
];

// ---------------------------------------------------------------------------
// Theme system — 4 complete themes with 30+ tokens each
// ---------------------------------------------------------------------------
export interface ThemeTokens {
  name: string;
  // Page-level
  pageBg: string;
  pageText: string;
  pageSubtext: string;
  // Header
  headerBg: string;
  headerBorder: string;
  headerShadow: string;
  // Cards
  cardBg: string;
  cardBorder: string;
  cardHoverBorder: string;
  cardShadow: string;
  cardHoverShadow: string;
  // Inputs
  inputBg: string;
  inputBorder: string;
  inputFocusBorder: string;
  inputFocusRing: string;
  inputText: string;
  inputPlaceholder: string;
  // Buttons — primary CTA
  ctaBg: string;
  ctaHoverBg: string;
  ctaText: string;
  ctaShadow: string;
  ctaGlow: string;
  // Buttons — secondary / outline
  secondaryBg: string;
  secondaryBorder: string;
  secondaryText: string;
  secondaryHoverBg: string;
  // Accent & decorative
  accent: string;
  accentMuted: string;
  accentSubtle: string;  // very light tint for badges / icon bg
  gradientFrom: string;
  gradientTo: string;
  // Dividers & lines
  divider: string;
  dividerAccent: string;
  // Section alternation
  sectionAltBg: string;
  // Stats bar
  statsBarBg: string;
  statsBarBorder: string;
  statsBarValue: string;
  // Guarantees banner
  guaranteeBg: string;
  guaranteeBorder: string;
  guaranteeIconBg: string;
  // Badge (FREE label)
  badgeBg: string;
  badgeText: string;
  // FAQ
  faqBg: string;
  faqBorder: string;
  faqHoverText: string;
  // Footer
  footerBg: string;
  footerBorder: string;
  footerText: string;
  footerHoverText: string;
  // Form section title bar
  formBannerBg: string;
  formBannerText: string;
  // Icon circles
  iconCircleBg: string;
  iconCircleBorder: string;
  iconColor: string;
  // Chapter number
  chapterNumberColor: string;
  chapterCircleBg: string;
  // Glassmorphism helpers
  glassBg: string;
  glassRing: string;
  // Typography
  headingFont: string;
  bodyFont: string;
  // Label text
  labelText: string;
  // Trust badges in form
  trustBg: string;
  trustBorder: string;
  trustText: string;
  // Bullet check circles
  bulletCircleBg: string;
  bulletCircleBorder: string;
  // Thank you section
  thankYouIconBg: string;
  thankYouIconBorder: string;
  // Error
  errorBg: string;
  errorBorder: string;
  errorText: string;
  // Warning (preview mode)
  warningBg: string;
  warningBorder: string;
  warningText: string;
  // Spinner
  spinnerBorder: string;
}

export const colorSchemes: Record<string, ThemeTokens> = {
  dark: {
    name: "Nocne Światło",
    pageBg: "#0A0A0F",
    pageText: "#E2E8F0",
    pageSubtext: "#94A3B8",
    headerBg: "rgba(10, 10, 15, 0.70)",
    headerBorder: "rgba(255,255,255,0.08)",
    headerShadow: "0 1px 24px rgba(0,0,0,0.4)",
    cardBg: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(255,255,255,0.08)",
    cardHoverBorder: "rgba(255,255,255,0.16)",
    cardShadow: "0 2px 12px rgba(0,0,0,0.3)",
    cardHoverShadow: "0 8px 32px rgba(0,0,0,0.5)",
    inputBg: "rgba(255,255,255,0.05)",
    inputBorder: "rgba(255,255,255,0.12)",
    inputFocusBorder: "#A78BFA",
    inputFocusRing: "rgba(167,139,250,0.25)",
    inputText: "#E2E8F0",
    inputPlaceholder: "#64748B",
    ctaBg: "linear-gradient(135deg, #8B5CF6, #6366F1)",
    ctaHoverBg: "linear-gradient(135deg, #7C3AED, #4F46E5)",
    ctaText: "#FFFFFF",
    ctaShadow: "0 8px 24px rgba(139,92,246,0.35)",
    ctaGlow: "0 0 40px rgba(139,92,246,0.20)",
    secondaryBg: "rgba(255,255,255,0.06)",
    secondaryBorder: "rgba(255,255,255,0.12)",
    secondaryText: "#A78BFA",
    secondaryHoverBg: "rgba(255,255,255,0.10)",
    accent: "#A78BFA",
    accentMuted: "#7C3AED",
    accentSubtle: "rgba(167,139,250,0.12)",
    gradientFrom: "#8B5CF6",
    gradientTo: "#6366F1",
    divider: "rgba(255,255,255,0.06)",
    dividerAccent: "linear-gradient(90deg, #8B5CF6, #EC4899)",
    sectionAltBg: "rgba(255,255,255,0.02)",
    statsBarBg: "rgba(255,255,255,0.03)",
    statsBarBorder: "rgba(255,255,255,0.06)",
    statsBarValue: "#A78BFA",
    guaranteeBg: "rgba(255,255,255,0.02)",
    guaranteeBorder: "rgba(255,255,255,0.06)",
    guaranteeIconBg: "rgba(167,139,250,0.12)",
    badgeBg: "linear-gradient(135deg, #8B5CF6, #6366F1)",
    badgeText: "#FFFFFF",
    faqBg: "rgba(255,255,255,0.03)",
    faqBorder: "rgba(255,255,255,0.08)",
    faqHoverText: "#A78BFA",
    footerBg: "rgba(255,255,255,0.02)",
    footerBorder: "rgba(255,255,255,0.06)",
    footerText: "#64748B",
    footerHoverText: "#E2E8F0",
    formBannerBg: "linear-gradient(135deg, #8B5CF6, #6366F1)",
    formBannerText: "#FFFFFF",
    iconCircleBg: "rgba(167,139,250,0.10)",
    iconCircleBorder: "rgba(167,139,250,0.25)",
    iconColor: "#A78BFA",
    chapterNumberColor: "#A78BFA",
    chapterCircleBg: "rgba(167,139,250,0.08)",
    glassBg: "rgba(255,255,255,0.04)",
    glassRing: "rgba(255,255,255,0.08)",
    headingFont: "'Outfit', 'Inter', sans-serif",
    bodyFont: "'Inter', 'Segoe UI', sans-serif",
    labelText: "#CBD5E1",
    trustBg: "rgba(255,255,255,0.04)",
    trustBorder: "rgba(255,255,255,0.08)",
    trustText: "#94A3B8",
    bulletCircleBg: "rgba(167,139,250,0.15)",
    bulletCircleBorder: "rgba(167,139,250,0.30)",
    thankYouIconBg: "rgba(167,139,250,0.12)",
    thankYouIconBorder: "rgba(167,139,250,0.25)",
    errorBg: "rgba(239,68,68,0.10)",
    errorBorder: "rgba(239,68,68,0.25)",
    errorText: "#FCA5A5",
    warningBg: "rgba(245,158,11,0.10)",
    warningBorder: "rgba(245,158,11,0.25)",
    warningText: "#FCD34D",
    spinnerBorder: "#FFFFFF",
  },
  light: {
    name: "Czyste Światło",
    pageBg: "#FAFBFC",
    pageText: "#1E293B",
    pageSubtext: "#64748B",
    headerBg: "rgba(255,255,255,0.85)",
    headerBorder: "rgba(0,0,0,0.06)",
    headerShadow: "0 1px 12px rgba(0,0,0,0.06)",
    cardBg: "#FFFFFF",
    cardBorder: "rgba(0,0,0,0.06)",
    cardHoverBorder: "rgba(0,0,0,0.12)",
    cardShadow: "0 1px 4px rgba(0,0,0,0.04)",
    cardHoverShadow: "0 8px 24px rgba(0,0,0,0.08)",
    inputBg: "#FFFFFF",
    inputBorder: "#D1D5DB",
    inputFocusBorder: "#6366F1",
    inputFocusRing: "rgba(99,102,241,0.20)",
    inputText: "#1E293B",
    inputPlaceholder: "#9CA3AF",
    ctaBg: "linear-gradient(135deg, #6366F1, #4F46E5)",
    ctaHoverBg: "linear-gradient(135deg, #4F46E5, #4338CA)",
    ctaText: "#FFFFFF",
    ctaShadow: "0 6px 20px rgba(99,102,241,0.30)",
    ctaGlow: "none",
    secondaryBg: "transparent",
    secondaryBorder: "#D1D5DB",
    secondaryText: "#6366F1",
    secondaryHoverBg: "rgba(99,102,241,0.05)",
    accent: "#6366F1",
    accentMuted: "#4F46E5",
    accentSubtle: "rgba(99,102,241,0.08)",
    gradientFrom: "#6366F1",
    gradientTo: "#8B5CF6",
    divider: "rgba(0,0,0,0.06)",
    dividerAccent: "linear-gradient(90deg, #6366F1, #A855F7)",
    sectionAltBg: "#F1F5F9",
    statsBarBg: "#FFFFFF",
    statsBarBorder: "rgba(0,0,0,0.06)",
    statsBarValue: "#6366F1",
    guaranteeBg: "#FFFFFF",
    guaranteeBorder: "rgba(0,0,0,0.06)",
    guaranteeIconBg: "rgba(99,102,241,0.08)",
    badgeBg: "linear-gradient(135deg, #6366F1, #4F46E5)",
    badgeText: "#FFFFFF",
    faqBg: "#FFFFFF",
    faqBorder: "rgba(0,0,0,0.06)",
    faqHoverText: "#6366F1",
    footerBg: "#F8FAFC",
    footerBorder: "rgba(0,0,0,0.06)",
    footerText: "#94A3B8",
    footerHoverText: "#1E293B",
    formBannerBg: "linear-gradient(135deg, #6366F1, #4F46E5)",
    formBannerText: "#FFFFFF",
    iconCircleBg: "rgba(99,102,241,0.08)",
    iconCircleBorder: "rgba(99,102,241,0.20)",
    iconColor: "#6366F1",
    chapterNumberColor: "#6366F1",
    chapterCircleBg: "rgba(99,102,241,0.06)",
    glassBg: "rgba(255,255,255,0.70)",
    glassRing: "rgba(0,0,0,0.06)",
    headingFont: "'DM Sans', 'Inter', sans-serif",
    bodyFont: "'Inter', 'Segoe UI', sans-serif",
    labelText: "#374151",
    trustBg: "#F9FAFB",
    trustBorder: "#E5E7EB",
    trustText: "#6B7280",
    bulletCircleBg: "rgba(99,102,241,0.10)",
    bulletCircleBorder: "rgba(99,102,241,0.25)",
    thankYouIconBg: "rgba(99,102,241,0.08)",
    thankYouIconBorder: "rgba(99,102,241,0.20)",
    errorBg: "rgba(239,68,68,0.06)",
    errorBorder: "rgba(239,68,68,0.20)",
    errorText: "#DC2626",
    warningBg: "rgba(245,158,11,0.06)",
    warningBorder: "rgba(245,158,11,0.20)",
    warningText: "#D97706",
    spinnerBorder: "#FFFFFF",
  },
  earth: {
    name: "Ciepła Ziemia",
    pageBg: "#FAF6F1",
    pageText: "#3D2E1E",
    pageSubtext: "#7C6A56",
    headerBg: "rgba(250,246,241,0.85)",
    headerBorder: "rgba(60,46,30,0.08)",
    headerShadow: "0 1px 12px rgba(60,46,30,0.06)",
    cardBg: "#FFFFFF",
    cardBorder: "rgba(60,46,30,0.08)",
    cardHoverBorder: "rgba(60,46,30,0.16)",
    cardShadow: "0 1px 4px rgba(60,46,30,0.04)",
    cardHoverShadow: "0 8px 24px rgba(60,46,30,0.10)",
    inputBg: "#FFFDF9",
    inputBorder: "#D4C4AD",
    inputFocusBorder: "#2E7D6E",
    inputFocusRing: "rgba(46,125,110,0.20)",
    inputText: "#3D2E1E",
    inputPlaceholder: "#A39480",
    ctaBg: "linear-gradient(135deg, #2E7D6E, #1D6B5D)",
    ctaHoverBg: "linear-gradient(135deg, #1D6B5D, #165A4E)",
    ctaText: "#FFFFFF",
    ctaShadow: "0 6px 20px rgba(46,125,110,0.30)",
    ctaGlow: "none",
    secondaryBg: "transparent",
    secondaryBorder: "#D4C4AD",
    secondaryText: "#2E7D6E",
    secondaryHoverBg: "rgba(46,125,110,0.05)",
    accent: "#2E7D6E",
    accentMuted: "#1D6B5D",
    accentSubtle: "rgba(46,125,110,0.08)",
    gradientFrom: "#2E7D6E",
    gradientTo: "#3A9B8A",
    divider: "rgba(60,46,30,0.08)",
    dividerAccent: "linear-gradient(90deg, #2E7D6E, #C08552)",
    sectionAltBg: "#F5EFE7",
    statsBarBg: "#FFFFFF",
    statsBarBorder: "rgba(60,46,30,0.06)",
    statsBarValue: "#2E7D6E",
    guaranteeBg: "#FFFFFF",
    guaranteeBorder: "rgba(60,46,30,0.06)",
    guaranteeIconBg: "rgba(46,125,110,0.08)",
    badgeBg: "linear-gradient(135deg, #2E7D6E, #1D6B5D)",
    badgeText: "#FFFFFF",
    faqBg: "#FFFFFF",
    faqBorder: "rgba(60,46,30,0.08)",
    faqHoverText: "#2E7D6E",
    footerBg: "#F5EFE7",
    footerBorder: "rgba(60,46,30,0.06)",
    footerText: "#A39480",
    footerHoverText: "#3D2E1E",
    formBannerBg: "linear-gradient(135deg, #2E7D6E, #1D6B5D)",
    formBannerText: "#FFFFFF",
    iconCircleBg: "rgba(46,125,110,0.08)",
    iconCircleBorder: "rgba(46,125,110,0.20)",
    iconColor: "#2E7D6E",
    chapterNumberColor: "#2E7D6E",
    chapterCircleBg: "rgba(46,125,110,0.06)",
    glassBg: "rgba(255,255,255,0.70)",
    glassRing: "rgba(60,46,30,0.06)",
    headingFont: "'Playfair Display', 'Georgia', serif",
    bodyFont: "'Source Sans 3', 'Segoe UI', sans-serif",
    labelText: "#5C4A36",
    trustBg: "#FAF6F1",
    trustBorder: "#E8DDD0",
    trustText: "#7C6A56",
    bulletCircleBg: "rgba(46,125,110,0.10)",
    bulletCircleBorder: "rgba(46,125,110,0.25)",
    thankYouIconBg: "rgba(46,125,110,0.08)",
    thankYouIconBorder: "rgba(46,125,110,0.20)",
    errorBg: "rgba(220,38,38,0.06)",
    errorBorder: "rgba(220,38,38,0.20)",
    errorText: "#DC2626",
    warningBg: "rgba(217,119,6,0.06)",
    warningBorder: "rgba(217,119,6,0.20)",
    warningText: "#D97706",
    spinnerBorder: "#FFFFFF",
  },
  frost: {
    name: "Mroźna Cisza",
    pageBg: "#0C1222",
    pageText: "#CBD5E1",
    pageSubtext: "#64748B",
    headerBg: "rgba(12,18,34,0.75)",
    headerBorder: "rgba(148,163,184,0.08)",
    headerShadow: "0 1px 24px rgba(0,0,0,0.5)",
    cardBg: "rgba(148,163,184,0.05)",
    cardBorder: "rgba(148,163,184,0.10)",
    cardHoverBorder: "rgba(148,163,184,0.18)",
    cardShadow: "0 2px 12px rgba(0,0,0,0.25)",
    cardHoverShadow: "0 8px 32px rgba(0,0,0,0.40)",
    inputBg: "rgba(148,163,184,0.06)",
    inputBorder: "rgba(148,163,184,0.15)",
    inputFocusBorder: "#38BDF8",
    inputFocusRing: "rgba(56,189,248,0.20)",
    inputText: "#E2E8F0",
    inputPlaceholder: "#475569",
    ctaBg: "linear-gradient(135deg, #0EA5E9, #0284C7)",
    ctaHoverBg: "linear-gradient(135deg, #0284C7, #0369A1)",
    ctaText: "#FFFFFF",
    ctaShadow: "0 8px 24px rgba(14,165,233,0.30)",
    ctaGlow: "0 0 40px rgba(14,165,233,0.15)",
    secondaryBg: "rgba(148,163,184,0.06)",
    secondaryBorder: "rgba(148,163,184,0.12)",
    secondaryText: "#38BDF8",
    secondaryHoverBg: "rgba(148,163,184,0.10)",
    accent: "#38BDF8",
    accentMuted: "#0EA5E9",
    accentSubtle: "rgba(56,189,248,0.10)",
    gradientFrom: "#0EA5E9",
    gradientTo: "#38BDF8",
    divider: "rgba(148,163,184,0.06)",
    dividerAccent: "linear-gradient(90deg, #0EA5E9, #06B6D4)",
    sectionAltBg: "rgba(148,163,184,0.03)",
    statsBarBg: "rgba(148,163,184,0.04)",
    statsBarBorder: "rgba(148,163,184,0.06)",
    statsBarValue: "#38BDF8",
    guaranteeBg: "rgba(148,163,184,0.03)",
    guaranteeBorder: "rgba(148,163,184,0.06)",
    guaranteeIconBg: "rgba(56,189,248,0.10)",
    badgeBg: "linear-gradient(135deg, #0EA5E9, #0284C7)",
    badgeText: "#FFFFFF",
    faqBg: "rgba(148,163,184,0.04)",
    faqBorder: "rgba(148,163,184,0.08)",
    faqHoverText: "#38BDF8",
    footerBg: "rgba(148,163,184,0.02)",
    footerBorder: "rgba(148,163,184,0.06)",
    footerText: "#475569",
    footerHoverText: "#E2E8F0",
    formBannerBg: "linear-gradient(135deg, #0EA5E9, #0284C7)",
    formBannerText: "#FFFFFF",
    iconCircleBg: "rgba(56,189,248,0.08)",
    iconCircleBorder: "rgba(56,189,248,0.20)",
    iconColor: "#38BDF8",
    chapterNumberColor: "#38BDF8",
    chapterCircleBg: "rgba(56,189,248,0.06)",
    glassBg: "rgba(148,163,184,0.04)",
    glassRing: "rgba(148,163,184,0.08)",
    headingFont: "'Space Grotesk', 'Inter', sans-serif",
    bodyFont: "'Inter', 'Segoe UI', sans-serif",
    labelText: "#94A3B8",
    trustBg: "rgba(148,163,184,0.04)",
    trustBorder: "rgba(148,163,184,0.08)",
    trustText: "#94A3B8",
    bulletCircleBg: "rgba(56,189,248,0.10)",
    bulletCircleBorder: "rgba(56,189,248,0.25)",
    thankYouIconBg: "rgba(56,189,248,0.10)",
    thankYouIconBorder: "rgba(56,189,248,0.20)",
    errorBg: "rgba(239,68,68,0.10)",
    errorBorder: "rgba(239,68,68,0.25)",
    errorText: "#FCA5A5",
    warningBg: "rgba(245,158,11,0.10)",
    warningBorder: "rgba(245,158,11,0.25)",
    warningText: "#FCD34D",
    spinnerBorder: "#FFFFFF",
  },
};

// ---------------------------------------------------------------------------
// Animated CTA button
// ---------------------------------------------------------------------------
const AnimatedButton = ({
  href,
  children,
  theme,
  className = ""
}: {
  href: string;
  children: React.ReactNode;
  theme: ThemeTokens;
  className?: string;
}) => {
  return (
    <a
      href={href}
      className={`
        inline-flex items-center justify-center rounded-full
        px-6 sm:px-8 py-3.5 sm:py-4 font-semibold text-sm sm:text-base
        transition-all duration-300 ease-out
        hover:scale-105 hover:translate-y-[-2px]
        ${className}
      `}
      style={{
        background: theme.ctaBg,
        color: theme.ctaText,
        boxShadow: `${theme.ctaShadow}, ${theme.ctaGlow}`,
      }}
    >
      <span className="mr-2 sm:mr-3">{children}</span>
      <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: theme.ctaText }} />
    </a>
  );
};

// ---------------------------------------------------------------------------
// FAQ accordion item
// ---------------------------------------------------------------------------
const FaqItem = ({
  question,
  answer,
  theme,
  isTextEditMode,
  onTextUpdate,
  questionFieldName,
  answerFieldName,
  editLabel = 'Edit',
  editedLabel = 'Edited'
}: {
  question: string;
  answer: string;
  theme: ThemeTokens;
  isTextEditMode?: boolean;
  onTextUpdate?: (fieldName: string, newValue: string) => void;
  questionFieldName: string;
  answerFieldName: string;
  editLabel?: string;
  editedLabel?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Check EditMode context availability
  const editModeContext = useEditMode();
  const useContextMode = !!editModeContext;

  const handleTextChange = (field: string, value: string) => {
    if (useContextMode) {
      editModeContext.handleTextChange(field, value);
    } else if (onTextUpdate) {
      onTextUpdate(field, value);
    }
  };

  const isQuestionEditable = EDITABLE_FIELDS.includes(questionFieldName);
  const isAnswerEditable = EDITABLE_FIELDS.includes(answerFieldName);

  return (
    <div style={{ borderBottom: `1px solid ${theme.divider}` }}>
      <button
        className="flex w-full items-center justify-between py-4 sm:py-5 text-left transition-colors cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        style={{ color: isOpen ? theme.faqHoverText : theme.pageText }}
      >
        <h3 className="text-base sm:text-lg font-semibold pr-3" style={{ fontFamily: theme.headingFont }}>
          {isQuestionEditable ? (
            <EditableText
              fieldName={questionFieldName}
              value={question}
              tag="span"
              isEditMode={isTextEditMode || false}
                editLabel={editLabel}
              editedLabel={editedLabel}
              onChange={handleTextChange}
            />
          ) : (
            question
          )}
        </h3>
        <ChevronRight
          className={`h-5 w-5 flex-shrink-0 transform transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}
          style={{ color: isOpen ? theme.faqHoverText : theme.pageSubtext }}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-60 pb-5' : 'max-h-0'}`}
      >
        <p className="text-sm sm:text-base leading-relaxed" style={{ color: theme.pageSubtext }}>
          {isAnswerEditable ? (
            <EditableText
              fieldName={answerFieldName}
              value={answer}
              tag="span"
              isEditMode={isTextEditMode || false}
                editLabel={editLabel}
              editedLabel={editedLabel}
              onChange={handleTextChange}
              multiline={true}
            />
          ) : (
            answer
          )}
        </p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------
interface PageContentStat {
  value: string;
  label: string;
}

interface PageContentBenefitItem {
  icon?: React.ElementType;
  title: string;
  text: string;
}

interface PageContentChapter {
  number: string;
  title: string;
  description: string;
}

interface PageContentGuaranteeItem {
  icon?: React.ElementType;
  text: string;
}

interface PageContentFaqItem {
  question: string;
  answer: string;
}

// PageContent — struktura zsynchronizowana z bazą (jsonb 7 sekcji, schema_version v2).
// HERO już używa nowych pól (plik 6). Pozostałe sekcje są refactorowane sekwencyjnie
// w plikach 7-12 — do tego czasu typy benefits/content/form/faq są opcjonalne / luźne.
interface PageContent {
  s3_file_key?: string;

  // HERO — nowy schemat (plik 6)
  hero: {
    headline_l1: string;
    headline_l2: string;
    subheadline: string;
    barriers: [string, string, string];
    cta_primary: string;
  };

  // PROBLEM — nowy schemat (plik 7)
  problem?: {
    headline: string;
    intro: string;
    pains: Array<{ title: string; text: string }>;
    summary: string;
  };

  // PROMISE — nowy schemat (plik 8)
  promise?: {
    label: string;
    headline: string;
    text: string;
    outcomes: [string, string, string];
  };

  // BENEFITS — nowy schemat (plik 9)
  benefits?: {
    headline: string;
    subheadline: string;
    items: Array<{
      title: string;
      text: string;
      icon: string;  // nazwa ikony z whitelisty (16 lucide names)
    }>;
  };

  // CONTENT — nowy schemat (plik 10): 4 WIIFM milestones (NIE chapters)
  content?: {
    headline: string;
    subheadline: string;
    items: [
      { title: string; text: string },
      { title: string; text: string },
      { title: string; text: string },
      { title: string; text: string },
    ];
  };

  // FAQ — nowy schemat (plik 11): 7-9 obiekcji psychologicznych
  faq?: {
    headline: string;
    items: Array<{ question: string; answer: string }>;
  };

  // FORM — nowy schemat (plik 12): final push to convert
  form?: {
    headline: string;
    subheadline: string;
    cta: string;
    trust_line: string;
  };

  // Sekcje jeszcze nieprzerobione — wartości mogą być null/undefined gdy wczytujemy
  // dane z nowego schematu jsonb. Odczyty zabezpieczone przez `?.` w renderze.
  guarantees?: {
    items?: PageContentGuaranteeItem[];
  };
}

export interface EbookMeta {
  chapterCount: number;
  estimatedPages: number;
  chapters: Array<{
    position: number;
    title: string;
    preview: string;
  }>;
}

interface DemoViewProps {
  pageContent: PageContent;
  ebookMeta?: EbookMeta;
  language?: 'pl' | 'en';
  colorSchemeName?: keyof typeof colorSchemes;
  partnerName?: string;
  partnerLogoUrl?: string;  // Zdjęcie profilowe usera — wyświetlane po prawej w headerze (opcjonalne)
  visitors?: number;
  pageId?: string;
  pageData?: any;
  isPreviewMode?: boolean;
  isTextEditMode?: boolean;
  onTextUpdate?: (fieldName: string, newValue: string) => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const DemoView: React.FC<DemoViewProps> = ({
  pageContent,
  ebookMeta,
  language = 'pl',
  colorSchemeName = 'dark',
  partnerName = 'Jan Kowalski',
  partnerLogoUrl,
  visitors = 0,
  pageId,
  pageData,
  isPreviewMode = false,
  isTextEditMode = false,
  onTextUpdate
}) => {
  // Resolver dla zdjęcia profilowego — sprawdza prop, a w fallbacku pageData.
  // Nazwa to PROFILE PICTURE z tabeli users (NIE authorLogoUrl który jest
  // osobnym polem dla logo brand/firmy). Obsługuje wiele konwencji żeby
  // działało z różnymi caller'ami:
  //   - explicit prop partnerLogoUrl (najwyższy priorytet)
  //   - pageData.profilePicture (root, camelCase)
  //   - pageData.user.profilePicture (zagnieżdżony, jak w PublicPageClient)
  //   - pageData.profile_picture (snake_case fallback)
  const resolvedPartnerLogoUrl =
    partnerLogoUrl
    || pageData?.profilePicture
    || pageData?.user?.profilePicture
    || pageData?.profile_picture
    || undefined;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [tocOpen, setTocOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Focus states for inputs
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // i18n
  const isEN = language === 'en';
  const editLabel = isEN ? 'Edit' : 'Edytuj';
  const editedLabel = isEN ? 'Edited' : 'Edytowane';

  // Definicja linków nawigacji — sekcje strony w kolejności scroll
  // (hero pomijamy — kliknięcie logo wraca tam naturalnie)
  const navLinks = [
    { href: '#problem',  label: isEN ? 'Problem'   : 'Problem' },
    { href: '#promise',  label: isEN ? 'Promise'   : 'Obietnica' },
    { href: '#benefits', label: isEN ? 'Benefits'  : 'Korzyści' },
    { href: '#content',  label: isEN ? 'Contents'  : 'Spis treści' },
    { href: '#faq',      label: isEN ? 'FAQ'       : 'FAQ' },
  ];
  const navCta = { href: '#signup', label: isEN ? 'Get the e-book' : 'Pobierz e-book' };
  const ui = {
    benefitsSectionTitle:  isEN ? 'What will you gain from this guide?' : 'Co zyskasz dzięki temu przewodnikowi?',
    contentSectionTitle:   isEN ? "What's inside?"                      : 'Co znajdziesz w środku?',
    tocToggleLabel:        (n: number) => isEN
      ? `Full table of contents (${n} ${n === 1 ? 'chapter' : 'chapters'})`
      : `Pełny spis treści (${n} ${n === 1 ? 'rozdział' : 'rozdziały'})`,
    statChapter:           (n: number) => isEN ? (n === 1 ? 'chapter' : 'chapters') : (n === 1 ? 'rozdział' : 'rozdziały'),
    statPages:             isEN ? 'pages'               : 'stron',
    statPdfLabel:          isEN ? 'instant download'    : 'do pobrania od razu',
    statFreeLabel:         isEN ? 'no credit card'      : 'bez karty kredytowej',
    statFreeValue:         isEN ? 'Free'                : 'Bezpłatny',
    guaranteeLabel:        isEN ? 'We guarantee:'       : 'Gwarantujemy:',
    learnMore:             isEN ? 'Learn more'          : 'Dowiedz się więcej',
    formLeftTitle:         isEN ? 'One step to knowledge that works' : 'Jeden krok do wiedzy, która działa',
    formLeftText:          isEN
      ? 'Leave your email — the e-book arrives in under a minute. No spam, unsubscribe with one click.'
      : 'Zostaw e-mail — e-book trafi do Ciebie w ciągu minuty. Bez spamu, wypisujesz się jednym kliknięciem.',
    guaranteeSafe:         isEN ? 'Secure data'         : 'Bezpieczne dane',
    guaranteeNoSpam:       isEN ? 'No spam'             : 'Bez spamu',
    guaranteePdf:          isEN ? 'High-quality PDF'    : 'PDF wysokiej jakości',
    sending:               isEN ? 'Sending...'          : 'Wysyłanie...',
    previewUnavailable:    isEN ? 'Unavailable in preview mode' : 'Niedostępne w trybie podglądu',
    previewFormNote:       isEN
      ? 'The form is inactive in preview mode. Open the published version to test lead collection.'
      : 'Formularz jest nieaktywny w trybie podglądu. Aby testować zbieranie leadów, otwórz opublikowaną wersję strony.',
    thankYou:              isEN ? 'Thank you!'          : 'Dziękujemy!',
    downloadReady:         isEN
      ? 'Your e-book is ready. Download it below and start with the first chapter — you will see results after just one read.'
      : 'Twój e-book jest gotowy. Kliknij poniżej i zacznij od pierwszego rozdziału — pierwsze efekty zobaczysz już po lekturze.',
    downloading:           isEN ? 'Downloading...'      : 'Pobieranie...',
    downloadBtn:           isEN ? 'Download your e-book' : 'Pobierz swój ebook',
    farewell:              isEN
      ? 'Enjoy the read! If this material helps you — share it with someone who needs it too.'
      : 'Miłej lektury! Jeśli materiał okaże się wartościowy — podziel się nim z kimś, komu też może pomóc.',
    downloadError:         isEN ? 'If this problem persists, please contact us.' : 'Jeśli problem będzie się powtarzał, skontaktuj się z nami.',
    faqTitle:              isEN ? 'Frequently Asked Questions' : 'Najczęściej zadawane pytania',
    footerRights:          isEN ? '© 2025 Inflee. All rights reserved.' : '© 2025 Inflee. Wszelkie prawa zastrzeżone.',
    footerPrivacy:         isEN ? 'Privacy policy'      : 'Polityka prywatności',
    footerTerms:           isEN ? 'Terms'               : 'Regulamin',
    footerContact:         isEN ? 'Contact'             : 'Kontakt',
    madeWith:              isEN ? 'made with inflee.app' : 'made with inflee.app',
    heroCta:               isEN ? 'Get your free e-book' : 'Pobierz bezpłatny e-book',
    namePlaceholder:       isEN ? 'Your name'            : 'Twoje imię',
    emailPlaceholder:      isEN ? 'Your email address'   : 'Twój adres e-mail',
    phonePlaceholder:      isEN ? 'Your phone (optional)': 'Twój numer telefonu (opcjonalnie)',
    formSubmitBtn:         isEN ? 'Send me the e-book'   : 'Wyślij mi e-book',
    privacyText:           isEN
      ? 'Your data is safe. No spam — unsubscribe with one click.'
      : 'Twoje dane są bezpieczne. Bez spamu — wypisujesz się jednym kliknięciem.',
    guaranteeFree:         isEN ? 'Free e-book'          : 'Bezpłatny e-book',
    nameLabel:             isEN ? 'Name'                : 'Imię',
    emailLabel:            isEN ? 'E-mail'              : 'E-mail',
    phoneLabel:            isEN ? 'Phone (optional)'    : 'Telefon (opcjonalnie)',
    bezplatnie:            isEN ? 'FREE'                : 'BEZPŁATNIE',
    previewMode:           isEN ? '(Preview mode)'      : '(Tryb podglądu)',
  };

  // EditMode context
  const editModeContext = useEditMode();
  const useContextMode = !!editModeContext;

  const handleTextChange = (field: string, value: string) => {
    if (useContextMode) {
      editModeContext.handleTextChange(field, value);
    } else if (onTextUpdate) {
      onTextUpdate(field, value);
    }
  };

  // Active theme
  const theme = colorSchemes[colorSchemeName] || colorSchemes.dark;

  // Logo URL processing
  const logoUrl = (() => {
    const raw = pageData?.author_logo_url;
    if (!raw) return '/api/assets/uploads/logo_inflee.webp';
    if (raw.startsWith('/uploads/')) return `/api/assets/${raw.slice('/uploads/'.length)}`;
    return raw;
  })();

  // Mockup URL — kaskadowo z możliwych źródeł.
  // Najpierw resolvedMockupUrl (zbudowany server-side w preview API i page.tsx),
  // potem klientowy fallback z pageData.ebook, ostatecznie placeholder.
  const mockupUrl = (() => {
    if (pageData?.resolvedMockupUrl) return pageData.resolvedMockupUrl;

    const buildAssetUrl = (path?: string | null): string => {
      if (!path) return '';
      if (path.startsWith('http://') || path.startsWith('https://')) return path;
      if (path.startsWith('/uploads/')) {
        return `/api/assets/uploads/${path.substring('/uploads/'.length)}`;
      }
      return `/api/assets/uploads/${path}`;
    };

    const ebook = pageData?.ebook;
    const fromEbook = ebook?.final_mockup_url || ebook?.cover_image_webp_url || ebook?.s3_file_key || ebook?.mockup_url;
    if (fromEbook) return buildAssetUrl(fromEbook);

    const fromPage = pageData?.s3_file_key || pageData?.mockup_url;
    if (fromPage) return buildAssetUrl(fromPage);

    return '/mockup.png';
  })();

  // Note: hero stats from pageContent.hero.stats are not displayed separately
  // — the ebookMeta cards section below shows the relevant metadata instead.

  // Scroll animation observers
  const [elements, setElements] = useState<Record<string, boolean>>({});
  const observers = useRef<Record<string, IntersectionObserver>>({});

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    const observerCallback = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.target.id) {
          setElements(prev => ({
            ...prev,
            [entry.target.id]: true
          }));
          observer.unobserve(entry.target);
        }
      });
    };

    const sectionIds = [
      'hero', 'problem', 'promise', 'benefits', 'content',
      'signup', 'faq'
    ];

    const currentObservers: Record<string, IntersectionObserver> = {};

    sectionIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        const observer = new IntersectionObserver(observerCallback, options);
        observer.observe(element);
        currentObservers[id] = observer;
        observers.current[id] = observer;
      }
    });

    return () => {
      Object.values(currentObservers).forEach(observer => {
        observer.disconnect();
      });
    };
  }, []);

  // Download ebook handler
  const handleDownloadEbook = async () => {
    if (isPreviewMode || !pageId) {
      setDownloadError("Akcja niedostępna w trybie podglądu.");
      return;
    }

    try {
      setIsDownloading(true);
      setDownloadError(null);

      const response = await fetch(`/api/download-ebook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageId: pageId,
          email: email,
        }),
      });

      if (!response.ok) {
        if (response.headers.get('content-type')?.includes('application/json')) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Wystąpił problem podczas przygotowywania pliku.');
        } else {
            throw new Error(`Błąd serwera: ${response.status} ${response.statusText}`);
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const contentDisposition = response.headers.get('content-disposition');
      let fileName = 'ebook.pdf';
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
        if (fileNameMatch && fileNameMatch.length === 2) {
          fileName = fileNameMatch[1];
        }
      }

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setDownloadStarted(true);

    } catch (error) {
      console.error('Błąd podczas pobierania ebooka:', error);
      setDownloadError(error instanceof Error ? error.message : 'Nieznany błąd');
    } finally {
      setIsDownloading(false);
    }
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isPreviewMode) {
      return;
    }

    if (!pageId) {
      setSubmitError('Brak identyfikatora strony. Nie można zapisać danych.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const leadData = {
        pageId: pageId,
        leadName: name,
        leadEmail: email,
        leadPhone: phone || undefined
      };

      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Wystąpił problem podczas zapisywania danych');
      }

      setSubmitted(true);
      setDownloadStarted(false);

    } catch (error) {
      console.error('Błąd podczas wysyłania formularza:', error);
      setSubmitError(error instanceof Error ? error.message : 'Nieznany błąd');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Input style helper — reads focus state from component
  const getInputStyle = (inputId: string): React.CSSProperties => ({
    backgroundColor: theme.inputBg,
    borderColor: focusedInput === inputId ? theme.inputFocusBorder : theme.inputBorder,
    color: theme.inputText,
    boxShadow: focusedInput === inputId ? `0 0 0 3px ${theme.inputFocusRing}` : 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  });

  // Shared glass-card style object to avoid repetition
  const glassCard: React.CSSProperties = {
    backgroundColor: theme.cardBg,
    border: `1px solid ${theme.cardBorder}`,
    boxShadow: theme.cardShadow,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  };

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------
  return (
    <div
      className="font-sans overflow-hidden pt-20"
      style={{
        backgroundColor: theme.pageBg,
        color: theme.pageText,
        fontFamily: theme.bodyFont,
      }}
    >
      {/* ================================================================ */}
      {/* HEADER — nav (left) + partner info (right)                        */}
      {/* ================================================================ */}
      {/* Logo tymczasowo ukryte. Content ograniczony do LAYOUT.maxW jak    */}
      {/* sekcja hero — pełnoszerokie tło, content wycentrowany w kontenerze.*/}
      <header
        className="fixed top-0 left-0 w-full h-20 z-50"
        style={{
          backgroundColor: theme.headerBg,
          borderBottom: `1px solid ${theme.headerBorder}`,
          boxShadow: theme.headerShadow,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div className={`mx-auto h-full flex items-center justify-between ${LAYOUT.px} ${LAYOUT.maxW}`}>

          {/* ── LEFT — desktop nav lub mobile hamburger ─────────────── */}

          {/* Desktop nav (lg+) — od lewej */}
          <nav className="hidden lg:flex items-center gap-7">
            {navLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium transition-colors"
                style={{ color: theme.pageText, opacity: 0.75 }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = theme.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.75'; e.currentTarget.style.color = theme.pageText; }}
              >
                {link.label}
              </a>
            ))}
            <a
              href={navCta.href}
              className="ml-2 px-4 py-2 rounded-full text-sm font-semibold transition-all"
              style={{
                backgroundColor: theme.accent,
                color: theme.ctaText,
                boxShadow: theme.ctaShadow,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {navCta.label}
            </a>
          </nav>

          {/* Mobile hamburger (do lg) — po lewej */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden flex items-center justify-center w-11 h-11 rounded-lg transition-colors cursor-pointer -ml-2"
            style={{ color: theme.pageText }}
            aria-label={isEN ? 'Open menu' : 'Otwórz menu'}
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* ── RIGHT MOBILE — podpis + profilowe (do lg) ─────────────── */}
          {/* Skondensowany layout: tekst po lewej, avatar po prawej. */}
          {/* Mniejsze rozmiary niż desktop żeby zmieściło się obok hamburgera. */}
          <div className="flex lg:hidden items-center gap-2.5">
            <div className="flex flex-col items-end justify-center">
              <span className="text-xs leading-tight" style={{ color: theme.pageSubtext }}>
                {isEN ? 'made by' : 'stworzone przez'}{' '}
                <span style={{ color: theme.pageText, opacity: 0.85 }}>{partnerName}</span>
              </span>
              <div className="w-full h-px my-0.5" style={{ backgroundColor: theme.divider }}></div>
              <span className="text-[0.65rem] leading-tight" style={{ color: theme.pageSubtext }}>
                {isEN ? 'with' : 'z'}{' '}
                <span style={{ color: theme.pageText, opacity: 0.85 }}>inflee.app</span>
              </span>
            </div>

            {resolvedPartnerLogoUrl && (
              <div
                className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
                style={{ border: `1.5px solid ${theme.cardBorder}` }}
              >
                <Image
                  src={resolvedPartnerLogoUrl}
                  alt={partnerName}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
            )}
          </div>

          {/* ── RIGHT — partner info (desktop only) ─────────────────── */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Tekst: made by [name] / with inflee.app — klasycznie, bez ozdobników */}
            <div className="flex flex-col items-end justify-center">
              <span className="text-sm" style={{ color: theme.pageSubtext }}>
                {isEN ? 'made by' : 'stworzone przez'}{' '}
                <span style={{ color: theme.pageText, opacity: 0.85 }}>{partnerName}</span>
              </span>
              <div className="w-full h-px my-0.5" style={{ backgroundColor: theme.divider }}></div>
              <span className="text-xs" style={{ color: theme.pageSubtext }}>
                {isEN ? 'with' : 'z'}{' '}
                <span style={{ color: theme.pageText, opacity: 0.85 }}>inflee.app</span>
              </span>
            </div>

            {/* Avatar — opcjonalny, po prawej tekstu */}
            {resolvedPartnerLogoUrl && (
              <div
                className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0"
                style={{ border: `1.5px solid ${theme.cardBorder}` }}
              >
                <Image
                  src={resolvedPartnerLogoUrl}
                  alt={partnerName}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/* MOBILE NAV DRAWER — fullscreen overlay (do lg)                    */}
      {/* ================================================================ */}
      <div
        className={`fixed inset-0 z-[60] lg:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          backgroundColor: theme.pageBg,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {/* Drawer header — podpis (orientacja jak desktop) + close */}
        {/* Layout: [.................podpis + avatar] gap [X] */}
        <div
          className="h-20 flex items-center justify-end px-4 sm:px-6 gap-3"
          style={{ borderBottom: `1px solid ${theme.headerBorder}` }}
        >
          {/* Podpis — taka sama orientacja jak w desktop right side: */}
          {/* tekst right-aligned (items-end), avatar po prawej tekstu. */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex flex-col items-end min-w-0">
              <span className="text-sm leading-tight truncate" style={{ color: theme.pageSubtext }}>
                {isEN ? 'made by' : 'stworzone przez'}{' '}
                <span style={{ color: theme.pageText, opacity: 0.85 }}>{partnerName}</span>
              </span>
              <span className="text-xs leading-tight mt-0.5" style={{ color: theme.pageSubtext }}>
                {isEN ? 'with' : 'z'}{' '}
                <span style={{ color: theme.pageText, opacity: 0.85 }}>inflee.app</span>
              </span>
            </div>
            {resolvedPartnerLogoUrl && (
              <div
                className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0"
                style={{ border: `1.5px solid ${theme.cardBorder}` }}
              >
                <Image
                  src={resolvedPartnerLogoUrl}
                  alt={partnerName}
                  width={44}
                  height={44}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
            )}
          </div>

          {/* Close button — po prawej brzegu */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center w-11 h-11 rounded-lg transition-colors cursor-pointer flex-shrink-0"
            style={{ color: theme.pageText }}
            aria-label={isEN ? 'Close menu' : 'Zamknij menu'}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Drawer body — nav links stacked + CTA */}
        <nav className="px-6 sm:px-8 py-8 flex flex-col">
          {navLinks.map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="text-xl font-medium py-3.5 transition-opacity"
              style={{
                color: theme.pageText,
                fontFamily: theme.headingFont,
                borderTop: i === 0 ? 'none' : `1px solid ${theme.divider}`,
                opacity: 0.9,
              }}
            >
              {link.label}
            </a>
          ))}
          <a
            href={navCta.href}
            onClick={() => setMobileMenuOpen(false)}
            className="mt-8 px-6 py-3.5 rounded-full text-base font-semibold text-center transition-all"
            style={{
              backgroundColor: theme.accent,
              color: theme.ctaText,
              boxShadow: theme.ctaShadow,
            }}
          >
            {navCta.label}
          </a>
        </nav>

      </div>

      {/* ================================================================ */}
      {/* HERO SECTION                                                     */}
      {/* ================================================================ */}
      <section
        id="hero"
        className={`relative pt-8 sm:pt-12 lg:pt-6 pb-16 sm:pb-24 overflow-x-hidden transition-all duration-700 ease-out
          ${elements.hero ? 'opacity-100' : 'opacity-0 translate-y-10'}`}
      >
        <div className={`mx-auto ${LAYOUT.px} ${LAYOUT.maxW}`}>
          <div className="flex flex-col lg:flex-row items-center relative z-10 gap-8 sm:gap-10 lg:gap-16 xl:gap-20">
            {/* Left column — text */}
            <div className="lg:w-1/2 mb-8 lg:mb-0 w-full">
              {/* Eyebrow label — bezpłatny e-book */}
              <div
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold mb-5 sm:mb-6 uppercase tracking-wide"
                style={{
                  backgroundColor: theme.accentSubtle,
                  color: theme.accent,
                  fontFamily: theme.bodyFont,
                  letterSpacing: '0.08em',
                }}
              >
                {isEN ? 'Free e-book' : 'Bezpłatny e-book'}
              </div>

              {/* h1 — headline_l1 (transformacja PRZED → PO) */}
              <EditableText
                fieldName="hero.headline_l1"
                value={pageContent.hero.headline_l1 ?? ''}
                tag="h1"
                isEditMode={isTextEditMode || false}
                editLabel={editLabel}
                editedLabel={editedLabel}
                onChange={handleTextChange}
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4 sm:mb-5 leading-tight text-left break-words"
                style={{
                  color: theme.pageText,
                  fontFamily: theme.headingFont,
                }}
              />

              {/* Decorative divider between h1 and h2 */}
              <div
                className="w-32 sm:w-48 h-px mb-4 sm:mb-5 rounded-full ml-0 mr-auto"
                style={{ background: theme.dividerAccent, opacity: 0.6 }}
              ></div>

              {/* h2 — headline_l2 (sentence case, accent color) */}
              <EditableText
                fieldName="hero.headline_l2"
                value={pageContent.hero.headline_l2 ?? ''}
                tag="h2"
                isEditMode={isTextEditMode || false}
                editLabel={editLabel}
                editedLabel={editedLabel}
                onChange={handleTextChange}
                className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-5 sm:mb-6 leading-tight text-left break-words"
                style={{
                  color: theme.accent,
                  fontFamily: theme.headingFont,
                }}
              />

              {/* Subheadline — mechanizm w jednym zdaniu */}
              <EditableText
                fieldName="hero.subheadline"
                value={pageContent.hero.subheadline ?? ''}
                tag="p"
                isEditMode={isTextEditMode || false}
                editLabel={editLabel}
                editedLabel={editedLabel}
                onChange={handleTextChange}
                multiline={true}
                maxLength={400}
                className="text-base sm:text-lg lg:text-xl mb-6 sm:mb-8 leading-relaxed font-light"
                style={{
                  color: theme.pageSubtext,
                  fontFamily: theme.bodyFont,
                }}
              />

              {/* Mobile mockup — shown only on small screens */}
              <div className="block lg:hidden w-full mb-6 sm:mb-8">
                <div className="mx-auto max-w-xs">
                  <Image
                    src={mockupUrl}
                    alt="E-book Mockup"
                    className="w-full h-auto"
                    width={300}
                    height={400}
                    priority
                    sizes="(max-width: 600px) 300px, 400px"
                  />
                  {/* Stats beneath mobile mockup */}
                  {ebookMeta && (ebookMeta.chapterCount > 0 || ebookMeta.estimatedPages > 0) && (
                    <p className="text-center mt-4 text-xs sm:text-sm" style={{ color: theme.pageSubtext }}>
                      {ebookMeta.chapterCount > 0 && (
                        <><span style={{ color: theme.accent, fontWeight: 600 }}>{ebookMeta.chapterCount}</span>{' '}{ui.statChapter(ebookMeta.chapterCount)}</>
                      )}
                      {ebookMeta.chapterCount > 0 && ebookMeta.estimatedPages > 0 && (
                        <span style={{ opacity: 0.4 }}>{' · '}</span>
                      )}
                      {ebookMeta.estimatedPages > 0 && (
                        <><span style={{ color: theme.accent, fontWeight: 600 }}>{ebookMeta.estimatedPages}</span>{' '}{ui.statPages}</>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Barriers — 3 negacje "Bez ..." pokazują że proces jest prosty/dostępny */}
              {Array.isArray(pageContent.hero.barriers) && pageContent.hero.barriers.length > 0 && (
                <ul className="space-y-2.5 sm:space-y-3 mb-7 sm:mb-9">
                  {pageContent.hero.barriers.map((barrier, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        className="w-5 h-5 rounded-full flex-shrink-0 mt-1 flex items-center justify-center"
                        style={{
                          backgroundColor: theme.bulletCircleBg,
                          border: `1px solid ${theme.bulletCircleBorder}`,
                        }}
                      >
                        <Check className="w-3 h-3" style={{ color: theme.iconColor }} />
                      </span>
                      <EditableText
                        fieldName={`hero.barriers.${i}`}
                        value={barrier ?? ''}
                        tag="span"
                        isEditMode={isTextEditMode || false}
                        editLabel={editLabel}
                        editedLabel={editedLabel}
                        onChange={handleTextChange}
                        multiline={false}
                        maxLength={120}
                        className="text-sm sm:text-base leading-relaxed flex-1"
                        style={{
                          color: theme.pageText,
                          fontFamily: theme.bodyFont,
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {/* CTA button — w trybie edycji bez href (żeby kliknięcie nie nawigowało) */}
              <div className="text-center lg:text-left mt-2 lg:mt-2">
                {isTextEditMode ? (
                  <span
                    className="inline-flex items-center justify-center rounded-full px-6 sm:px-8 py-3.5 sm:py-4 font-semibold text-sm sm:text-base"
                    style={{
                      background: theme.ctaBg,
                      color: theme.ctaText,
                      boxShadow: `${theme.ctaShadow}, ${theme.ctaGlow}`,
                    }}
                  >
                    <EditableText
                      fieldName="hero.cta_primary"
                      value={pageContent.hero.cta_primary ?? ''}
                      tag="span"
                      isEditMode={true}
                      editLabel={editLabel}
                      editedLabel={editedLabel}
                      onChange={handleTextChange}
                      multiline={false}
                      maxLength={50}
                      className="mr-2 sm:mr-3 inline-block"
                    />
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: theme.ctaText }} />
                  </span>
                ) : (
                  <AnimatedButton href="#signup" theme={theme}>
                    {pageContent.hero.cta_primary ?? ''}
                  </AnimatedButton>
                )}
              </div>
            </div>

            {/* Right column — desktop e-book mockup (larger) */}
            <div className="lg:w-1/2 hidden lg:flex flex-col items-center pl-0 lg:pl-8 xl:pl-12">
              <div className="w-72 md:w-96 lg:w-[28rem] xl:w-[34rem]">
                <Image
                  src={mockupUrl}
                  alt="E-book Mockup"
                  className="w-full h-auto"
                  width={680}
                  height={900}
                  priority
                  sizes="(max-width: 768px) 300px, (max-width: 1024px) 450px, 560px"
                />
              </div>
              {/* Stats beneath desktop mockup */}
              {ebookMeta && (ebookMeta.chapterCount > 0 || ebookMeta.estimatedPages > 0) && (
                <p className="text-center mt-5 text-sm" style={{ color: theme.pageSubtext }}>
                  {ebookMeta.chapterCount > 0 && (
                    <><span style={{ color: theme.accent, fontWeight: 600 }}>{ebookMeta.chapterCount}</span>{' '}{ui.statChapter(ebookMeta.chapterCount)}</>
                  )}
                  {ebookMeta.chapterCount > 0 && ebookMeta.estimatedPages > 0 && (
                    <span style={{ opacity: 0.4 }}>{' · '}</span>
                  )}
                  {ebookMeta.estimatedPages > 0 && (
                    <><span style={{ color: theme.accent, fontWeight: 600 }}>{ebookMeta.estimatedPages}</span>{' '}{ui.statPages}</>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* PROBLEM SECTION — editorial, narrative, accent-bar storytelling   */}
      {/* ================================================================ */}
      {pageContent.problem && (
        <section
          id="problem"
          className={`${LAYOUT.sectionPy} transition-all duration-700 ease-out
            ${elements.problem ? 'opacity-100' : 'opacity-0 translate-y-10'}`}
          style={{ backgroundColor: theme.sectionAltBg }}
        >
          <div className={`mx-auto ${LAYOUT.px} ${LAYOUT.maxW}`}>

            {/* Eyebrow — narracyjny, uniwersalny */}
            <div className="text-center mb-4 sm:mb-5">
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase"
                style={{
                  backgroundColor: theme.accentSubtle,
                  color: theme.accent,
                  fontFamily: theme.bodyFont,
                  letterSpacing: '0.12em',
                }}
              >
                {isEN ? 'Know this?' : 'Brzmi znajomo?'}
              </span>
            </div>

            {/* Headline — hook (max 8 słów) — pełna szerokość kontenera */}
            <EditableText
              fieldName="problem.headline"
              value={pageContent.problem.headline ?? ''}
              tag="h2"
              isEditMode={isTextEditMode || false}
              editLabel={editLabel}
              editedLabel={editedLabel}
              onChange={handleTextChange}
              maxLength={150}
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-center mb-5 sm:mb-7 leading-tight tracking-tight"
              style={{
                color: theme.pageText,
                fontFamily: theme.headingFont,
              }}
            />

            {/* Intro — żywa scena zmysłowa (max 40 słów) — pełna szerokość */}
            <EditableText
              fieldName="problem.intro"
              value={pageContent.problem.intro ?? ''}
              tag="p"
              isEditMode={isTextEditMode || false}
              editLabel={editLabel}
              editedLabel={editedLabel}
              onChange={handleTextChange}
              multiline={true}
              maxLength={400}
              className="text-lg sm:text-xl lg:text-2xl mb-14 sm:mb-20 text-center leading-relaxed font-light italic"
              style={{
                color: theme.pageSubtext,
                fontFamily: theme.bodyFont,
              }}
            />

            {/* Pains — 2-column editorial grid, accent bar storytelling   */}
            {Array.isArray(pageContent.problem.pains) && pageContent.problem.pains.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-10 sm:gap-y-12 mb-14 sm:mb-20">
                {/*
                  Wyświetlamy max 6 painów (parzysta siatka 2×3).
                  Generator AI generuje 6-8 — slice(0, 6) zapewnia że
                  prawy dolny róg nigdy nie jest pusty. Na mobile
                  (1 col) liczba i tak nie ma znaczenia wizualnego.
                */}
                {pageContent.problem.pains.slice(0, 6).map((pain, i) => (
                  <article
                    key={i}
                    className="relative pl-5 sm:pl-6"
                  >
                    {/* Lewy pionowy pasek akcent — kotwica wizualna każdej historii */}
                    <div
                      className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                      style={{ background: theme.dividerAccent, opacity: 0.55 }}
                      aria-hidden="true"
                    ></div>

                    {/* Title — hero typografii pain story */}
                    <EditableText
                      fieldName={`problem.pains.${i}.title`}
                      value={pain.title ?? ''}
                      tag="h3"
                      isEditMode={isTextEditMode || false}
                      editLabel={editLabel}
                      editedLabel={editedLabel}
                      onChange={handleTextChange}
                      maxLength={150}
                      className="text-xl sm:text-2xl lg:text-[1.625rem] font-bold mb-3 sm:mb-4 leading-tight tracking-tight"
                      style={{
                        color: theme.pageText,
                        fontFamily: theme.headingFont,
                      }}
                    />

                    {/* Text — naturalny rytm czytania */}
                    <EditableText
                      fieldName={`problem.pains.${i}.text`}
                      value={pain.text ?? ''}
                      tag="p"
                      isEditMode={isTextEditMode || false}
                      editLabel={editLabel}
                      editedLabel={editedLabel}
                      onChange={handleTextChange}
                      multiline={true}
                      maxLength={400}
                      className="text-base sm:text-lg leading-relaxed"
                      style={{
                        color: theme.pageSubtext,
                        fontFamily: theme.bodyFont,
                      }}
                    />
                  </article>
                ))}
              </div>
            )}

            {/* ─── SUMMARY — pull-quote puenta ───────────────────────────── */}
            {/* Wycentrowana, eleganckie wzmocnienie wizualne (subtle bg +    */}
            {/* dwa accent dashes po bokach), znacząco większa typograficznie */}
            {/* niż text painów — czytelnik widzi że to konkluzja, bez       */}
            {/* krzyczenia kolorem czy obwódkami.                            */}
            <div className="mt-2 sm:mt-4">
              <div
                className="relative rounded-2xl px-8 sm:px-12 py-8 sm:py-10"
                style={{
                  backgroundColor: theme.accentSubtle,
                  border: `1px solid ${theme.cardBorder}`,
                }}
              >
                {/* Decorative dashes left & right — pull-quote markery */}
                <div className="flex items-center justify-center gap-4 mb-5 sm:mb-6">
                  <div
                    className="h-px w-12 sm:w-16 rounded-full"
                    style={{ background: theme.dividerAccent, opacity: 0.6 }}
                    aria-hidden="true"
                  ></div>
                  <span
                    className="text-xs font-semibold uppercase"
                    style={{
                      color: theme.accent,
                      fontFamily: theme.bodyFont,
                      letterSpacing: '0.18em',
                    }}
                  >
                    {isEN ? 'The reality' : 'Sedno'}
                  </span>
                  <div
                    className="h-px w-12 sm:w-16 rounded-full"
                    style={{ background: theme.dividerAccent, opacity: 0.6 }}
                    aria-hidden="true"
                  ></div>
                </div>

                <EditableText
                  fieldName="problem.summary"
                  value={pageContent.problem.summary ?? ''}
                  tag="p"
                  isEditMode={isTextEditMode || false}
                  editLabel={editLabel}
                  editedLabel={editedLabel}
                  onChange={handleTextChange}
                  multiline={true}
                  maxLength={250}
                  className="text-xl sm:text-2xl lg:text-3xl text-center leading-snug font-semibold"
                  style={{
                    color: theme.pageText,
                    fontFamily: theme.headingFont,
                    letterSpacing: '-0.02em',
                  }}
                />
              </div>
            </div>

          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* PROMISE SECTION — bridge from pain to solution                    */}
      {/* ================================================================ */}
      {/* Layout:                                                           */}
      {/*   ┌───────────────────────────────────────────────────────────┐   */}
      {/*   │ LABEL + HEADLINE         │  TEXT (rozwinięcie z refrenem) │   */}
      {/*   │ (lewa kolumna)           │  (prawa kolumna)               │   */}
      {/*   ├───────────────────────────────────────────────────────────┤   */}
      {/*   │  [1] outcome  │  [2] outcome  │  [3] outcome              │   */}
      {/*   │     (3 równoważne karty w jednym wierszu)                 │   */}
      {/*   └───────────────────────────────────────────────────────────┘   */}
      {pageContent.promise && (
        <section
          id="promise"
          className={`${LAYOUT.sectionPy} relative overflow-hidden transition-all duration-700 ease-out
            ${elements.promise ? 'opacity-100' : 'opacity-0 translate-y-10'}`}
          style={{ backgroundColor: theme.pageBg }}
        >
          {/* Subtle radial accent w tle — sygnalizuje "moment światła" */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 1000px 600px at 50% 50%, ${theme.accentSubtle}, transparent 70%)`,
              opacity: 0.5,
            }}
            aria-hidden="true"
          ></div>

          <div className={`relative mx-auto ${LAYOUT.px} ${LAYOUT.maxW}`}>

            {/* ═══ TOP — duet 2-col rozdzielony pionową linią ═══════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-0 mb-12 sm:mb-14 lg:mb-16">

              {/* Lewa kolumna — label + headline */}
              <div className="lg:pr-12 xl:pr-16">
                {/* Label — eyebrow */}
                <EditableText
                  fieldName="promise.label"
                  value={pageContent.promise.label ?? ''}
                  tag="div"
                  isEditMode={isTextEditMode || false}
                  editLabel={editLabel}
                  editedLabel={editedLabel}
                  onChange={handleTextChange}
                  maxLength={80}
                  className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase mb-5 sm:mb-6"
                  style={{
                    backgroundColor: theme.accentSubtle,
                    color: theme.accent,
                    fontFamily: theme.bodyFont,
                    letterSpacing: '0.12em',
                  }}
                />

                {/* Headline — główna obietnica */}
                <EditableText
                  fieldName="promise.headline"
                  value={pageContent.promise.headline ?? ''}
                  tag="h2"
                  isEditMode={isTextEditMode || false}
                  editLabel={editLabel}
                  editedLabel={editedLabel}
                  onChange={handleTextChange}
                  maxLength={200}
                  className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight"
                  style={{
                    color: theme.pageText,
                    fontFamily: theme.headingFont,
                  }}
                />
              </div>

              {/* Prawa kolumna — text z pionową linią po lewej (na desktopie) */}
              <div
                className="lg:pl-12 xl:pl-16 lg:border-l flex items-center"
                style={{
                  borderLeftColor: theme.divider,
                }}
              >
                <EditableText
                  fieldName="promise.text"
                  value={pageContent.promise.text ?? ''}
                  tag="p"
                  isEditMode={isTextEditMode || false}
                  editLabel={editLabel}
                  editedLabel={editedLabel}
                  onChange={handleTextChange}
                  multiline={true}
                  maxLength={600}
                  className="text-base sm:text-lg lg:text-xl leading-relaxed font-light"
                  style={{
                    color: theme.pageSubtext,
                    fontFamily: theme.bodyFont,
                  }}
                />
              </div>
            </div>

            {/* ═══ BOTTOM — 3 outcomes vertical stack (jeden pod drugim) ═ */}
            {/* Outcomes to KOŃCOWE REZULTATY (po przeczytaniu e-booka):  */}
            {/* krótkie, mocne, bez kotwicy czasowej i dwukropków.        */}
            {/* Vs content section niżej — która pokazuje DROGĘ do nich.  */}
            {Array.isArray(pageContent.promise.outcomes) && (
              <div className="space-y-3 sm:space-y-4">
                {pageContent.promise.outcomes.map((outcome, i) => (
                  <div
                    key={i}
                    className="rounded-2xl px-6 sm:px-7 py-5 sm:py-6 flex items-center gap-5 sm:gap-6 transition-all duration-300"
                    style={{
                      backgroundColor: theme.accentSubtle,
                      border: `1px solid ${theme.cardBorder}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.accent;
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.cardBorder;
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    {/* Ikona wzrost/sukces — uniwersalny symbol końcowego rezultatu */}
                    <div
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: theme.pageBg,
                        border: `1.5px solid ${theme.accent}`,
                      }}
                    >
                      <TrendingUp
                        className="w-5 h-5 sm:w-6 sm:h-6"
                        style={{ color: theme.accent }}
                        strokeWidth={2.25}
                      />
                    </div>

                    {/* Outcome text */}
                    <div className="flex-1 min-w-0">
                      <EditableText
                        fieldName={`promise.outcomes.${i}`}
                        value={outcome ?? ''}
                        tag="p"
                        isEditMode={isTextEditMode || false}
                        editLabel={editLabel}
                        editedLabel={editedLabel}
                        onChange={handleTextChange}
                        multiline={false}
                        maxLength={150}
                        className="text-base sm:text-lg lg:text-xl leading-snug font-semibold"
                        style={{
                          color: theme.pageText,
                          fontFamily: theme.headingFont,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* BENEFITS SECTION — 6-8 konkretnych narzędzi/metod                  */}
      {/* ================================================================ */}
      {/* Single column, każdy item to glass card z ikoną z whitelisty +    */}
      {/* tytułem (konkretna rzecz) + tekstem (mechanizm + rezultat).        */}
      {/* Vs problem (ból) — tu perspektywa REZULTATU, co czytelnik MA.      */}
      {pageContent.benefits && (
        <section
          id="benefits"
          className={`${LAYOUT.sectionPy} transition-all duration-700 ease-out
            ${elements.benefits ? 'opacity-100' : 'opacity-0 translate-y-10'}`}
        >
          <div className={`mx-auto ${LAYOUT.px} ${LAYOUT.maxW}`}>
            {/* Header — headline + subheadline, oba edytowalne */}
            <div className={`text-center max-w-3xl mx-auto ${LAYOUT.headingMb}`}>
              <EditableText
                fieldName="benefits.headline"
                value={pageContent.benefits.headline ?? ''}
                tag="h2"
                isEditMode={isTextEditMode || false}
                editLabel={editLabel}
                editedLabel={editedLabel}
                onChange={handleTextChange}
                maxLength={150}
                className={`${LAYOUT.headingSize} font-bold mb-3 sm:mb-4 leading-tight tracking-tight`}
                style={{ fontFamily: theme.headingFont, color: theme.pageText }}
              />
              {pageContent.benefits.subheadline && (
                <EditableText
                  fieldName="benefits.subheadline"
                  value={pageContent.benefits.subheadline}
                  tag="p"
                  isEditMode={isTextEditMode || false}
                  editLabel={editLabel}
                  editedLabel={editedLabel}
                  onChange={handleTextChange}
                  multiline={true}
                  maxLength={250}
                  className="text-base sm:text-lg leading-relaxed font-light"
                  style={{ color: theme.pageSubtext, fontFamily: theme.bodyFont }}
                />
              )}
            </div>

            {/* Items — single column, glass cards */}
            <div className={`flex flex-col ${LAYOUT.gap}`}>
              {(pageContent.benefits.items ?? []).map((item, index) => {
                // Resolve ikonę z mappingu — fallback gdy string nie pasuje
                const IconComponent = BENEFIT_ICON_MAP[item.icon] ?? FALLBACK_BENEFIT_ICON;

                return (
                  <div
                    key={index}
                    className={`group ${LAYOUT.cardP} rounded-2xl transition-all duration-300 flex items-start gap-5 sm:gap-6`}
                    style={glassCard}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.cardHoverBorder;
                      e.currentTarget.style.boxShadow = theme.cardHoverShadow;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.cardBorder;
                      e.currentTarget.style.boxShadow = theme.cardShadow;
                    }}
                  >
                    {/* Icon — z whitelisty (lucide), dobrana semantycznie przez AI */}
                    <div
                      className="w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        backgroundColor: theme.iconCircleBg,
                        border: `1px solid ${theme.iconCircleBorder}`,
                      }}
                    >
                      <IconComponent
                        className="w-5 h-5 sm:w-6 sm:h-6"
                        style={{ color: theme.iconColor }}
                      />
                    </div>

                    {/* Title + text */}
                    <div className="flex-1 min-w-0">
                      <EditableText
                        fieldName={`benefits.items.${index}.title`}
                        value={item.title ?? ''}
                        tag="h3"
                        isEditMode={isTextEditMode || false}
                        editLabel={editLabel}
                        editedLabel={editedLabel}
                        onChange={handleTextChange}
                        maxLength={120}
                        className="text-lg sm:text-xl font-bold mb-1.5 sm:mb-2 transition-colors leading-snug"
                        style={{
                          fontFamily: theme.headingFont,
                          color: theme.pageText,
                        }}
                      />
                      <EditableText
                        fieldName={`benefits.items.${index}.text`}
                        value={item.text ?? ''}
                        tag="p"
                        isEditMode={isTextEditMode || false}
                        editLabel={editLabel}
                        editedLabel={editedLabel}
                        onChange={handleTextChange}
                        multiline={true}
                        maxLength={400}
                        className="text-sm sm:text-base leading-relaxed"
                        style={{ color: theme.pageSubtext, fontFamily: theme.bodyFont }}
                      />
                      {/* Accent bar */}
                      <div
                        className="w-10 h-1 mt-3 sm:mt-4 rounded-full"
                        style={{ background: theme.dividerAccent }}
                        aria-hidden="true"
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Secondary CTA pod listą benefits */}
            <div className={`${LAYOUT.headingMb} text-center`} style={{ marginBottom: 0, marginTop: '2.5rem' }}>
              <a
                href="#signup"
                className="inline-flex items-center justify-center px-6 sm:px-7 py-2.5 sm:py-3 rounded-full font-medium text-sm sm:text-base transition-all duration-300"
                style={{
                  color: theme.secondaryText,
                  backgroundColor: theme.secondaryBg,
                  border: `1px solid ${theme.secondaryBorder}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.secondaryHoverBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.secondaryBg;
                }}
              >
                {ui.learnMore}
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* CONTENT SECTION — 4 WIIFM milestones + TOC e-booka                 */}
      {/* ================================================================ */}
      {/* WIIFM = What's In It For Me — 4 wymiary korzyści dla czytelnika.  */}
      {/* Vs benefits (narzędzia/metody), tu osobiste konsekwencje:         */}
      {/* czas / spokój / pieniądze / status / energia / wolność etc.       */}
      {/* TOC pod spodem — real chapters z ebooka (dane spoza pageContent). */}
      {(pageContent.content || (ebookMeta && ebookMeta.chapters.length > 0)) && (
        <section
          id="content"
          className={`${LAYOUT.sectionPy} transition-all duration-700 ease-out
            ${elements.content ? 'opacity-100' : 'opacity-0 translate-y-10'}`}
          style={{ backgroundColor: theme.sectionAltBg }}
        >
          <div className={`mx-auto ${LAYOUT.px} ${LAYOUT.maxW}`}>

            {/* ─── WIIFM milestones (top) ─────────────────────────────── */}
            {pageContent.content && (
              <>
                {/* Header — headline + subheadline */}
                <div className={`text-center ${LAYOUT.headingMb}`}>
                  <EditableText
                    fieldName="content.headline"
                    value={pageContent.content.headline ?? ''}
                    tag="h2"
                    isEditMode={isTextEditMode || false}
                    editLabel={editLabel}
                    editedLabel={editedLabel}
                    onChange={handleTextChange}
                    maxLength={150}
                    className={`${LAYOUT.headingSize} font-bold mb-3 sm:mb-4 leading-tight tracking-tight`}
                    style={{ fontFamily: theme.headingFont, color: theme.pageText }}
                  />
                  {pageContent.content.subheadline && (
                    <EditableText
                      fieldName="content.subheadline"
                      value={pageContent.content.subheadline}
                      tag="p"
                      isEditMode={isTextEditMode || false}
                      editLabel={editLabel}
                      editedLabel={editedLabel}
                      onChange={handleTextChange}
                      multiline={true}
                      maxLength={250}
                      className="text-base sm:text-lg leading-relaxed font-light max-w-2xl mx-auto"
                      style={{ color: theme.pageSubtext, fontFamily: theme.bodyFont }}
                    />
                  )}
                </div>

                {/* 4 milestones — editorial 2-col grid, accent bar storytelling */}
                {Array.isArray(pageContent.content.items) && pageContent.content.items.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-10 sm:gap-y-12">
                    {pageContent.content.items.map((item, i) => (
                      <article
                        key={i}
                        className="relative pl-5 sm:pl-6"
                      >
                        {/* Lewy pionowy pasek akcent — kotwica wizualna */}
                        <div
                          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                          style={{ background: theme.dividerAccent, opacity: 0.7 }}
                          aria-hidden="true"
                        ></div>

                        {/* Title — co czytelnik MA / przestaje / zaczyna */}
                        <EditableText
                          fieldName={`content.items.${i}.title`}
                          value={item.title ?? ''}
                          tag="h3"
                          isEditMode={isTextEditMode || false}
                          editLabel={editLabel}
                          editedLabel={editedLabel}
                          onChange={handleTextChange}
                          maxLength={120}
                          className="text-xl sm:text-2xl lg:text-[1.625rem] font-bold mb-3 sm:mb-4 leading-tight tracking-tight"
                          style={{
                            color: theme.pageText,
                            fontFamily: theme.headingFont,
                          }}
                        />

                        {/* Text — dlaczego to dla CIEBIE dobre, deklaratywnie */}
                        <EditableText
                          fieldName={`content.items.${i}.text`}
                          value={item.text ?? ''}
                          tag="p"
                          isEditMode={isTextEditMode || false}
                          editLabel={editLabel}
                          editedLabel={editedLabel}
                          onChange={handleTextChange}
                          multiline={true}
                          maxLength={300}
                          className="text-base sm:text-lg leading-relaxed"
                          style={{
                            color: theme.pageSubtext,
                            fontFamily: theme.bodyFont,
                          }}
                        />
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ─── TOC accordion (bottom) — real chapters z ebooka ────── */}
            {ebookMeta && ebookMeta.chapters.length > 0 && (
              <div className={`${pageContent.content ? 'mt-12 sm:mt-16' : ''}`}>
                <button
                  onClick={() => setTocOpen(prev => !prev)}
                  className="w-full flex items-center justify-between px-6 sm:px-8 py-4 sm:py-5 rounded-2xl text-left transition-all cursor-pointer"
                  style={{
                    border: `1px solid ${tocOpen ? theme.accent : theme.cardBorder}`,
                    backgroundColor: theme.cardBg,
                    boxShadow: theme.cardShadow,
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5" style={{ color: theme.accent }} />
                    <span className="text-sm sm:text-base font-semibold" style={{ color: theme.pageText }}>
                      {ui.tocToggleLabel(ebookMeta.chapters.length)}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 transition-transform duration-300 ${tocOpen ? 'rotate-180' : ''}`}
                    style={{ color: theme.accent }}
                  />
                </button>

                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${tocOpen ? 'max-h-[5000px]' : 'max-h-0'}`}>
                  <div
                    className="border border-t-0 rounded-b-2xl"
                    style={{ borderColor: tocOpen ? theme.accent : theme.cardBorder, backgroundColor: theme.cardBg }}
                  >
                    {ebookMeta.chapters.map((ch, idx) => (
                      <div
                        key={ch.position}
                        className="flex gap-4 px-6 sm:px-8 py-4 sm:py-5"
                        style={{ borderTop: idx > 0 ? `1px solid ${theme.divider}` : 'none' }}
                      >
                        <span
                          className="text-xs font-bold w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: theme.accentSubtle, color: theme.accent }}
                        >
                          {String(ch.position).padStart(2, '0')}
                        </span>
                        <div>
                          <p className="text-sm sm:text-base font-semibold" style={{ color: theme.pageText }}>{ch.title}</p>
                          {ch.preview && (
                            <p className="text-xs sm:text-sm mt-1.5 leading-relaxed" style={{ color: theme.pageSubtext }}>{ch.preview}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* FAQ SECTION — 7-9 obiekcji psychologicznych                       */}
      {/* ================================================================ */}
      {/* "Czy warto?" + "Czy dam radę?" — empatyczne 3-częściowe odpowiedzi */}
      {pageContent.faq && (
        <section
          id="faq"
          className={`${LAYOUT.sectionPy} transition-all duration-700 ease-out
            ${elements.faq ? 'opacity-100' : 'opacity-0 translate-y-10'}`}
          style={{ backgroundColor: theme.sectionAltBg }}
        >
          <div className={`mx-auto ${LAYOUT.px} ${LAYOUT.maxW}`}>
            {/* Subtelna linia podziału — separacja FAQ od poprzedniej sekcji */}
            <div
              className="mx-auto h-px mb-12 sm:mb-16 max-w-md"
              style={{ background: theme.dividerAccent, opacity: 0.35 }}
              aria-hidden="true"
            ></div>

            {/* Headline edytowalny — z bazy, nie hard-coded */}
            <EditableText
              fieldName="faq.headline"
              value={pageContent.faq.headline ?? ''}
              tag="h2"
              isEditMode={isTextEditMode || false}
              editLabel={editLabel}
              editedLabel={editedLabel}
              onChange={handleTextChange}
              maxLength={100}
              className={`${LAYOUT.headingSize} font-bold text-center ${LAYOUT.headingMb} leading-tight tracking-tight`}
              style={{ fontFamily: theme.headingFont, color: theme.pageText }}
            />

            {/* Lista pytań/odpowiedzi — accordion */}
            <div
              className={`rounded-2xl ${LAYOUT.cardP}`}
              style={{
                backgroundColor: theme.faqBg,
                border: `1px solid ${theme.faqBorder}`,
                boxShadow: theme.cardShadow,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              {(pageContent.faq.items ?? []).map((item, index) => (
                <FaqItem
                  key={index}
                  question={item.question ?? ''}
                  answer={item.answer ?? ''}
                  theme={theme}
                  isTextEditMode={isTextEditMode}
                  onTextUpdate={onTextUpdate}
                  questionFieldName={`faq.items.${index}.question`}
                  answerFieldName={`faq.items.${index}.answer`}
                  editLabel={editLabel}
                  editedLabel={editedLabel}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* FORM SECTION — final push to convert                              */}
      {/* ================================================================ */}
      {/* Single-column centered. Po obejrzeniu całej strony czytelnik wie  */}
      {/* już wszystko — formularz ma być prosty, mało wizualnego szumu.   */}
      <section
        id="signup"
        className={`${LAYOUT.sectionPy} transition-all duration-700 ease-out
          ${elements.signup ? 'opacity-100' : 'opacity-0 translate-y-10'}`}
      >
        {/* Banner — edytowalny headline + subheadline z bazy */}
        <div
          className="py-7 sm:py-10 mb-8 sm:mb-12"
          style={{
            background: theme.formBannerBg,
            borderTop: `1px solid ${theme.divider}`,
            borderBottom: `1px solid ${theme.divider}`,
          }}
        >
          <div className={`mx-auto ${LAYOUT.px} ${LAYOUT.maxW} text-center`}>
            <EditableText
              fieldName="form.headline"
              value={pageContent.form?.headline ?? ''}
              tag="h2"
              isEditMode={isTextEditMode || false}
              editLabel={editLabel}
              editedLabel={editedLabel}
              onChange={handleTextChange}
              maxLength={200}
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-3 sm:mb-4 leading-tight tracking-tight"
              style={{ fontFamily: theme.headingFont, color: theme.formBannerText }}
            />
            {pageContent.form?.subheadline && (
              <EditableText
                fieldName="form.subheadline"
                value={pageContent.form.subheadline}
                tag="p"
                isEditMode={isTextEditMode || false}
                editLabel={editLabel}
                editedLabel={editedLabel}
                onChange={handleTextChange}
                multiline={true}
                maxLength={250}
                className="text-base sm:text-lg lg:text-xl leading-relaxed font-light"
                style={{ color: theme.formBannerText, opacity: 0.85 }}
              />
            )}
            {isPreviewMode && (
              <span className="ml-2 opacity-75 text-base block mt-2" style={{ color: theme.formBannerText }}>
                {ui.previewMode}
              </span>
            )}
          </div>
        </div>

        {/* Form card — centered, max-w-2xl, single-column */}
        <div className={`mx-auto ${LAYOUT.px}`}>
          <div
            className={`${LAYOUT.cardP} md:p-9 rounded-2xl relative max-w-2xl mx-auto`}
            style={{
              backgroundColor: theme.cardBg,
              border: `2px solid ${theme.cardBorder}`,
              boxShadow: theme.cardHoverShadow,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            {/* FREE badge */}
            <div
              className="absolute -top-4 sm:-top-5 right-4 sm:right-10 py-1.5 sm:py-2 px-5 sm:px-6 rounded-full font-bold text-xs sm:text-sm shadow-lg transform rotate-2"
              style={{
                background: theme.badgeBg,
                color: theme.badgeText,
                boxShadow: theme.ctaShadow,
              }}
            >
              {ui.bezplatnie}
            </div>

            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-xs sm:text-sm font-medium mb-1.5" style={{ color: theme.labelText }}>
                    {ui.nameLabel}
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder={ui.namePlaceholder}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={isPreviewMode || isSubmitting}
                    className={`w-full px-4 py-3 text-sm sm:text-base border-2 rounded-lg focus:outline-none transition-all ${(isPreviewMode) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={getInputStyle('name')}
                    onFocus={() => setFocusedInput('name')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-xs sm:text-sm font-medium mb-1.5" style={{ color: theme.labelText }}>
                    {ui.emailLabel}
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder={ui.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isPreviewMode || isSubmitting}
                    className={`w-full px-4 py-3 text-sm sm:text-base border-2 rounded-lg focus:outline-none transition-all ${(isPreviewMode) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={getInputStyle('email')}
                    onFocus={() => setFocusedInput('email')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </div>

                {/* Phone — OPCJONALNE (brak required) */}
                <div>
                  <label htmlFor="phone" className="block text-xs sm:text-sm font-medium mb-1.5" style={{ color: theme.labelText }}>
                    {ui.phoneLabel}
                    <span className="ml-1.5 font-normal opacity-60">
                      ({isEN ? 'optional' : 'opcjonalnie'})
                    </span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    placeholder={ui.phonePlaceholder}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isPreviewMode || isSubmitting}
                    className={`w-full px-4 py-3 text-sm sm:text-base border-2 rounded-lg focus:outline-none transition-all ${(isPreviewMode) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={getInputStyle('phone')}
                    onFocus={() => setFocusedInput('phone')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </div>

                {/* Submit button — text z form.cta (edytowalny) */}
                <button
                  type="submit"
                  disabled={isPreviewMode || isSubmitting}
                  className={`w-full py-3.5 sm:py-4 rounded-lg font-bold text-sm sm:text-base transition-all flex items-center justify-center ${
                    (isPreviewMode || isSubmitting) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'
                  }`}
                  style={{
                    background: theme.ctaBg,
                    color: theme.ctaText,
                    boxShadow: theme.ctaShadow,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <span
                        className="inline-block w-4 h-4 border-2 border-t-transparent rounded-full animate-spin mr-2"
                        style={{ borderColor: theme.spinnerBorder, borderTopColor: 'transparent' }}
                      ></span>
                      {ui.sending}
                    </>
                  ) : isPreviewMode ? (
                    ui.previewUnavailable
                  ) : (
                    pageContent.form?.cta || ui.formSubmitBtn
                  )}
                </button>

                {/* Error display */}
                {submitError && (
                  <div
                    className="text-sm text-center mt-2 p-3 rounded-lg"
                    style={{
                      backgroundColor: theme.errorBg,
                      border: `1px solid ${theme.errorBorder}`,
                      color: theme.errorText,
                    }}
                  >
                    {submitError}
                  </div>
                )}

                {/* Preview mode notice */}
                {isPreviewMode && (
                  <div
                    className="text-xs text-center mt-2 p-3 rounded-lg"
                    style={{
                      backgroundColor: theme.warningBg,
                      border: `1px solid ${theme.warningBorder}`,
                      color: theme.warningText,
                    }}
                  >
                    {ui.previewFormNote}
                  </div>
                )}

                {/* Trust line — edytowalna z bazy (zastępuje stary privacyText) */}
                {pageContent.form?.trust_line && (
                  <EditableText
                    fieldName="form.trust_line"
                    value={pageContent.form.trust_line}
                    tag="p"
                    isEditMode={isTextEditMode || false}
                    editLabel={editLabel}
                    editedLabel={editedLabel}
                    onChange={handleTextChange}
                    maxLength={150}
                    className="text-xs sm:text-sm text-center mt-4 leading-relaxed"
                    style={{ color: theme.pageSubtext, fontFamily: theme.bodyFont }}
                  />
                )}
              </form>
            ) : (
              /* ---- Thank-you state ---- */
              <div className="text-center py-7 sm:py-10">
                <div
                  className="w-18 h-18 sm:w-22 sm:h-22 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-7"
                  style={{
                    backgroundColor: theme.thankYouIconBg,
                    border: `1px solid ${theme.thankYouIconBorder}`,
                  }}
                >
                  <CheckCircle className="w-9 h-9 sm:w-11 sm:h-11" style={{ color: theme.accent }} />
                </div>
                <h2
                  className="text-2xl sm:text-3xl font-bold mb-5 sm:mb-6"
                  style={{ color: theme.accent, fontFamily: theme.headingFont }}
                >
                  {ui.thankYou}
                </h2>

                {!downloadStarted ? (
                  <>
                    <p className="text-base sm:text-lg mb-7 sm:mb-9 max-w-md mx-auto leading-relaxed" style={{ color: theme.pageSubtext }}>
                      {ui.downloadReady}
                    </p>
                    <button
                      onClick={handleDownloadEbook}
                      disabled={isDownloading || isPreviewMode}
                      className={`inline-flex items-center justify-center px-7 py-3.5 rounded-lg font-semibold transition-all ${
                        (isDownloading || isPreviewMode) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                      }`}
                      style={{
                        background: (isDownloading || isPreviewMode) ? theme.divider : theme.ctaBg,
                        color: theme.ctaText,
                        boxShadow: (isDownloading || isPreviewMode) ? 'none' : theme.ctaShadow,
                      }}
                    >
                      {isDownloading ? (
                        <>
                          <span
                            className="inline-block w-5 h-5 mr-2 border-2 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: theme.spinnerBorder, borderTopColor: 'transparent' }}
                          ></span>
                          {ui.downloading}
                        </>
                      ) : isPreviewMode ? (
                        ui.previewUnavailable
                      ) : (
                        <>
                          <Download className="w-5 h-5 mr-2" />
                          {ui.downloadBtn}
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <p className="text-base sm:text-lg mb-5 max-w-md mx-auto leading-relaxed animate-fadeIn" style={{ color: theme.pageSubtext }}>
                    {ui.farewell}
                  </p>
                )}

                {downloadError && (
                  <div
                    className="mt-5 p-4 rounded-lg text-sm mx-auto max-w-md"
                    style={{
                      backgroundColor: theme.errorBg,
                      border: `1px solid ${theme.errorBorder}`,
                      color: theme.errorText,
                    }}
                  >
                    <p>{downloadError}</p>
                    <p className="mt-2 text-xs">{ui.downloadError}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* FOOTER                                                           */}
      {/* ================================================================ */}
      <footer
        className="py-8 sm:py-10"
        style={{
          backgroundColor: theme.footerBg,
          borderTop: `1px solid ${theme.footerBorder}`,
        }}
      >
        <div className={`mx-auto ${LAYOUT.px} text-center`}>
          <p className="text-xs sm:text-sm mb-3" style={{ color: theme.footerText }}>
            {ui.footerRights}
          </p>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-0 sm:space-x-5">
            <a
              href="#"
              className="text-xs sm:text-sm transition-colors"
              style={{ color: theme.footerText }}
              onMouseEnter={(e) => { e.currentTarget.style.color = theme.footerHoverText; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = theme.footerText; }}
            >
              {ui.footerPrivacy}
            </a>
            <a
              href="#"
              className="text-xs sm:text-sm transition-colors"
              style={{ color: theme.footerText }}
              onMouseEnter={(e) => { e.currentTarget.style.color = theme.footerHoverText; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = theme.footerText; }}
            >
              {ui.footerTerms}
            </a>
            <a
              href="#"
              className="text-xs sm:text-sm transition-colors"
              style={{ color: theme.footerText }}
              onMouseEnter={(e) => { e.currentTarget.style.color = theme.footerHoverText; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = theme.footerText; }}
            >
              {ui.footerContact}
            </a>
          </div>
        </div>
      </footer>

      {/* Fade-in animation keyframes */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default DemoView;