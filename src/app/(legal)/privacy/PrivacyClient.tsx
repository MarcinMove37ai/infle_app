// src/app/(legal)/privacy/page.tsx
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
function MockPrivacyContent({ lang }: { lang: string | null }) {
  return (
    <div className="text-slate-300 space-y-4 text-sm leading-relaxed">
      <h2 className="text-xl font-bold text-white mb-3">
        {lang === 'en'
          ? '1. Data Administrator'
          : '1. Administrator Danych'}
      </h2>
      <p>
        {lang === 'en'
          ? 'This is a mock privacy policy document for inflee.app. This content is a placeholder.'
          : 'To jest przykładowy dokument polityki prywatności serwisu inflee.app. Ta treść jest zastępcza.'}
      </p>
      <p>
        {lang === 'en'
          ? 'The administrator of your personal data is [Your Company Name], based in [Your City]. Contact: [Your Email]'
          : 'Administratorem Twoich danych osobowych jest [Nazwa Twojej Firmy] z siedzibą w [Twoje Miasto]. Kontakt: [Twój Email]'}
      </p>

      <h2 className="text-xl font-bold text-white mt-6 mb-3">
        {lang === 'en'
          ? '2. What data do we collect?'
          : '2. Jakie dane zbieramy?'}
      </h2>
      <p>
        {lang === 'en'
          ? 'We collect data provided during registration, such as:'
          : 'Zbieramy dane podawane podczas rejestracji, takie jak:'}
      </p>
      <ul className="list-disc list-inside space-y-2 pl-2">
        <li>
          {lang === 'en'
            ? 'First and Last Name'
            : 'Imię i nazwisko'}
        </li>
        <li>{lang === 'en' ? 'Email address' : 'Adres e-mail'}</li>
        <li>{lang === 'en' ? 'Phone number (optional)' : 'Numer telefonu (opcjonalnie)'}</li>
        <li>{lang === 'en' ? 'Social media links' : 'Linki do mediów społecznościowych'}</li>
      </ul>

      <h2 className="text-xl font-bold text-white mt-6 mb-3">
        {lang === 'en' ? '3. User Rights' : '3. Prawa użytkownika'}
      </h2>
      <p>
        {lang === 'en'
          ? 'You have the right to access, rectify, or delete your data at any time. You can do this in the account settings panel.'
          : 'Masz prawo do wglądu, poprawiania lub usunięcia swoich danych w dowolnym momencie. Możesz to zrobić w panelu ustawień konta.'}
      </p>
    </div>
  );
}

export default function PrivacyPage() {
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
              <span className="block text-3xl sm:text-4xl md:text-5xl lg:text-7xl xl:text-8xl">
                {lang === 'en' ? 'Privacy Policy' : 'Polityka Prywatności'}
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

      {/* Prawa kolumna (Treść Polityki) */}
      <div className="lg:col-span-5 flex flex-col justify-center items-start pt-6 pb-12 lg:py-0">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full" // Usunęliśmy `max-w-md`
        >
          {/* Karta, w której jest treść */}
          <div className="bg-black/40 border border-white/10 backdrop-blur-sm rounded-2xl p-6 md:p-8 w-full">
            <MockPrivacyContent lang={lang} />
          </div>
        </motion.div>
      </div>
    </>
  );
}