// src/components/ui/LimitBadge.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { getPlan, getPlanLadder, type Aspect } from '@/lib/planLimits';

interface LimitBadgeProps {
  aspect: Aspect;
  current: number;
  max: number;
  role?: string | null;
}

const ASPECT_LABEL: Record<Aspect, string> = {
  sources: 'Sources',
  chapters: 'Chapters',
  intro: 'Intro',
  variants: 'Options',
};

/** Nagłówek dymka. Wstęp dotyczy calego ebooka, nie pojedynczego elementu. */
const ASPECT_HEADING: Record<Aspect, string> = {
  sources: 'Sources per ebook',
  chapters: 'Chapters per ebook',
  intro: 'Ebook intro',
  variants: 'Image options per graphic',
};

/** Pigułka z licznikiem limitu. Klik otwiera dymek: plan usera + plany wyższe. */
export default function LimitBadge({ aspect, current, max, role }: LimitBadgeProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const atLimit = current >= max;
  const plan = getPlan(role);
  const ladder = getPlanLadder(role, aspect);

  // Zamykanie: klik poza dymkiem albo Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`text-xs font-medium px-2 py-1 rounded-full cursor-pointer transition-colors ${
          atLimit
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {aspect === 'intro'
          ? `${ASPECT_LABEL[aspect]}: ${atLimit ? 'Available' : 'Unavailable'} (${plan.name})`
          : `${ASPECT_LABEL[aspect]}: ${current} / ${max} (${plan.name})`}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-2 z-30 w-64 bg-white rounded-xl border border-gray-200 shadow-lg p-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute top-2 right-2 w-6 h-6 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer flex items-center justify-center transition-colors"
          >
            <X size={14} />
          </button>

          <div className="px-2 pt-0.5 pb-2 mb-2 border-b border-gray-200 pr-8">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Plan limits
            </p>
            <p className="text-[13px] font-medium text-gray-800 mt-0.5">
              {ASPECT_HEADING[aspect]}
            </p>
          </div>
          <ul className="space-y-0.5">
            {ladder.map((p) => (
              <li
                key={p.id}
                className={`flex items-center justify-between gap-3 text-[12px] rounded-lg px-2 py-1.5 ${
                  p.isCurrent ? 'bg-indigo-50' : ''
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className={p.isCurrent ? 'text-indigo-700 font-medium' : 'text-gray-600'}>
                    {p.name}
                  </span>
                  {p.isCurrent && (
                    <span className="text-[10px] font-medium bg-indigo-600 text-white px-1.5 py-px rounded-full">
                      You
                    </span>
                  )}
                </span>
                <span className={p.isCurrent ? 'text-indigo-700 font-semibold' : 'text-gray-500'}>
                  {p.limit}
                </span>
              </li>
            ))}
          </ul>
          {ladder.length === 1 && (
            <p className="text-[11px] text-gray-400 mt-1.5 px-2 pb-0.5">
              You&apos;re on the highest plan.
            </p>
          )}
        </div>
      )}
    </div>
  );
}