// src/app/(legal)/terms/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { m as motion } from 'framer-motion';

// Warianty animacji skopiowane 1:1 ze strony rejestracji
const heroContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const heroItemVariants = {
  hidden: { opacity: 0, y: 5 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.43, 0.13, 0.23, 0.96] as const,
    },
  },
};

// Komponent z przykładową treścią
function MockTermsContent({ lang }: { lang: string | null }) {
  return (
    <div className="text-slate-300 space-y-4 text-sm leading-relaxed">
      <h2 className="text-xl font-bold text-white mb-3">
        {lang === 'en' ? '1. General Provisions' : '1. Postanowienia ogólne'}
      </h2>
      <p>
        {lang === 'en'
          ? 'This is a mock terms of service document for inflee.app. This content is a placeholder and should be replaced with your actual terms.'
          : 'To jest przykładowy dokument regulaminu serwisu inflee.app. Ta treść jest zastępcza i powinna zostać zastąpiona rzeczywistym regulaminem.'}
      </p>
      <p>
        {lang === 'en'
          ? 'The provider of services within the inflee.app application is [Your Company Name], based in [Your City].'
          : 'Dostawcą usług w ramach aplikacji inflee.app jest [Nazwa Twojej Firmy] z siedzibą w [Twoje Miasto].'}
      </p>

      <h2 className="text-xl font-bold text-white mt-6 mb-3">
        {lang === 'en' ? '2. User Accounts' : '2. Konta użytkowników'}
      </h2>
      <p>
        {lang === 'en'
          ? 'To use the full functionality of the service, registration is required. The user is obliged to provide true data.'
          : 'Aby korzystać z pełnej funkcjonalności serwisu, wymagana jest rejestracja. Użytkownik zobowiązany jest do podania prawdziwych danych.'}
      </p>
      <ul className="list-disc list-inside space-y-2 pl-2">
        <li>
          {lang === 'en'
            ? 'The user is responsible for the security of their password.'
            : 'Użytkownik ponosi odpowiedzialność za bezpieczeństwo swojego hasła.'}
        </li>
        <li>
          {lang === 'en'
            ? 'Accounts are non-transferable.'
            : 'Konta są niezbywalne.'}
        </li>
      </ul>

      <h2 className="text-xl font-bold text-white mt-6 mb-3">
        {lang === 'en' ? '3. Final Provisions' : '3. Postanowienia końcowe'}
      </h2>
      <p>
        {lang === 'en'
          ? 'The administrator reserves the right to change these terms. Users will be informed of any changes.'
          : 'Administrator zastrzega sobie prawo do zmiany niniejszego regulaminu. O wszelkich zmianach użytkownicy zostaną poinformowani.'}
      </p>
    </div>
  );
}

export default function TermsPage() {
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || null;

  return (
    <>
      {/* Lewa kolumna (Hero Text) - skopiowana 1:1 */}
      <div className="lg:col-span-7 flex flex-col justify-center items-start text-left pr-0 lg:pr-10 pt-12 pb-6 lg:py-0">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={heroContainerVariants}
          className="w-full lg:px-0"
        >
          <motion.div variants={heroItemVariants}>
            <h1 className="font-extrabold text-white leading-tight font-sans">
              <span className="block text-3xl sm:text-4xl md:text-5xl lg:text-7xl xl:text-8xl whitespace-nowrap">
                {lang === 'en' ? 'Terms of Service' : 'Regulamin'}
              </span>
            </h1>
          </motion.div>

          <motion.div variants={heroItemVariants}>
            <div className="w-40 sm:w-48 lg:w-full lg:max-w-md h-px bg-gradient-to-r from-purple-500 to-pink-500 mt-2.5 mb-1.5 lg:mt-6 lg:mb-2"></div>
          </motion.div>

          <motion.div variants={heroItemVariants}>
            <h1 className="font-extrabold text-white pb-0 leading-snug font-sans">
              <span
                className="block text-xl sm:text-2xl md:text-3xl lg:text-5xl xl:text-6xl pb-3"
                style={{
                  background: 'linear-gradient(135deg, #A855F7, #6366F1)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {lang === 'en' ? 'of inflee.app' : 'serwisu inflee.app'}
              </span>
            </h1>
          </motion.div>
        </motion.div>
      </div>

      {/* Prawa kolumna (Treść Regulaminu) */}
      <div className="lg:col-span-5 flex flex-col justify-center items-start pt-6 pb-12 lg:py-0">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full" // Usunęliśmy `max-w-md`, aby treść zajęła całą kolumnę
        >
          {/* Karta, w której jest treść (dla zachowania stylu tła) */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-sm rounded-2xl p-6 md:p-8 w-full">
            <MockTermsContent lang={lang} />
          </div>
        </motion.div>
      </div>
    </>
  );
}