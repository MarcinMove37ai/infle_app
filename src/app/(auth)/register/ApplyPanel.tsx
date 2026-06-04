// src/app/(auth)/register/ApplyPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Plus, X, Check } from 'lucide-react';
import { LazyMotion, domAnimation, m as motion } from 'framer-motion';

// Siostrzany modal do welcome — ta sama mechanika i wygląd (overlay, karta #0F0F0F,
// stały header + scrollowany środek + CTA na dole, 100dvh). Tłem jest strona register.
// Treść: wniosek o dostęp (Apply) dla wejścia BEZ prawidłowego kodu (invite-only).
//
// Linki: jedno pole na start. Jawny, opcjonalny przycisk "dodaj kolejny kanał"
// (aktywny dopiero gdy bieżące pola są wypełnione — nie mnożymy pustych).
// Każde dodatkowe pole ma "×" usuwające je całkowicie. Autodetekcja kanału +
// blokada duplikatu (poza WWW, którego może być wiele).

type Channel = 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'website';

function detectChannel(url: string): Channel {
  const u = url.toLowerCase();
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('facebook.com') || u.includes('fb.com')) return 'facebook';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('linkedin.com')) return 'linkedin';
  return 'website';
}

const CHANNEL_LABEL: Record<Channel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  website: 'WWW',
};

interface ApplyPanelProps {
  lang: string;
}

