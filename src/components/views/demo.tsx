// src/components/views/demo.tsx
"use client"

import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, CheckCircle, Shield, Clock, Heart,
  Target, ChevronDown, ChevronRight, ArrowRight, Download, Check
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
// Editable field definitions (from database)
// ---------------------------------------------------------------------------
const EDITABLE_FIELDS = [
  'pagecontent_hero_headline',
  'pagecontent_hero_subheadline',
  'pagecontent_hero_description',
  'pagecontent_benefits_items_0_title',
  'pagecontent_benefits_items_0_text',
  'pagecontent_benefits_items_1_title',
  'pagecontent_benefits_items_1_text',
  'pagecontent_benefits_items_2_title',
  'pagecontent_benefits_items_2_text',
  'pagecontent_benefits_items_3_title',
  'pagecontent_benefits_items_3_text',
  'pagecontent_content_chapters_0_title',
  'pagecontent_content_chapters_0_description',
  'pagecontent_content_chapters_1_title',
  'pagecontent_content_chapters_1_description',
  'pagecontent_content_chapters_2_title',
  'pagecontent_content_chapters_2_description',
  'pagecontent_form_title',
  'pagecontent_faq_items_0_question',
  'pagecontent_faq_items_0_answer',
  'pagecontent_faq_items_1_question',
  'pagecontent_faq_items_1_answer',
  'pagecontent_faq_items_2_question',
  'pagecontent_faq_items_2_answer'
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
  editLabel = 'Edit'
}: {
  question: string;
  answer: string;
  theme: ThemeTokens;
  isTextEditMode?: boolean;
  onTextUpdate?: (fieldName: string, newValue: string) => void;
  questionFieldName: string;
  answerFieldName: string;
  editLabel?: string;
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
        className="flex w-full items-center justify-between py-4 sm:py-5 text-left transition-colors"
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

interface PageContent {
  s3_file_key?: string;
  hero: {
    headline: string;
    subheadline: string;
    description: string;  // format: "Lead sentence.||Bez X||Bez Y||Bez Z"
    buttonText: string;
    stats: PageContentStat[];
  };
  benefits: {
    title: string;
    items: PageContentBenefitItem[];
  };
  content: {
    title: string;
    chapters: PageContentChapter[];
  };
  form: {
    title: string;
    subtitle: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    phonePlaceholder: string;
    buttonText: string;
    privacyText: string;
  };
  guarantees: {
    items: PageContentGuaranteeItem[];
  };
  faq: {
    title: string;
    items: PageContentFaqItem[];
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
  visitors = 0,
  pageId,
  pageData,
  isPreviewMode = false,
  isTextEditMode = false,
  onTextUpdate
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);

  // Focus states for inputs
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Helper: parse hero description "Lead.||Bez X||Bez Y||Bez Z"
  const parseHeroDescription = (desc: string) => {
    const parts = desc.split('||');
    return {
      lead: parts[0]?.trim() ?? desc,
      bullets: parts.slice(1).map(b => b.trim()).filter(Boolean),
    };
  };

  // i18n
  const isEN = language === 'en';
  const editLabel = isEN ? 'Edit' : 'Edytuj';
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
      'hero', 'painpoints', 'benefits', 'content',
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

  // Parse hero description into lead text + bullet points
  const { lead: heroLead, bullets: heroBullets } = parseHeroDescription(pageContent.hero.description);

  // Editable state for description parts (lead + bullets → reconstructed as single field)
  const [editableLead, setEditableLead] = useState(heroLead);
  const [editableBullets, setEditableBullets] = useState(heroBullets);

  // Sync when pageContent.hero.description changes externally
  useEffect(() => {
    const { lead, bullets } = parseHeroDescription(pageContent.hero.description);
    setEditableLead(lead);
    setEditableBullets(bullets);
  }, [pageContent.hero.description]);

  // Handler for description sub-parts — reconstructs full string and saves as real field
  const handleDescriptionPartChange = (field: string, value: string) => {
    let newLead = editableLead;
    let newBullets = [...editableBullets];

    if (field === 'description_lead') {
      newLead = value;
      setEditableLead(value);
    } else {
      const match = field.match(/^description_bullet_(\d+)$/);
      if (match) {
        const index = parseInt(match[1]);
        newBullets[index] = value;
        setEditableBullets(newBullets);
      }
    }

    // Reconstruct "Lead.||Bullet 1||Bullet 2||..." and propagate as real DB field
    const parts = [newLead, ...newBullets].filter(Boolean);
    const fullDescription = parts.join('||');
    handleTextChange('pagecontent_hero_description', fullDescription);
  };

  // Track which description parts have been individually edited
  const [changedDescParts, setChangedDescParts] = useState<Set<string>>(new Set());

  // Wrap handleDescriptionPartChange to also track per-part changes
  const handleDescriptionPartChangeTracked = (field: string, value: string) => {
    setChangedDescParts(prev => new Set(prev).add(field));
    handleDescriptionPartChange(field, value);
  };

  // Clear per-part tracking after save (when context pendingChanges is empty)
  const descriptionFieldChanged = useContextMode
    ? editModeContext.isFieldChanged('pagecontent_hero_description')
    : false;

  useEffect(() => {
    if (!descriptionFieldChanged) {
      setChangedDescParts(new Set());
    }
  }, [descriptionFieldChanged]);

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
      {/* HEADER                                                           */}
      {/* ================================================================ */}
      <header
        className="fixed top-0 left-0 w-full h-20 z-50 flex items-center justify-between px-4 sm:px-6 lg:px-8"
        style={{
          backgroundColor: theme.headerBg,
          borderBottom: `1px solid ${theme.headerBorder}`,
          boxShadow: theme.headerShadow,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-center">
          <div className="h-8 md:h-12 w-auto">
            <Image
              src={logoUrl}
              alt="Logo aplikacji"
              width={120}
              height={48}
              className="h-full w-auto"
              priority
              unoptimized
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end justify-center">
            <span className="text-sm font-medium" style={{ color: theme.pageText }}>
              {partnerName}
            </span>
            <div className="w-full h-px my-0.5" style={{ backgroundColor: theme.divider }}></div>
            <span className="text-xs" style={{ color: theme.pageSubtext }}>
              made with inflee.app
            </span>
          </div>
        </div>
      </header>

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
              {/* h1 — headline */}
              <EditableText
                fieldName="pagecontent_hero_headline"
                value={pageContent.hero.headline}
                tag="h1"
                isEditMode={isTextEditMode || false}
                editLabel={editLabel}
                onChange={handleTextChange}
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-5 sm:mb-6 leading-tight text-left break-words"
                style={{
                  color: theme.pageText,
                  fontFamily: theme.headingFont,
                }}
              />

              {/* Decorative divider between h1 and h2 */}
              <div
                className="w-32 sm:w-48 h-px mb-5 sm:mb-6 rounded-full ml-0 mr-auto"
                style={{ background: theme.dividerAccent, opacity: 0.6 }}
              ></div>

              {/* h2 — subheadline */}
              <EditableText
                fieldName="pagecontent_hero_subheadline"
                value={pageContent.hero.subheadline}
                tag="h2"
                isEditMode={isTextEditMode || false}
                editLabel={editLabel}
                onChange={handleTextChange}
                className="text-lg sm:text-xl lg:text-2xl font-medium mb-4 sm:mb-5 text-left break-words"
                style={{
                  color: theme.pageSubtext,
                  fontFamily: theme.headingFont,
                }}
              />

              {/* Mobile mockup — shown only on small screens */}
              <div className="block lg:hidden w-full mb-6 sm:mb-8">
                <div className="mx-auto max-w-xs">
                  <Image
                    src={pageContent.s3_file_key || "/mockup.png"}
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

              {/* CTA button — extra breathing room on desktop */}
              <div className="text-center lg:text-left mt-2 lg:mt-10">
                <AnimatedButton href="#signup" theme={theme}>
                  {ui.heroCta}
                </AnimatedButton>
              </div>
            </div>

            {/* Right column — desktop e-book mockup (larger) */}
            <div className="lg:w-1/2 hidden lg:flex flex-col items-center pl-0 lg:pl-8 xl:pl-12">
              <div className="w-72 md:w-96 lg:w-[28rem] xl:w-[34rem]">
                <Image
                  src={pageContent.s3_file_key || "/mockup.png"}
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
      {/* PAIN POINTS — the problem this ebook solves                       */}
      {/* ================================================================ */}
      {(editableLead || editableBullets.length > 0) && (
        <section
          id="painpoints"
          className={`${LAYOUT.sectionPy} transition-all duration-700 ease-out
            ${elements.painpoints ? 'opacity-100' : 'opacity-0 translate-y-10'}`}
          style={{ backgroundColor: theme.sectionAltBg }}
        >
          <div className={`mx-auto ${LAYOUT.px} ${LAYOUT.maxW}`}>
            {/* Lead paragraph — editable core problem statement */}
            {editableLead && (
              <EditableText
                fieldName="description_lead"
                value={editableLead}
                tag="p"
                isEditMode={isTextEditMode || false}
                editLabel={editLabel}
                onChange={handleDescriptionPartChangeTracked}
                overrideContext={true}
                forceUnsaved={changedDescParts.has('description_lead')}
                className="text-lg sm:text-xl lg:text-2xl mb-10 sm:mb-14 text-center max-w-3xl mx-auto leading-relaxed font-light"
                style={{ color: theme.pageText }}
                multiline={true}
                maxLength={500}
              />
            )}

            {/* Decorative divider */}
            {editableLead && editableBullets.length > 0 && (
              <div className="flex justify-center mb-10 sm:mb-14">
                <div className="w-32 sm:w-48 h-px rounded-full" style={{ background: theme.dividerAccent, opacity: 0.4 }}></div>
              </div>
            )}

            {/* Bullet cards — editable, 3 columns on desktop */}
            {editableBullets.length > 0 && (
              <div className={`grid grid-cols-1 sm:grid-cols-3 ${LAYOUT.gap}`}>
                {editableBullets.map((bullet, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-4 sm:gap-5 ${LAYOUT.cardP} rounded-2xl transition-all duration-300`}
                  style={glassCard}
                >
                  <div
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      backgroundColor: theme.iconCircleBg,
                      border: `1px solid ${theme.iconCircleBorder}`,
                    }}
                  >
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: theme.iconColor }} />
                  </div>
                  <EditableText
                    fieldName={`description_bullet_${i}`}
                    value={bullet}
                    tag="span"
                    isEditMode={isTextEditMode || false}
                editLabel={editLabel}
                    onChange={handleDescriptionPartChangeTracked}
                    overrideContext={true}
                    forceUnsaved={changedDescParts.has(`description_bullet_${i}`)}
                    className="text-sm sm:text-base lg:text-lg leading-relaxed"
                    style={{ color: theme.pageText }}
                    multiline={true}
                    maxLength={300}
                  />
                </div>
              ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* BENEFITS SECTION                                                 */}
      {/* ================================================================ */}
      <section
        id="benefits"
        className={`${LAYOUT.sectionPy} transition-all duration-700 ease-out
          ${elements.benefits ? 'opacity-100' : 'opacity-0 translate-y-10'}`}
      >
        <div className={`mx-auto ${LAYOUT.px} ${LAYOUT.maxW}`}>
          <div className={`text-center max-w-3xl mx-auto ${LAYOUT.headingMb}`}>
            <h2
              className={`${LAYOUT.headingSize} font-bold mb-4`}
              style={{ fontFamily: theme.headingFont, color: theme.pageText }}
            >
              {ui.benefitsSectionTitle}
            </h2>
          </div>

          <div className={`flex flex-col ${LAYOUT.gap}`}>
            {pageContent.benefits.items.map((item, index) => (
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
                {/* Icon — fixed left column */}
                <div
                  className="w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    backgroundColor: theme.iconCircleBg,
                    border: `1px solid ${theme.iconCircleBorder}`,
                  }}
                >
                  {item.icon ? <item.icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: theme.iconColor }} /> :
                  index === 0 ? <Heart className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: theme.iconColor }} /> :
                  index === 1 ? <Target className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: theme.iconColor }} /> :
                  index === 2 ? <Clock className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: theme.iconColor }} /> :
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: theme.iconColor }} />}
                </div>

                {/* Text — fills remaining space */}
                <div className="flex-1 min-w-0">
                  {EDITABLE_FIELDS.includes(`pagecontent_benefits_items_${index}_title`) ? (
                    <EditableText
                      fieldName={`pagecontent_benefits_items_${index}_title`}
                      value={item.title}
                      tag="h3"
                      isEditMode={isTextEditMode || false}
                editLabel={editLabel}
                      onChange={handleTextChange}
                      className="text-lg sm:text-xl font-bold mb-1.5 sm:mb-2 transition-colors"
                      style={{
                        fontFamily: theme.headingFont,
                        color: theme.pageText,
                      }}
                    />
                  ) : (
                    <h3
                      className="text-lg sm:text-xl font-bold mb-1.5 sm:mb-2 transition-colors"
                      style={{
                        fontFamily: theme.headingFont,
                        color: theme.pageText,
                      }}
                    >
                      {item.title}
                    </h3>
                  )}

                  {EDITABLE_FIELDS.includes(`pagecontent_benefits_items_${index}_text`) ? (
                    <EditableText
                      fieldName={`pagecontent_benefits_items_${index}_text`}
                      value={item.text}
                      tag="p"
                      isEditMode={isTextEditMode || false}
                editLabel={editLabel}
                      onChange={handleTextChange}
                      className="text-sm sm:text-base leading-relaxed"
                      style={{ color: theme.pageSubtext }}
                      multiline={true}
                    />
                  ) : (
                    <p className="text-sm sm:text-base leading-relaxed" style={{ color: theme.pageSubtext }}>
                      {item.text}
                    </p>
                  )}
                  {/* Accent bar */}
                  <div
                    className="w-10 h-1 mt-3 sm:mt-4 rounded-full"
                    style={{ background: theme.dividerAccent }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

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

      {/* ================================================================ */}
      {/* CONTENT PREVIEW SECTION                                          */}
      {/* ================================================================ */}
      <section
        id="content"
        className={`${LAYOUT.sectionPy} transition-all duration-700 ease-out
          ${elements.content ? 'opacity-100' : 'opacity-0 translate-y-10'}`}
        style={{ backgroundColor: theme.sectionAltBg }}
      >
        <div className={`mx-auto ${LAYOUT.px} ${LAYOUT.maxW}`}>
          {/* Section header */}
          <div className={`text-center max-w-3xl mx-auto ${LAYOUT.headingMb}`}>
            <h2
              className={`${LAYOUT.headingSize} font-bold`}
              style={{ fontFamily: theme.headingFont, color: theme.pageText }}
            >
              {ui.contentSectionTitle}
            </h2>
          </div>

          {/* Chapter cards */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${LAYOUT.gap}`}>
            {pageContent.content.chapters.map((chapter, index) => (
              <div
                key={index}
                className={`group ${LAYOUT.cardP} rounded-2xl transition-all duration-300 relative overflow-hidden`}
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
                {/* Chapter number */}
                <div
                  className="font-bold text-4xl sm:text-5xl mb-5 sm:mb-7"
                  style={{
                    color: theme.chapterNumberColor,
                    fontFamily: theme.headingFont,
                    opacity: 0.7,
                  }}
                >
                  {chapter.number}
                </div>

                {EDITABLE_FIELDS.includes(`pagecontent_content_chapters_${index}_title`) ? (
                  <EditableText
                    fieldName={`pagecontent_content_chapters_${index}_title`}
                    value={chapter.title}
                    tag="h3"
                    isEditMode={isTextEditMode || false}
                editLabel={editLabel}
                    onChange={handleTextChange}
                    className="text-lg sm:text-xl font-bold mb-2.5 sm:mb-3 transition-colors"
                    style={{
                      color: theme.pageText,
                      fontFamily: theme.headingFont,
                    }}
                  />
                ) : (
                  <h3
                    className="text-lg sm:text-xl font-bold mb-2.5 sm:mb-3 transition-colors"
                    style={{
                      color: theme.pageText,
                      fontFamily: theme.headingFont,
                    }}
                  >
                    {chapter.title}
                  </h3>
                )}

                {EDITABLE_FIELDS.includes(`pagecontent_content_chapters_${index}_description`) ? (
                  <EditableText
                    fieldName={`pagecontent_content_chapters_${index}_description`}
                    value={chapter.description}
                    tag="p"
                    isEditMode={isTextEditMode || false}
                editLabel={editLabel}
                    onChange={handleTextChange}
                    className="text-sm sm:text-base mb-4 sm:mb-5 leading-relaxed"
                    style={{ color: theme.pageSubtext }}
                    multiline={true}
                  />
                ) : (
                  <p className="text-sm sm:text-base mb-4 sm:mb-5 leading-relaxed" style={{ color: theme.pageSubtext }}>
                    {chapter.description}
                  </p>
                )}
                <div className="w-9 sm:w-11 h-1 rounded-full" style={{ background: theme.dividerAccent }}></div>
              </div>
            ))}
          </div>

          {/* TOC — full chapter list, prominent design */}
          {ebookMeta && ebookMeta.chapters.length > 0 && (
            <div className="mt-10 sm:mt-14">
              <button
                onClick={() => setTocOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-6 sm:px-8 py-4 sm:py-5 rounded-2xl text-left transition-all"
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

              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${tocOpen ? 'max-h-[800px]' : 'max-h-0'}`}>
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

      {/* ================================================================ */}
      {/* FORM SECTION                                                     */}
      {/* ================================================================ */}
      <section
        id="signup"
        className={`${LAYOUT.sectionPy} transition-all duration-700 ease-out
          ${elements.signup ? 'opacity-100' : 'opacity-0 translate-y-10'}`}
      >
        {/* Banner with form title */}
        <div
          className="py-5 sm:py-7 mb-8 sm:mb-12"
          style={{
            background: theme.formBannerBg,
            borderTop: `1px solid ${theme.divider}`,
            borderBottom: `1px solid ${theme.divider}`,
          }}
        >
          <div className={`mx-auto ${LAYOUT.px} text-center`}>
            {EDITABLE_FIELDS.includes("pagecontent_form_title") ? (
              <EditableText
                fieldName="pagecontent_form_title"
                value={pageContent.form.title}
                tag="h2"
                isEditMode={isTextEditMode || false}
                editLabel={editLabel}
                onChange={handleTextChange}
                className="text-xl sm:text-2xl md:text-3xl font-bold"
                style={{ fontFamily: theme.headingFont, color: theme.formBannerText }}
              />
            ) : (
              <h2
                className="text-xl sm:text-2xl md:text-3xl font-bold"
                style={{ fontFamily: theme.headingFont, color: theme.formBannerText }}
              >
                {pageContent.form.title}
              </h2>
            )}
            {isPreviewMode && <span className="ml-2 opacity-75 text-base" style={{ color: theme.formBannerText }}>{ui.previewMode}</span>}
          </div>
        </div>

        <div className={`mx-auto ${LAYOUT.px} ${LAYOUT.maxW}`}>
          <div
            className={`${LAYOUT.cardP} md:p-9 rounded-2xl relative`}
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
              <div className={`grid grid-cols-1 md:grid-cols-5 ${LAYOUT.gap} md:gap-9`}>
                {/* Left side — info */}
                <div className="md:col-span-2">
                  <div className="h-full flex flex-col justify-center">
                    <div className="flex items-center mb-4 sm:mb-5">
                      <div
                        className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center mr-3"
                        style={{
                          backgroundColor: theme.iconCircleBg,
                          border: `1px solid ${theme.iconCircleBorder}`,
                        }}
                      >
                        <BookOpen className="w-4 h-4 sm:w-6 sm:h-6" style={{ color: theme.iconColor }} />
                      </div>
                      <h3
                        className="text-lg sm:text-xl font-bold"
                        style={{ fontFamily: theme.headingFont, color: theme.pageText }}
                      >
                        {ui.formLeftTitle}
                      </h3>
                    </div>
                    <p className="text-sm sm:text-base mb-5 sm:mb-7 leading-relaxed" style={{ color: theme.pageSubtext }}>
                      {ui.formLeftText}
                    </p>

                    {/* Trust badges — hidden on mobile, shown from MD up */}
                    <div className="mt-auto hidden md:block">
                      <p className="text-xs mb-3 font-semibold uppercase tracking-wider" style={{ color: theme.pageSubtext }}>
                        {ui.guaranteeLabel}
                      </p>
                      <div className="space-y-2.5">
                        <div
                          className="flex items-center text-xs px-3 py-2 rounded-full"
                          style={{
                            backgroundColor: theme.trustBg,
                            border: `1px solid ${theme.trustBorder}`,
                            color: theme.trustText,
                          }}
                        >
                          <Shield className="w-3.5 h-3.5 mr-2" style={{ color: theme.iconColor }} />
                          {ui.guaranteeSafe}
                        </div>
                        <div
                          className="flex items-center text-xs px-3 py-2 rounded-full"
                          style={{
                            backgroundColor: theme.trustBg,
                            border: `1px solid ${theme.trustBorder}`,
                            color: theme.trustText,
                          }}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-2" style={{ color: theme.iconColor }} />
                          {ui.guaranteeNoSpam}
                        </div>
                        <div
                          className="flex items-center text-xs px-3 py-2 rounded-full"
                          style={{
                            backgroundColor: theme.trustBg,
                            border: `1px solid ${theme.trustBorder}`,
                            color: theme.trustText,
                          }}
                        >
                          <BookOpen className="w-3.5 h-3.5 mr-2" style={{ color: theme.iconColor }} />
                          {ui.guaranteePdf}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right side — form */}
                <div className="md:col-span-3">
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

                    {/* Phone */}
                    <div>
                      <label htmlFor="phone" className="block text-xs sm:text-sm font-medium mb-1.5" style={{ color: theme.labelText }}>
                        {ui.phoneLabel}
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

                    {/* Submit button */}
                    <button
                      type="submit"
                      disabled={isPreviewMode || isSubmitting}
                      className={`w-full font-bold py-3.5 sm:py-4 px-5 sm:px-6 text-sm sm:text-base rounded-lg transition-all transform hover:scale-[1.02] ${(isPreviewMode || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                        ui.formSubmitBtn
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

                    <p className="text-xs text-center mt-4" style={{ color: theme.pageSubtext }}>
                      {ui.privacyText}
                    </p>
                  </form>

                  {/* Trust badges — mobile only */}
                  <div className="mt-7 block md:hidden">
                    <p className="text-xs mb-2.5 font-semibold uppercase tracking-wider" style={{ color: theme.pageSubtext }}>
                      {ui.guaranteeLabel}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <div
                        className="flex items-center text-xs px-2.5 py-1.5 rounded-full"
                        style={{
                          backgroundColor: theme.trustBg,
                          border: `1px solid ${theme.trustBorder}`,
                          color: theme.trustText,
                        }}
                      >
                        <Shield className="w-3 h-3 mr-1.5" style={{ color: theme.iconColor }} />
                        {ui.guaranteeSafe}
                      </div>
                      <div
                        className="flex items-center text-xs px-2.5 py-1.5 rounded-full"
                        style={{
                          backgroundColor: theme.trustBg,
                          border: `1px solid ${theme.trustBorder}`,
                          color: theme.trustText,
                        }}
                      >
                        <CheckCircle className="w-3 h-3 mr-1.5" style={{ color: theme.iconColor }} />
                        {ui.guaranteeNoSpam}
                      </div>
                      <div
                        className="flex items-center text-xs px-2.5 py-1.5 rounded-full"
                        style={{
                          backgroundColor: theme.trustBg,
                          border: `1px solid ${theme.trustBorder}`,
                          color: theme.trustText,
                        }}
                      >
                        <BookOpen className="w-3 h-3 mr-1.5" style={{ color: theme.iconColor }} />
                        {ui.guaranteePdf}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
      {/* FAQ SECTION                                                      */}
      {/* ================================================================ */}
      <section
        id="faq"
        className={`${LAYOUT.sectionPy} transition-all duration-700 ease-out
          ${elements.faq ? 'opacity-100' : 'opacity-0 translate-y-10'}`}
        style={{ backgroundColor: theme.sectionAltBg }}
      >
        <div className={`mx-auto ${LAYOUT.px} ${LAYOUT.maxW}`}>
          <h2
            className={`${LAYOUT.headingSize} font-bold text-center ${LAYOUT.headingMb}`}
            style={{ fontFamily: theme.headingFont, color: theme.pageText }}
          >
            {ui.faqTitle}
          </h2>

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
            {pageContent.faq.items.map((item, index) => (
              <FaqItem
                key={index}
                question={item.question}
                answer={item.answer}
                theme={theme}
                isTextEditMode={isTextEditMode}
                onTextUpdate={onTextUpdate}
                questionFieldName={`pagecontent_faq_items_${index}_question`}
                answerFieldName={`pagecontent_faq_items_${index}_answer`}
                editLabel={editLabel}
              />
            ))}
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