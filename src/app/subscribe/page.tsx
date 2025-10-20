// src/app/subscribe/page.tsx
"use client"

import React, { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, CreditCard, Smartphone, ArrowLeft, ArrowUpCircle, MinusCircle, Flame, X } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

type PaymentMethod = 'card' | 'blik';

interface Plan {
  id: string;
  name: string;
  description: string;
  priceCard: number;
  priceBlik: number;
  currency: string;
  features: string[];
  notIncluded: string[];
  highlighted?: boolean;
  comingSoon?: boolean;
  isGolden?: boolean;
  buttonText: string;
}

// Komponent Modalu
const ContactModal = ({
  isOpen,
  onClose,
  subject,
}: {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
}) => {
  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Tutaj logika wysyłania formularza
    alert('Dziękujemy za kontakt! Odpowiemy najszybciej jak to możliwe.');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="bg-slate-800/80 ring-1 ring-white/10 rounded-2xl p-8 w-full max-w-md relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 left-4 text-slate-400 hover:text-white transition-colors"
              aria-label="Zamknij"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-2xl font-bold text-white text-center mb-2">Skontaktuj się z nami</h2>
            <p className="text-sm text-slate-400 text-center mb-6">Wypełnij formularz, a my odezwiemy się do Ciebie.</p>

            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-slate-300 mb-1">
                  Temat
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={subject}
                  readOnly
                  className="w-full bg-slate-700/50 ring-1 ring-white/10 rounded-md py-2 px-3 text-white placeholder-slate-400 focus:ring-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
                  Adres e-mail
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  placeholder="twoj@email.com"
                  className="w-full bg-slate-700/50 ring-1 ring-white/10 rounded-md py-2 px-3 text-white placeholder-slate-400 focus:ring-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-1">
                  Numer telefonu
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  required
                  placeholder="+48 123 456 789"
                  className="w-full bg-slate-700/50 ring-1 ring-white/10 rounded-md py-2 px-3 text-white placeholder-slate-400 focus:ring-indigo-400 focus:outline-none"
                />
              </div>
              <div className="flex items-start space-x-3 pt-2">
                <input
                  id="consent"
                  name="consent"
                  type="checkbox"
                  required
                  className="h-4 w-4 mt-1 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                />
                <div className="text-sm">
                  <label htmlFor="consent" className="text-slate-400">
                    Wyrażam zgodę na jednorazowy kontakt mailowy i telefoniczny do celów marketingowych.
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium py-3 px-4 rounded-lg hover:opacity-90 transition-opacity shadow-lg"
              >
                Wyślij
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


export default function SubscribePage() {
  const { data: session } = useSession();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalSubject, setModalSubject] = useState('');

  const handleOpenModal = (subject: string) => {
    setModalSubject(subject);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const plans: Plan[] = [
    {
      id: 'rookie',
      name: 'Rookie',
      description: 'Wszystko czego potrzebujesz by zacząć tworzyć i zarabiać!',
      priceCard: 37,
      priceBlik: 87,
      currency: 'zł/miesiąc',
      features: [
        'Zaawansowany Generator ebook-ów zasilany AI',
        'Automatyczny Generator stron zapisu zasilany AI',
        'Szczegółowe statystyki wizyt oraz pobrań',
        'Intuicyjny CRM do zarządzania Leadami',
        'Integracja z buycoffe.to by zarabiać od pierwsszego dnia',

      ],
      notIncluded: [
        'max. 1 nowy ebook w miesiącu',
        'max. 1 źródło na ebook',
        'max. 6 rodzdziałów na ebook',
        'max. 1 aktywna strona zapisu',
        'max. 100 kontaktów w bazie',
        'Oznaczenia "made with inflee.app"',
        'Wsparcie z reakcją do 72h',
      ],
      buttonText: '21 dni za darmo'
    },
    {
      id: 'creator',
      name: 'Creator',
      description: 'Wszystko czego potrzebujesz aby rosnąć i zarabiać na poważnie!',
      priceCard: 87,
      priceBlik: 137,
      currency: 'zł/miesiąc',
      features: [
        'Gwarantowana propozycja płatnej Współpracy',
        'Zaawansowany Generator ebook-ów zasilany AI',
        'Automatyczny Generator stron zapisu zasilany AI',
        'Szczegółowe statystyki wizyt oraz pobrań',
        'Intuicyjny CRM do zarządzania Leadami',
        'Integracja z buycoffe.to by zarabiać od pierwsszego dnia',
      ],
      notIncluded: [
        'do 5 nowy ebook w miesiącu',
        'do 5 źródeł na ebook',
        'do 12 rodzdziałów na ebook',
        'do 5 aktywna strona zapisu',
        'do 1000 kontaktów w bazie',
        'Oznaczenia "made with inflee.app"',
        'Wsparcie z reakcją do 24h',
      ],
      highlighted: true,
      buttonText: 'Uruchom Plan'
    },
    {
      id: 'unlimited',
      name: 'Unlimited',
      description: 'Dla influenserów którzy nie chcą się ograniczać!',
      priceCard: 297,
      priceBlik: 347,
      currency: 'zł/miesiąc',
      features: [
        'Nieograniczona ilość ebooków',
        'Nieograniczona ilość źródeł',
        'Nieograniczona ilość rozdziałów',
        'Nieograniczona ilość stron zapisu',
        'Nieograniczona ilość leadów',
        'Brak oznaczenia "made with inflee.app"',
        'Wsparcie z reakcją do 3h',
      ],
      notIncluded: [],
      buttonText: 'Uruchom Plan'
    },
    {
      id: 'whitelabel',
      name: 'White Label',
      description: 'Dla agencji i firm',
      priceCard: 10000,
      priceBlik: 10000,
      currency: 'zł',
      features: [
        'Własny branding',
        'Własna domena',
        'Własny Meta Pixel / GTM',
        'Personalizacja e-booków',
        'Personalizacja stron zapisu',
        'Wbudowane integracje z narzędziami zewnętrznymi',
        'Swoboda wyboru modeli AI, również lokalnych',
        'Możliwość dalszej dystrybucji subskrypcji',
        'Pożliwość sfinansowania dotacją LGD/PUP'

      ],
      notIncluded: [],
      comingSoon: false,
      isGolden: true,
      buttonText: 'Oferta'
    }
  ];

  const getPrice = (plan: Plan) => {
    const price = paymentMethod === 'card' ? plan.priceCard : plan.priceBlik;
    const formattedPrice = new Intl.NumberFormat('pl-PL').format(price);

    if (plan.id === 'whitelabel') {
      return (
        <div>
          <div className="flex items-baseline justify-center">
            <span className="text-xl font-medium text-slate-400 mr-2">od</span>
            <span>{formattedPrice}</span>
            <span className="text-xl font-medium text-slate-400 ml-2">{plan.currency}</span>
          </div>
          <div className="text-xs font-normal text-slate-500 mt-2 text-center">+ koszty utrzymania</div>
        </div>
      );
    }

    return (
      <div className="flex items-baseline">
        <span>{formattedPrice}</span>
        <span className="text-xl font-medium text-slate-400 ml-2">{plan.currency}</span>
      </div>
    );
  };

  const renderPlanButton = (plan: Plan) => {
    const buttonClass = `w-full py-3 px-4 rounded-lg font-medium text-sm transition-all shadow-md ${
      plan.comingSoon
        ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
        : plan.isGolden
        ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white hover:opacity-90 shadow-lg cursor-pointer'
        : plan.highlighted
        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90 shadow-lg cursor-pointer'
        : 'bg-white/10 text-white hover:bg-white/20 ring-1 ring-white/20 cursor-pointer'
    }`;

    if (plan.id === 'whitelabel') {
      return (
        <button
          onClick={() => handleOpenModal('Zapytanie o White Label')}
          disabled={plan.comingSoon}
          className={buttonClass}
        >
          {plan.buttonText}
        </button>
      );
    }

    return (
      <a
        href="https://app.inflee.app/register"
        target="_blank"
        rel="noopener noreferrer"
        className={plan.comingSoon ? 'pointer-events-none' : ''}
      >
        <button
          disabled={plan.comingSoon}
          className={buttonClass}
        >
          {plan.buttonText}
        </button>
      </a>
    );
  };

  return (
    <>
      <ContactModal isOpen={isModalOpen} onClose={handleCloseModal} subject={modalSubject} />
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <Link
              href="/strony-zapisu"
              className="inline-flex items-center text-indigo-400 hover:text-indigo-300 mb-6 text-sm font-medium cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Powrót do panelu
            </Link>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
              Wybierz plan idealny dla Ciebie
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Wybierz plan który najlepiej odpowiada Twoim potrzebom lub zacznij darmowy okres próbny aby poznać lepiej Inflee.app
            </p>
          </div>

          {/* Payment Method Toggle */}
          <div className="text-center mb-12">
            <div className="bg-slate-800/80 rounded-lg ring-1 ring-white/10 p-1 inline-flex backdrop-blur-sm">
              <button
                onClick={() => setPaymentMethod('card')}
                className={`flex items-center px-6 py-3 rounded-md text-sm font-medium transition-all duration-300 cursor-pointer ${
                  paymentMethod === 'card'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Subskrypcja (Płatność kartą)
              </button>
              <button
                onClick={() => setPaymentMethod('blik')}
                className={`flex items-center px-6 py-3 rounded-md text-sm font-medium transition-all duration-300 cursor-pointer ${
                  paymentMethod === 'blik'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <Smartphone className="w-4 h-4 mr-2" />
                Jednorazowo (Płatność BLIK)
              </button>
            </div>
            <p className="text-slate-400 text-sm mt-4">Płać tak jak jest Ci wygodnie</p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16 items-start">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl transition-all duration-300
                  ${plan.highlighted
                    ? 'shadow-[0_0_60px_rgba(168,85,247,0.25)]'
                    : ''
                  }
                  ${plan.isGolden
                    ? 'shadow-[0_0_30px_rgba(252,211,77,0.20)]'
                    : ''
                  }
                  ${plan.comingSoon
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:scale-105 hover:-translate-y-1'
                  }
                `}
              >
                <div
                  className={`p-0.5 rounded-2xl ${
                    plan.highlighted ? 'bg-gradient-to-b from-purple-500 to-indigo-500'
                    : plan.isGolden ? 'bg-gradient-to-b from-amber-500 to-yellow-600'
                    : ''
                  }`}
                >
                  <div className={`relative ${
                    plan.isGolden ? 'bg-slate-900' : 'bg-slate-800/95'
                  } backdrop-blur-sm rounded-[15px] h-full ${
                    !plan.highlighted && !plan.isGolden ? 'ring-1 ring-white/10' : ''
                  }`}>

                    {plan.highlighted && (
                      <div className="absolute -top-4 left-1/3 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                          Najpopularniejszy
                        </span>
                      </div>
                    )}
                    {plan.isGolden && (
                       <div className="absolute -top-4 left-1/3 transform -translate-x-1/2">
                         <span className="bg-gradient-to-r from-amber-500 to-yellow-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                           Aplikacja na własność
                         </span>
                       </div>
                    )}

                    <div className="flex flex-col h-full py-8 px-7">
                      <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                      <p className="text-sm text-slate-400 mb-6 h-10">{plan.description}</p>

                      <div className="mb-6 min-h-[105px] flex flex-col items-center justify-center">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={plan.id === 'whitelabel' ? 'whitelabel-price' : paymentMethod}
                            initial={{ opacity: 0, y: -15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 15 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="text-4xl font-bold text-white"
                          >
                            {getPrice(plan)}
                          </motion.div>
                        </AnimatePresence>

                        <AnimatePresence>
                          {paymentMethod === 'blik' && plan.priceBlik > plan.priceCard && (
                            <motion.p
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="text-xs text-slate-400 mt-2 text-center"
                            >
                              Z subskrypcją taniej o {plan.priceBlik - plan.priceCard}zł, możesz zrezygnować w dowolnym momencie
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="mb-8">
                        {renderPlanButton(plan)}

                        {plan.id === 'rookie' && (
                          <div className="text-xs text-slate-500 text-left mt-2 space-y-1">
                            <p>* Nie wymaga karty by zacząć</p>
                          </div>
                        )}
                      </div>

                      <div className="flex-grow">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Co zawiera:</div>
                        {plan.features.map((feature, index) => (
                          <div key={index} className="flex items-start mb-3">
                            {plan.id === 'creator' && feature.startsWith('Gwarantowana') ? (
                              <Flame className="w-5 h-5 text-amber-400 fill-amber-400 mr-3 flex-shrink-0 mt-0.5" />
                            ) : (
                              <Check className="w-5 h-5 text-indigo-400 mr-3 flex-shrink-0 mt-0.5" />
                            )}
                            <span className="text-sm text-slate-300 leading-relaxed">{feature}</span>
                          </div>
                        ))}

                        {(plan.id === 'creator' || plan.id === 'unlimited') && (
                          <div className="pt-3 mt-3 border-t border-white/10">
                             <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Wkrótce:</div>
                             <div className="flex items-start mb-3">
                               <Check className="w-5 h-5 text-indigo-400 mr-3 flex-shrink-0 mt-0.5" />
                               <span className="text-sm text-slate-300 leading-relaxed">Integracje STRIPE/P24/TPay aby sprzedawać włąsne ebooki</span>
                             </div>
                           </div>
                        )}

                        {plan.notIncluded.length > 0 && (
                          <>
                            <div className={`text-xs font-semibold uppercase tracking-wide mt-6 mb-3 ${
                              plan.id === 'creator' ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                              Limity:
                            </div>
                            {plan.notIncluded.map((feature, index) => (
                              <div key={index} className="flex items-start mb-3">
                                {plan.id === 'creator' ? (
                                  <>
                                    <ArrowUpCircle className="w-5 h-5 text-sky-400 mr-3 flex-shrink-0 mt-0.5" />
                                    <span className="text-sm text-slate-400 leading-relaxed">{feature}</span>
                                  </>
                                ) : (
                                  <>
                                    <MinusCircle className="w-5 h-5 text-slate-500 mr-3 flex-shrink-0 mt-0.5" />
                                    <span className="text-sm text-slate-500 leading-relaxed">{feature}</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">Często zadawane pytania</h2>
            <div className="bg-slate-800/50 rounded-xl ring-1 ring-white/10 divide-y divide-white/10">
              <div className="p-6">
                <h3 className="font-semibold text-white mb-2">Jaka jest różnica między płatnością kartą a BLIK?</h3>
                <p className="text-slate-400 text-sm">
                  Płatność kartą tworzy automatyczną subskrypcję, która odnawia się co miesiąc, zapewniając ciągłość usługi. BLIK to jednorazowa opłata z góry za 30 dni dostępu – po tym czasie należy ją odnowić ręcznie.
                </p>
              </div>
              <div className="p-6">
                <h3 className="font-semibold text-white mb-2">Czy mogę anulować subskrypcję w każdej chwili?</h3>
                <p className="text-slate-400 text-sm">
                  Oczywiście. Subskrypcję możesz anulować w dowolnym momencie w ustawieniach konta. Dostęp do funkcji premium pozostanie aktywny do końca opłaconego okresu.
                </p>
              </div>
              <div className="p-6">
                <h3 className="font-semibold text-white mb-2">Czy mogę zmienić plan później?</h3>
                <p className="text-slate-400 text-sm">
                  Tak, zmiana planu jest możliwa w każdej chwili. Przejście na wyższy plan (upgrade) działa natychmiast. Przejście na niższy (downgrade) aktywuje się po zakończeniu bieżącego okresu rozliczeniowego.
                </p>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="text-center mt-12">
            <p className="text-slate-400">
              Masz więcej pytań?
              <button
                onClick={() => handleOpenModal('Potrzebuje więcej informacji')}
                className="font-medium text-indigo-400 hover:text-indigo-300 ml-2 cursor-pointer bg-transparent border-none p-0"
              >
                Skontaktuj się z nami
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}