export default function ApplyPanel({ lang }: ApplyPanelProps) {
  const pl = lang === 'pl';

  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [links, setLinks] = useState<string[]>(['']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // SSR-safe: stan startowy MUSI być identyczny na serwerze i kliencie (false),
  // inaczej hydration mismatch. localStorage czytamy dopiero w useEffect (po montażu).
  const [success, setSuccess] = useState(false);
  const [returning, setReturning] = useState(false);

  // Po zamontowaniu: jeśli user złożył już wniosek na tym urządzeniu,
  // przełączamy na ekran "analizujemy" (returning=true → odpowiednia treść).
  useEffect(() => {
    try {
      if (localStorage.getItem('inflee_apply_submitted') === '1') {
        setSuccess(true);
        setReturning(true);
      }
    } catch {
      // brak dostępu do localStorage — zostaje formularz
    }
  }, []);

  const filledLinks = links.filter((l) => l.trim());
  // Przycisk "dodaj" aktywny tylko gdy nie ma już pustego pola — chroni przed mnożeniem.
  const canAddLink = !links.some((l) => !l.trim());

  // Czy pole o danym indeksie duplikuje kanał obecny gdzie indziej (poza WWW)?
  const isDuplicate = (index: number): boolean => {
    const val = links[index]?.trim();
    if (!val) return false;
    const channel = detectChannel(val);
    if (channel === 'website') return false;
    return links.some((l, i) => i !== index && l.trim() && detectChannel(l.trim()) === channel);
  };

  // Minimum do wysłania: imię + poprawny email + ≥1 link + brak duplikatów kanałów.
  // To samo kryterium co handleSubmit — CTA aktywny dopiero gdy komplet.
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const hasDuplicate = links.some((_, i) => isDuplicate(i));
  const canSubmit =
    Boolean(firstName.trim()) && emailValid && filledLinks.length > 0 && !hasDuplicate;

  const handleLinkChange = (index: number, value: string) => {
    setError('');
    setLinks((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addLink = () => {
    setError('');
    if (canAddLink) setLinks((prev) => [...prev, '']);
  };

  // Usuwa pole całkowicie. Gdy zostaje ostatnie — czyści je (musi zostać 1 pole do wpisania).
  const removeLink = (index: number) => {
    setError('');
    setLinks((prev) => (prev.length === 1 ? [''] : prev.filter((_, i) => i !== index)));
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    if (!firstName.trim()) {
      setError(pl ? 'Podaj imię.' : 'Please enter your name.');
      setLoading(false);
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(pl ? 'Podaj poprawny adres email.' : 'Please enter a valid email.');
      setLoading(false);
      return;
    }
    if (filledLinks.length === 0) {
      setError(pl ? 'Podaj przynajmniej jeden link.' : 'Please add at least one link.');
      setLoading(false);
      return;
    }
    if (links.some((_, i) => isDuplicate(i))) {
      setError(pl ? 'Usuń zduplikowane kanały.' : 'Please remove duplicate channels.');
      setLoading(false);
      return;
    }

    // Mapowanie na pola backendu: pierwszy link danego kanału → jego pole.
    const payload: Record<string, string> = { firstName: firstName.trim(), email: email.trim() };
    for (const link of filledLinks) {
      const channel = detectChannel(link);
      if (!payload[channel]) payload[channel] = link;
    }

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        try {
          localStorage.setItem('inflee_apply_submitted', '1');
        } catch {
          // brak dostępu do localStorage (np. tryb prywatny) — nie blokujemy
        }
        setSuccess(true);
      } else {
        setError(pl ? 'Coś poszło nie tak. Spróbuj ponownie.' : 'Something went wrong. Please try again.');
      }
    } catch {
      setError(pl ? 'Coś poszło nie tak. Spróbuj ponownie.' : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2.5 bg-slate-900/95 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-200 text-white text-sm placeholder:text-slate-500';

  return (
    <LazyMotion features={domAnimation}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.97, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          className="relative w-full max-w-lg bg-[#0F0F0F] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[88dvh] overflow-hidden"
        >
          {success ? (
            <div className="px-6 py-10 sm:px-8 text-center">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h2 className="mt-5 text-xl sm:text-2xl font-bold text-white">
                {returning
                  ? (pl ? 'Wniosek w analizie' : 'Application under review')
                  : (pl ? 'Dziękujemy!' : 'Thank you!')}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {returning
                  ? (pl
                      ? 'Przyglądamy się Twoim profilom i odbiorcom, żeby sprawdzić dopasowanie. Odezwiemy się w ciągu kilku dni — a jeśli pasuje, dostaniesz dostęp z gotowymi pomysłami na start.'
                      : 'We’re looking at your profiles and audience to check the fit. We’ll be in touch within a few days — and if it’s a match, you’ll get access with starting ideas ready to go.')
                  : (pl
                      ? 'Dzięki! Przyjrzymy się Twoim profilom i odbiorcom, ocenimy dopasowanie i odezwiemy się w ciągu kilku dni — z dostępem i wstępnymi pomysłami, jeśli to dobre miejsce dla Ciebie.'
                      : 'Thanks! We’ll look at your profiles and audience, check the fit, and get back to you within a few days — with access and starting ideas if this is the right place for you.')}
              </p>
            </div>
          ) : (
            <>
              {/* Header — stały */}
              <div className="flex-shrink-0 px-5 pt-5 sm:px-7 sm:pt-7">
                <div className="mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-400">
                    {pl ? 'Dostęp na zaproszenie' : 'Invite-only access'}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">
                  {pl ? 'Sprawdźmy, czy to coś dla Ciebie' : 'Let’s see if this is right for you'}
                </h2>
              </div>

              {/* Treść — scrollowana, scrollbar ukryty */}
              <div className="no-scrollbar flex-1 overflow-y-auto px-5 sm:px-7 mt-3">
                <p className="text-sm leading-relaxed text-slate-300">
                  {pl
                    ? 'Zależy nam, żeby inflee.app realnie pomogło Twojemu biznesowi — dlatego dajemy dostęp dopiero, gdy wiemy, że tak będzie. Zostaw kontakt i miejsca, w których działasz online; spojrzymy na Ciebie i Twoich odbiorców, ocenimy dopasowanie i — jeśli pasuje — przygotujemy wstępne pomysły, żebyś od pierwszego dnia miał z czego korzystać.'
                    : 'We want inflee.app to genuinely help your business — so we open access once we know it will. Leave your contact and where you’re active online; we’ll look at you and your audience, check the fit, and — if it’s a match — prepare some starting ideas so you get real value from day one.'}
                </p>

                <div className="mt-5 space-y-3">
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => { setError(''); setFirstName(e.target.value); }}
                    placeholder={pl ? 'Imię *' : 'First name *'}
                    className={inputClass}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setError(''); setEmail(e.target.value); }}
                    placeholder={pl ? 'Adres email *' : 'Email address *'}
                    className={inputClass}
                  />

                  {/* Linki */}
                  <div className="space-y-2.5">
                    {links.map((link, i) => {
                      const val = link.trim();
                      const channel = val ? detectChannel(val) : null;
                      const dup = isDuplicate(i);
                      return (
                        <div key={i}>
                          <div className="relative">
                            <input
                              type="url"
                              value={link}
                              onChange={(e) => handleLinkChange(i, e.target.value)}
                              placeholder={
                                i === 0
                                  ? pl ? 'WWW, Instagram, LinkedIn… *' : 'Website, Instagram, LinkedIn… *'
                                  : pl ? 'Kolejne miejsce' : 'Another place'
                              }
                              className={`${inputClass} ${links.length > 1 ? 'pr-10' : ''}`}
                            />
                            {links.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLink(i)}
                                aria-label={pl ? 'Usuń' : 'Remove'}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 cursor-pointer hover:text-white transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {dup ? (
                            <p className="mt-1 ml-1 text-xs text-amber-300">
                              {pl
                                ? `Kanał ${CHANNEL_LABEL[channel as Channel]} już dodałeś.`
                                : `${CHANNEL_LABEL[channel as Channel]} link already added.`}
                            </p>
                          ) : channel && channel !== 'website' ? (
                            <p className="mt-1 ml-1 text-xs text-slate-500">
                              {pl ? 'Wykryto: ' : 'Detected: '}
                              <span className="text-slate-400">{CHANNEL_LABEL[channel]}</span>
                            </p>
                          ) : null}
                        </div>
                      );
                    })}

                    {/* Opcjonalny CTA: dodaj kolejny kanał */}
                    <button
                      type="button"
                      onClick={addLink}
                      disabled={!canAddLink}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-white/15 text-sm text-slate-300 cursor-pointer hover:border-indigo-400/50 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-white/15 disabled:hover:text-slate-300"
                    >
                      <Plus className="w-4 h-4" />
                      {pl ? 'Dodaj kolejne miejsce' : 'Add another place'}
                    </button>

                    <p className="text-xs leading-snug text-slate-400">
                      {pl
                        ? 'Strona, Instagram, LinkedIn, YouTube, Facebook — podaj, co masz. Im więcej miejsc pokażesz, tym lepiej zrozumiemy Twój biznes i odbiorców i trafniej dopasujemy pomysły.'
                        : 'Website, Instagram, LinkedIn, YouTube, Facebook — share whatever you have. The more you show, the better we’ll understand your business and audience and tailor the ideas to you.'}
                    </p>
                  </div>

                  {error && (
                    <div className="bg-red-500/10 ring-1 ring-red-500/20 rounded-xl p-3">
                      <p className="text-red-400 text-xs font-medium">{error}</p>
                    </div>
                  )}
                </div>
                <div className="h-2" />
              </div>

              {/* CTA — przyklejony do dołu */}
              <div className="flex-shrink-0 px-5 pb-4 pt-3 sm:px-7 sm:pb-5">
                <button
                  onClick={handleSubmit}
                  disabled={loading || !canSubmit}
                  className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl cursor-pointer hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? pl ? 'Wysyłanie...' : 'Sending...'
                    : pl ? 'Wyślij wniosek' : 'Submit application'}
                </button>
                <p className="mt-3 text-center text-xs text-slate-400">
                  {pl ? 'Masz już konto? ' : 'Already have an account? '}
                  <a
                    href={`/login?lang=${lang}`}
                    className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                  >
                    {pl ? 'Zaloguj się' : 'Log in'}
                  </a>
                </p>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </LazyMotion>
  );
}