// src/components/ui/UpgradeModal.tsx
import React from 'react';
import { X, Check, CreditCard, FileText, AlertTriangle, Loader2, LucideIcon, Smartphone, Download, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: any;
  currentLang: 'pl' | 'en';
  currentPlanRole: string;
  subscriptionData: any;
  onManageBilling: () => void;
}

interface PlanFeature {
  icon: LucideIcon;
  textPl: string;
  textEn: string;
}

// Modal potwierdzenia anulowania (Bez zmian)
function CancelConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  nextBillingDate,
  currentLang,
  isLoading,
  currentPlanRole
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  nextBillingDate?: string;
  currentLang: 'pl' | 'en';
  isLoading: boolean;
  currentPlanRole: string;
}) {
  if (!isOpen) return null;

  const isFreeVer = currentPlanRole === 'free_ver';

  const formattedDate = nextBillingDate
    ? new Date(nextBillingDate).toLocaleDateString(
        currentLang === 'pl' ? 'pl-PL' : 'en-US',
        { day: 'numeric', month: 'long', year: 'numeric' }
      )
    : '';

  const daysRemaining = nextBillingDate
    ? Math.ceil((new Date(nextBillingDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={isLoading ? undefined : onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 mx-4">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-3">
          {currentLang === 'pl' ? 'Czy na pewno chcesz anulować?' : 'Are you sure you want to cancel?'}
        </h3>
        <div className="space-y-3 mb-6">
          <p className="text-gray-300 text-center text-sm sm:text-base leading-relaxed">
            {currentLang === 'pl' ? 'Anulowanie subskrypcji spowoduje:' : 'Canceling your subscription will result in:'}
          </p>
          <ul className="space-y-2.5 text-gray-400 text-sm">
            <li className="flex items-center gap-3">
              <span className="text-red-400 flex-shrink-0">•</span>
              <span className="leading-relaxed">{currentLang === 'pl' ? 'Utrata dostępu do funkcji AI' : 'Loss of access to AI features'}</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-red-400 flex-shrink-0">•</span>
              <span className="leading-relaxed">{currentLang === 'pl' ? 'Strony Zapisu przestaną być publiczne' : 'Landing Pages will no longer be public'}</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-red-400 flex-shrink-0">•</span>
              <span className="leading-relaxed">{currentLang === 'pl' ? 'Nowe Leady nie będą się pojawiać' : 'New Leads will stop appearing'}</span>
            </li>
          </ul>
          {isFreeVer && formattedDate && daysRemaining > 0 && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
              <p className="text-sm font-semibold text-red-300 mb-2">{currentLang === 'pl' ? '⚠️ Uwaga - Skutki natychmiastowe!' : '⚠️ Warning - Immediate effect!'}</p>
              <p className="text-xs text-gray-300 mb-2">
                {currentLang === 'pl' ? `Pozostało Ci jeszcze ${daysRemaining} ${daysRemaining === 1 ? 'dzień' : 'dni'} darmowego okresu próbnego (do ${formattedDate}).` : `You still have ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} of free trial period remaining (until ${formattedDate}).`}
              </p>
              <p className="text-xs text-red-300 font-medium">
                {currentLang === 'pl' ? 'Po anulowaniu stracisz natychmiast dostęp do wszystkich funkcji planu Rookie i konto zostanie przełączone na wersję Darmową.' : 'After cancellation, you will immediately lose access to all Rookie Plan features and your account will be switched to Free mode.'}
              </p>
            </div>
          )}
          {!isFreeVer && formattedDate && (
            <div className="mt-4 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">{currentLang === 'pl' ? 'Dostęp do:' : 'Access until:'}</p>
              <p className="text-white font-medium">{formattedDate}</p>
              <p className="text-xs text-gray-400 mt-1">
                {currentLang === 'pl' ? 'Twoja subskrypcja pozostanie aktywna do końca okresu rozliczeniowego. Po tej dacie konto zostanie przełączone na wersję Darmową' : 'Your subscription will remain active until the end of the billing period. After this date, your account will be switched to Demo version.'}
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={onClose} disabled={isLoading} className="flex-1 py-3 px-4 bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            {isFreeVer ? (currentLang === 'pl' ? 'Zachowuję Okres Próbny' : 'Continue Trial') : (currentLang === 'pl' ? 'Utrzymaj Subskrypcję' : 'Keep subscription')}
          </button>
          <button onClick={onConfirm} disabled={isLoading} className="flex-1 py-3 px-4 bg-transparent border border-red-500/30 hover:bg-red-500/10 text-red-400 hover:text-red-300 font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer">
            {isLoading ? (<><Loader2 className="animate-spin w-4 h-4 mr-2" />{currentLang === 'pl' ? 'Anulowanie...' : 'Canceling...'}</>) : (isFreeVer ? (currentLang === 'pl' ? 'Rezygnuję z Okresu Próbnego' : 'Cancel Trial') : (currentLang === 'pl' ? 'Anuluj Subskrypcję' : 'Cancel Subscription'))}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UpgradeModal({
  isOpen,
  onClose,
  t,
  currentLang,
  currentPlanRole,
  subscriptionData,
  onManageBilling
}: UpgradeModalProps) {
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false);
  const [isCanceling, setIsCanceling] = React.useState(false);
  const [isRedirecting, setIsRedirecting] = React.useState<string | null>(null);

  const [fetchedPrices, setFetchedPrices] = React.useState<Record<string, string> | null>(null);
  const [isLoadingPrices, setIsLoadingPrices] = React.useState(false);

  // --- NOWE STANY DLA PRZEŁĄCZNIKA ---
  const isDemoUser = subscriptionData?.role === 'demo';
  const isOneTimePaid = subscriptionData?.subscriptionStatus === 'one_time_paid';

  const [paymentMethod, setPaymentMethod] = React.useState<'subscription' | 'onetime'>('subscription');

  // Billing History Modal
  const [showBillingHistory, setShowBillingHistory] = React.useState(false);
  const [billingHistory, setBillingHistory] = React.useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);

  const modalContainerRef = React.useRef<HTMLDivElement>(null);

  // Funkcja pobierająca historię płatności
  const fetchBillingHistory = React.useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      // 1. Pobierz język z localStorage (zgodnie z Twoim ustawieniem)
      // Jeśli brak, domyślnie 'pl'
      const storedLang = localStorage.getItem('appLanguage') || 'pl';

      // 2. Przekaż parametr ?locale=... do backendu
      const response = await fetch(`/api/stripe/history?locale=${storedLang}`);

      if (response.ok) {
        const data = await response.json();
        setBillingHistory(data.invoices || []);
      }
    } catch (error) {
      console.error('Failed to load billing history', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      const fetchPrices = async () => {
        setIsLoadingPrices(true);
        try {
          const response = await fetch(`/api/stripe/get-prices?locale=${currentLang}`);
          if (response.ok) {
            const data = await response.json();
            setFetchedPrices(data);
          }
        } catch (error) {
          console.error('Failed to load prices', error);
        } finally {
          setIsLoadingPrices(false);
        }
      };
      // Ceny subskrypcyjne pobieramy zawsze
      fetchPrices();
    }
  }, [isOpen, currentLang]);

  // --- DEFINICJA PLANÓW ---
  // UWAGA: Uzupełnij 'priceOneTimePln' właściwymi kwotami!
  const allPlans = [
    {
      roleName: 'rookie',
      apiPlanName: 'rookie',
      planKey: 'planRookie',
      descriptionKey: 'planDescriptionRookie',
      pricePln: '0 zł', // Fallback subskrypcja
      priceUsd: '$0',
      priceOneTimePln: '000 zł', // TODO: WPISZ TUTAJ CENĘ JEDNORAZOWĄ DLA ROOKIE
      currencyKey: 'pricing.currencyPerMonth',
      demoBadge: currentLang === 'pl' ? 'Świetny by zacząć' : 'Great to start',
      demoBadgeColor: 'from-emerald-500 to-teal-500',
      features: [
        { icon: Check, textPl: '1 nowy e-book na miesiąc', textEn: '1 new e-book per month' },
        { icon: Check, textPl: '1 źródło na e-book', textEn: '1 source per e-book' },
        { icon: Check, textPl: '6 rozdziałów na e-book', textEn: '6 chapters per e-book' },
        { icon: Check, textPl: '1 aktywny Landing Page', textEn: '1 active Landing Page' },
        { icon: Check, textPl: '100 kontaktów w bazie', textEn: '100 contacts in the database' },
        { icon: Check, textPl: 'Branding "made with inflee.app"', textEn: 'Branding "made with inflee.app"' },
        { icon: Check, textPl: 'Wsparcie do 72h', textEn: 'Support up to 72h' },
      ],
      limits: [] as PlanFeature[]
    },
    {
      roleName: 'creator',
      apiPlanName: 'creator',
      planKey: 'planCreator',
      descriptionKey: 'planDescriptionCreator',
      pricePln: '0 zł', // Fallback subskrypcja
      priceUsd: '$0',
      priceOneTimePln: '000 zł', // TODO: WPISZ TUTAJ CENĘ JEDNORAZOWĄ DLA CREATOR
      currencyKey: 'pricing.currencyPerMonth',
      demoBadge: currentLang === 'pl' ? 'Najpopularniejszy' : 'Most Popular',
      demoBadgeColor: 'from-violet-500 to-fuchsia-500',
      features: [
        { icon: Check, textPl: 'do 5 nowych e-booków na miesiąc', textEn: 'up to 5 new e-books per month' },
        { icon: Check, textPl: 'do 5 źródeł na e-book', textEn: 'up to 5 sources per e-book' },
        { icon: Check, textPl: 'do 12 rozdziałów na e-book', textEn: 'up to 12 chapters per e-book' },
        { icon: Check, textPl: 'do 5 aktywnych Landing Pages', textEn: 'up to 5 active Landing Pages' },
        { icon: Check, textPl: 'do 1000 kontaktów w bazie', textEn: 'up to 1000 contacts in the database' },
        { icon: Check, textPl: 'Branding "made with inflee.app"', textEn: 'Branding "made with inflee.app"' },
        { icon: Check, textPl: 'Wsparcie do 24h', textEn: 'Support up to 24h' },
      ],
      limits: [] as PlanFeature[]
    },
    {
      roleName: 'unlimited',
      apiPlanName: 'unlimited',
      planKey: 'planUnlimited',
      descriptionKey: 'planDescriptionUnlimited',
      pricePln: '0 zł', // Fallback subskrypcja
      priceUsd: '$0',
      priceOneTimePln: '000 zł', // TODO: WPISZ TUTAJ CENĘ JEDNORAZOWĄ DLA UNLIMITED
      currencyKey: 'pricing.currencyPerMonth',
      demoBadge: 'No Limits',
      demoBadgeColor: 'from-amber-500 to-orange-500',
      features: [
        { icon: Check, textPl: 'Nielimitowane e-booki', textEn: 'Unlimited e-books' },
        { icon: Check, textPl: 'Nielimitowane źródła', textEn: 'Unlimited sources' },
        { icon: Check, textPl: 'Nielimitowane rozdziały', textEn: 'Unlimited chapters' },
        { icon: Check, textPl: 'Nielimitowane Landing Pages', textEn: 'Unlimited Landing Pages' },
        { icon: Check, textPl: 'Nielimitowane Leady', textEn: 'Unlimited leads' },
        { icon: Check, textPl: 'Brak brandingu', textEn: 'No branding' },
        { icon: Check, textPl: 'Wsparcie do 3h', textEn: 'Support up to 3h' },
      ],
      limits: [] as PlanFeature[]
    }
  ];

  const showPaymentManagement = subscriptionData && subscriptionData.role !== 'free';

  // --- WARUNEK WYŚWIETLANIA PRZEŁĄCZNIKA ---
  // Tylko PL ORAZ (Rola Demo LUB (Inna rola ALE OneTimePaid))
  const showPaymentToggle = currentLang === 'pl' && (isDemoUser || isOneTimePaid);

  const PLAN_ORDER = ['rookie', 'creator', 'unlimited'];
  const normalizedCurrentRole = currentPlanRole === 'free_ver' ? 'rookie' : currentPlanRole;
  const currentPlanIndex = PLAN_ORDER.indexOf(normalizedCurrentRole);

  let availablePlans = [];
  if (isDemoUser) {
    availablePlans = allPlans;
  } else {
    availablePlans = allPlans.filter(plan => {
      if (plan.roleName === normalizedCurrentRole) return false;
      return true;
    }).slice(0, 2);
  }

  const translate = (key: string, fallback: string = '') => (t as any)[key] || fallback || key;

  if (!(t as any)['pricing.currencyPerMonth']) {
    (t as any)['pricing.currencyPerMonth'] = currentLang === 'pl' ? '/ mies.' : '/ mo.';
  }

  const handleCancelClick = () => {
    if (modalContainerRef.current) modalContainerRef.current.scrollTop = 0;
    setShowCancelConfirm(true);
  };

  const handleCancelConfirm = async () => {
    setIsCanceling(true);
    try {
      const response = await fetch('/api/subscription/cancel', { method: 'POST' });
      if (response.ok) {
        setShowCancelConfirm(false);
        onClose();
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || (currentLang === 'pl' ? 'Wystąpił błąd podczas anulowania.' : 'An error occurred while canceling.'));
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      alert(currentLang === 'pl' ? 'Błąd połączenia z serwerem.' : 'Server connection error.');
    } finally {
      setIsCanceling(false);
    }
  };

  const handleUpgradeClick = async (plan: typeof allPlans[0]) => {
    setIsRedirecting(plan.roleName);

    try {
      let url = '';
      let bodyData = {};

      if (paymentMethod === 'onetime') {
        // --- ŚCIEŻKA JEDNORAZOWA (BLIK/PRZELEW) ---

        // SCENARIUSZ 1: Upgrade One-Time -> One-Time (z rabatem za niewykorzystany czas)
        if (isOneTimePaid) {
            url = '/api/stripe/upgrade-onetime-to-onetime';
            bodyData = {
              targetPlan: plan.apiPlanName,
              locale: currentLang
            };
        } else {
            // SCENARIUSZ 2: Nowy zakup One-Time (np. z Demo)
            url = '/api/stripe/create-one-time-checkout-session';
            bodyData = {
              plan: plan.apiPlanName,
              locale: currentLang
            };
        }

      } else {
        // --- ŚCIEŻKA SUBSKRYPCYJNA (KARTA) ---

        // 1. Sprawdzamy, czy to jest rola "free_ver" (okres próbny)
        const isFreeVer = currentPlanRole === 'free_ver';

        // 2. Definiujemy, kto ma "prawdziwą" aktywną subskrypcję do upgrade'u.
        //    Warunek: Nie jest to płatność jednorazowa, nie jest to Demo ORAZ nie jest to free_ver.
        const hasActiveSubscription = !isOneTimePaid && !isDemoUser && !isFreeVer;

        // SCENARIUSZ A: Upgrade (One-Time -> Sub LUB Sub -> Sub)
        // Wykonujemy tylko jeśli użytkownik ma już opłacony plan (ale nie trial/free_ver)
        if (isOneTimePaid || hasActiveSubscription) {
          url = '/api/stripe/upgrade-onetime-to-subscription';
          bodyData = {
            targetPlan: plan.apiPlanName,
            locale: currentLang
          };
        } else {
          // SCENARIUSZ B: Nowa subskrypcja od zera (Demo LUB FreeVer)
          // Dla free_ver tworzymy nową sesję checkout, tak jak dla Demo
          url = '/api/stripe/create-checkout';
          bodyData = {
            plan: plan.apiPlanName,
            locale: currentLang
          };
        }
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create checkout session');

      window.location.href = data.url;
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Failed to initialize payment.');
      setIsRedirecting(null);
    }
  };

  if (!isOpen) return null;

  let paymentTypeLabel = null;
  let paymentTypeClass = '';

  if (subscriptionData?.subscriptionStatus === 'one_time_paid') {
      paymentTypeLabel = currentLang === 'pl' ? 'Płatność jednorazowa' : 'One-time payment';
      paymentTypeClass = 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
  } else if (subscriptionData?.subscriptionStatus === 'active' || subscriptionData?.subscriptionStatus === 'trialing') {
      if (showPaymentManagement && !isDemoUser) {
          paymentTypeLabel = currentLang === 'pl' ? 'Subskrypcja' : 'Subscription';
          paymentTypeClass = 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
      }
  }

  return (
    <div
      ref={modalContainerRef}
      className={`fixed inset-0 z-50 px-2 py-4 sm:p-4 flex justify-center scrollbar-hide ${
        showCancelConfirm ? 'overflow-hidden items-center' : 'overflow-y-auto items-start'
      }`}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" onClick={onClose} />

      <div className={`relative bg-gray-900 bg-opacity-90 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl px-3 py-4 sm:p-6 md:p-8 max-w-6xl w-full my-8 text-white overflow-hidden ${
        showCancelConfirm ? 'hidden' : ''
      }`}>

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10 cursor-pointer">
          <X className="w-6 h-6" />
        </button>

        {/* --- SEKCJA GÓRNA: INFO O SUBSKRYPCJI --- */}
        {showPaymentManagement && (
          <div className="mb-6 sm:mb-8 py-4 sm:py-8 border-b border-gray-700/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:items-stretch">
              <div className="flex flex-col h-full">
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 sm:p-5 w-full h-full flex flex-col gap-0 justify-center">
                  <div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-md uppercase tracking-wider">
                        {t.currentPlan}
                      </span>
                      {paymentTypeLabel && (
                        <span className={`px-2 py-1 text-xs font-semibold rounded-md uppercase tracking-wider ${paymentTypeClass}`}>
                          {paymentTypeLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xl text-white capitalize">
                      <span className="font-bold">{translate(subscriptionData?.plan || 'planFree')}</span>
                      {currentPlanRole === 'free_ver' && (
                        <span className="ml-2 text-base italic font-normal text-gray-400">
                          ({currentLang === 'pl' ? 'bezpłatny okres próbny' : 'free trial period'})
                        </span>
                      )}
                    </p>
                  </div>

                  {!isDemoUser && (
                    <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-700/50">
                      <div>
                        {subscriptionData?.nextBillingDate && (
                          <p className="text-sm text-gray-500">
                            <span className="block sm:inline">{t.renewsAt}</span>{' '}
                            <span className="text-gray-300 whitespace-nowrap">
                              {new Date(subscriptionData.nextBillingDate).toLocaleDateString(currentLang === 'pl' ? 'pl-PL' : 'en-US', {
                                day: 'numeric', month: 'long', year: 'numeric'
                              })}
                            </span>
                          </p>
                        )}
                      </div>
                      {subscriptionData?.nextBillingAmount && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500 mb-1">{currentLang === 'pl' ? 'Wartość' : 'Value'}</p>
                          <span className="text-xl font-bold text-white block">
                            {subscriptionData.nextBillingAmount}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col h-full">
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 sm:p-5 w-full h-full flex flex-col gap-3 justify-center">
                  {isDemoUser ? (
                    <div className="flex items-start space-x-3 text-amber-400/90">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm leading-relaxed">
                          {currentLang === 'pl'
                            ? 'Twoje dane są bezpieczne, ale strony zapisu nie są aktywne. Opłać plan aby publikować i tworzyć.'
                            : 'Your data is safe, but Landing Pages are not active. Upgrade your plan to publish and create.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">{t.currentPaymentMethod}</p>

                        {subscriptionData?.cardLast4 ? (
                          /* SCENARIUSZ 1: JEST KARTA */
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-8 bg-gray-700 rounded flex items-center justify-center border border-gray-600">
                              <CreditCard className="w-5 h-5 text-gray-300" />
                            </div>
                            <div>
                              <p className="text-white font-medium capitalize flex items-center">
                                {subscriptionData.cardBrand} <span className="mx-2 text-gray-500">•</span> •••• {subscriptionData.cardLast4}
                              </p>
                            </div>
                          </div>
                        ) : isOneTimePaid ? (
                          /* SCENARIUSZ 2: NIE MA KARTY, ALE JEST PŁATNOŚĆ ONE-TIME (Neutralny komunikat) */
                          <div className="flex items-center space-x-4">
                             <div className="w-12 h-8 bg-gray-800/50 rounded flex items-center justify-center border border-gray-700 border-dashed">
                               <CreditCard className="w-5 h-5 text-gray-600" />
                             </div>
                             <div>
                               <p className="text-gray-400 text-sm font-medium">
                                 {currentLang === 'pl' ? 'Karta nie została dodana' : 'Card not added'}
                               </p>
                             </div>
                          </div>
                        ) : (
                          /* SCENARIUSZ 3: BRAK KARTY I BRAK PŁATNOŚCI (Ostrzeżenie) */
                          <div className="flex items-center space-x-2 text-gray-400">
                            <AlertTriangle className="w-5 h-5" />
                            <span className="text-sm">{t.paymentMethodPlaceholder}</span>
                          </div>
                        )}
                      </div>

                      {/* PRZYCISK HISTORII: Wyświetl jeśli jest karta LUB płatność jednorazowa */}
                      {(subscriptionData?.cardLast4 || isOneTimePaid) && (
                        <div className="w-full mt-4 pt-4 border-t border-gray-700/50 flex justify-end">
                          <button onClick={() => {
                            setShowBillingHistory(true);
                            fetchBillingHistory();
                          }} className="flex items-center px-1 py-1 text-gray-400 hover:text-white text-sm font-medium transition-colors cursor-pointer">
                            <FileText className="w-4 h-4 mr-2" />
                            {t.billingHistory.replace(/\s*\(.*?\)\s*/g, "")}
                            <span className="ml-1 text-gray-600">→</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center pb-6 mx-auto mb-2">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{t.upgradeModalTitle}</h2>
          <p className="mt-2 sm:mt-3 text-base sm:text-lg text-gray-400">{t.upgradeModalSubtitle}</p>
        </div>

        {/* --- PRZEŁĄCZNIK PŁATNOŚCI (TOGGLE) --- */}
        {showPaymentToggle && (
          <div className="text-center mb-10">
            <div className="bg-slate-900/80 rounded-lg ring-1 ring-white/10 p-1 inline-flex backdrop-blur-sm relative">
              <motion.div
                className="absolute top-1 bottom-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-md shadow-lg pointer-events-none"
                animate={{
                  left: paymentMethod === 'subscription' ? '4px' : 'calc(50% + 2px)',
                  width: 'calc(50% - 6px)'
                }}
                transition={{
                  type: "spring",
                  stiffness: 350,
                  damping: 35,
                  mass: 0.8
                }}
              />

              <button
                onClick={() => setPaymentMethod('subscription')}
                className={`relative z-10 flex items-center justify-center px-6 py-3 rounded-md text-sm font-medium transition-colors duration-200 cursor-pointer ${
                  paymentMethod === 'subscription'
                    ? 'text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Subskrypcja (Płatność kartą)
              </button>
              <button
                onClick={() => setPaymentMethod('onetime')}
                className={`relative z-10 flex items-center justify-center px-6 py-3 rounded-md text-sm font-medium transition-colors duration-200 cursor-pointer ${
                  paymentMethod === 'onetime'
                    ? 'text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4 mr-2" />
                Jednorazowo (Płatność BLIK)
              </button>
            </div>
            <p className="text-slate-400 text-sm mt-4">Płać tak jak jest Ci wygodnie</p>
          </div>
        )}

        {/* --- SEKCJA ŚRODKOWA: KARTY PLANÓW --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-0">
          {/* 1. KARTY STANDARDOWE */}
          {availablePlans.map((plan) => {
            const planName = translate(plan.planKey);

            // 1. Logika cen
            let displayPrice = '';
            // ZMIANA: Dopisek (np. / mies.) jest teraz zawsze widoczny, zgodnie z prośbą
            let currencySuffix = translate(plan.currencyKey);

            const oneTimePriceKey = `${plan.roleName}_onetime`;
            const liveOneTimePrice = fetchedPrices?.[oneTimePriceKey];

            if (paymentMethod === 'onetime') {
                // Dla jednorazowej: Cena z API -> lub z propsów
                displayPrice = liveOneTimePrice || plan.priceOneTimePln;
            } else {
                // Dla subskrypcji: Cena z API -> lub fallback (PL/USD)
                const livePrice = fetchedPrices?.[plan.roleName];
                const fallbackPrice = currentLang === 'pl' ? plan.pricePln : plan.priceUsd;
                displayPrice = livePrice || fallbackPrice;
            }

            // 2. Wyróżnienie planów (logika bez zmian)
            let isHighlighted = false;
            let isDowngrade = false;

            if (!isDemoUser) {
              const thisPlanIndex = PLAN_ORDER.indexOf(plan.roleName);
              if (thisPlanIndex === currentPlanIndex + 1) isHighlighted = true;
              if (thisPlanIndex < currentPlanIndex) isDowngrade = true;
            }

            const badgeText = isDemoUser ? plan.demoBadge : (isHighlighted ? (currentLang === 'pl' ? 'Polecany' : 'Recommended') : null);
            const badgeColor = isDemoUser ? plan.demoBadgeColor : 'from-violet-500 to-fuchsia-500';
            const isCardHighlighted = !isDemoUser && isHighlighted;

            return (
              <div key={plan.roleName} className={`relative rounded-2xl p-px ${isCardHighlighted ? `bg-gradient-to-b ${badgeColor}` : ''} ${isDemoUser ? `bg-gradient-to-b ${plan.demoBadgeColor} shadow-[0_0_20px_rgba(0,0,0,0.3)]` : ''}`}>
                {(isDemoUser || isHighlighted) && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                     <span className={`bg-gradient-to-r ${badgeColor} text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg whitespace-nowrap uppercase tracking-wider`}>
                       {badgeText}
                     </span>
                  </div>
                )}
                <div className={`relative bg-gray-950 backdrop-blur-sm rounded-[15px] h-full flex flex-col p-6 ${(!isCardHighlighted && !isDemoUser) ? 'border-2 border-purple-500/20' : ''} ${isDowngrade ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                  <div className="flex flex-col h-full">
                    <h3 className="text-2xl font-bold text-white mb-2">{planName}</h3>
                    <p className="text-sm text-gray-400 mb-6 min-h-[40px]">{translate(plan.descriptionKey)}</p>

                    <div className="mb-1 flex flex-col items-center justify-center">
                      <div className="border border-purple-500/30 rounded-xl px-6 py-3 bg-purple-500/5 min-w-[140px] text-center">
                        {isLoadingPrices && !fetchedPrices ? (
                          <div className="flex justify-center py-1">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                          </div>
                        ) : (
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={paymentMethod}
                              initial={{ opacity: 0, y: -20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 20 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="text-3xl sm:text-4xl font-bold text-white flex items-baseline justify-center"
                            >
                              <span>{displayPrice}</span>
                              <span className="text-lg sm:text-xl font-medium text-gray-400 ml-2">
                                {currencySuffix}
                              </span>
                            </motion.div>
                          </AnimatePresence>
                        )}
                      </div>

                      {/* --- MONIT O OSZCZĘDNOŚCI (Z ANIMACJĄ) --- */}
                      <div className="min-h-[32px] mt-2">
                        <AnimatePresence>
                          {paymentMethod === 'onetime' && currentLang === 'pl' && (() => {
                            const subStr = fetchedPrices?.[plan.roleName] || plan.pricePln;
                            const oneTimeStr = displayPrice;

                            const parsePrice = (str: string) => {
                              if (!str) return 0;
                              const cleaned = str.replace(/[^0-9.,]/g, '').replace(',', '.');
                              return parseFloat(cleaned) || 0;
                            };

                            const subVal = parsePrice(subStr);
                            const oneTimeVal = parsePrice(oneTimeStr);

                            if (subVal === 0 || oneTimeVal === 0) return null;

                            const savings = Math.round((oneTimeVal - subVal) * 12);

                            if (savings > 0) {
                              return (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.4, ease: "easeInOut" }}
                                  style={{ overflow: 'hidden' }}
                                  className="text-center"
                                >
                                  <span className="text-xs text-gray-400 whitespace-nowrap inline-block scale-90">
                                    {`Z subskrypcją oszczędzasz ${savings} zł rocznie. `}
                                    <button
                                      onClick={() => setPaymentMethod('subscription')}
                                      className="font-semibold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer uppercase"
                                    >
                                      SPRAWDŹ
                                    </button>
                                  </span>
                                </motion.div>
                              );
                            }
                            return null;
                          })()}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="mb-8 mt-auto">
                      <button
                          onClick={() => !isDowngrade && handleUpgradeClick(plan)}
                          disabled={!!isRedirecting || isDowngrade}
                          className={`w-full inline-flex justify-center items-center py-3 px-4 rounded-lg font-semibold text-sm transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            isDowngrade
                              ? 'bg-gray-800 text-gray-500 border border-gray-700'
                              : (isCardHighlighted || isDemoUser
                                  ? `bg-gradient-to-br ${badgeColor} text-white shadow-[0_10px_20px_rgba(139,92,246,0.20)] hover:shadow-[0_15px_25px_rgba(139,92,246,0.30)] hover:-translate-y-0.5`
                                  : 'bg-white/10 border border-white/10 hover:bg-white/20 text-white')
                          }`}
                        >
                          {isRedirecting === plan.roleName ? (
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          ) : null}

                          {isDowngrade
                              ? (currentLang === 'pl' ? 'Downgrade niemożliwy' : 'Downgrade unavailable')
                              : t.upgradeTo.replace('{planName}', planName)
                          }
                        </button>
                    </div>

                    <div className="flex-grow space-y-4">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{currentLang === 'pl' ? 'CO ZAWIERA:' : "WHAT'S INCLUDED:"}</div>
                        {plan.features.map((feature, index) => (
                          <div key={index} className="flex items-start mb-2.5">
                            <feature.icon className="w-5 h-5 text-indigo-400 mr-3 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-300 leading-relaxed">
                              {currentLang === 'pl' ? feature.textPl : feature.textEn}
                            </span>
                          </div>
                        ))}
                      </div>
                      {plan.limits && plan.limits.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-4">{currentLang === 'pl' ? 'LIMITY:' : 'LIMITS:'}</div>
                          {plan.limits.map((limit, index) => (
                            <div key={index} className="flex items-start mb-2.5">
                              <limit.icon className="w-5 h-5 text-gray-500 mr-3 flex-shrink-0 mt-0.5" />
                              <span className="text-sm text-gray-400 leading-relaxed">
                                {currentLang === 'pl' ? limit.textPl : limit.textEn}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 2. Karta: WHITE LABEL */}
          {!isDemoUser && (
            <div className="relative rounded-2xl p-px bg-gradient-to-b from-amber-400 to-orange-500 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                 <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg whitespace-nowrap uppercase tracking-wider">
                   {currentLang === 'pl' ? 'Własna Aplikacja' : 'Own Your App'}
                 </span>
              </div>
              <div className="relative bg-gray-950 backdrop-blur-sm rounded-[15px] h-full flex flex-col p-6">
                <div className="flex flex-col h-full">
                  <h3 className="text-2xl font-bold text-white mb-2">White Label</h3>
                  <p className="text-sm text-gray-400 mb-6 min-h-[40px]">
                    {currentLang === 'pl' ? 'Dla agencji i firm' : 'For agencies and businesses'}
                  </p>

                  <div className="mb-7 flex flex-col items-center justify-center">
                      <div className="border border-amber-500/30 rounded-xl px-6 py-3 bg-amber-500/5">
                        <div className="flex items-baseline justify-center">
                          <span className="text-lg sm:text-xl font-medium text-gray-400 mr-2">
                            {currentLang === 'pl' ? 'od' : 'from'}
                          </span>
                          <span className="text-3xl font-bold text-white">
                            10 000 $
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {currentLang === 'pl' ? '+ koszty utrzymania' : '+ maintenance costs'}
                      </div>
                  </div>

                  <div className="mb-8 mt-auto">
                    <button
                      onClick={() => alert(currentLang === 'pl' ? 'Skontaktuj się z nami: contact@inflee.app' : 'Contact us: contact@inflee.app')}
                      className="w-full inline-flex justify-center items-center py-3 px-4 rounded-lg font-semibold text-sm transition-all shadow-md cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-[0_10px_20px_rgba(245,158,11,0.20)] hover:-translate-y-0.5"
                    >
                      {currentLang === 'pl' ? 'Porozmawiajmy' : "Let's talk"}
                    </button>
                  </div>

                  <div className="flex-grow">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      {currentLang === 'pl' ? 'CO ZAWIERA:' : "WHAT'S INCLUDED:"}
                    </div>
                    <ul className="space-y-3">
                      {[
                        currentLang === 'pl' ? 'Twój własny branding' : 'Your own branding',
                        currentLang === 'pl' ? 'Twoja własna domena' : 'Your own domain',
                        currentLang === 'pl' ? 'Twój własny Meta Pixel / GTM' : 'Your own Meta Pixel / GTM',
                        currentLang === 'pl' ? 'Personalizacja E-booków' : 'E-book personalization',
                        currentLang === 'pl' ? 'Personalizacja Landing page' : 'Landing page personalization',
                        currentLang === 'pl' ? 'Wbudowane integracje' : 'Built-in integrations',
                        currentLang === 'pl' ? 'Swoboda wyboru modeli AI' : 'Freedom to choose AI models',
                        currentLang === 'pl' ? 'Możliwość odsprzedaży subskrypcji' : 'Ability to resell subscriptions',
                        currentLang === 'pl' ? 'Możliwość finansowania z dotacji' : 'Possibility of financing through grants'
                      ].map((feature, i) => (
                        <li key={i} className="flex items-start">
                          <Check className="w-5 h-5 text-amber-400 mr-3 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-300 leading-relaxed">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- PRZYCISK ANULOWANIA SUBSKRYPCJI --- */}
        {showPaymentManagement && !isDemoUser && !isOneTimePaid && (
          <div className="mt-8 pt-6 border-t border-gray-700/50">
            <button onClick={handleCancelClick} className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 hover:text-red-300 text-sm font-medium rounded-xl transition-all cursor-pointer flex items-center justify-center group">
              <AlertTriangle className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              {currentLang === 'pl' ? 'Anuluj subskrypcję' : 'Cancel subscription'}
            </button>
          </div>
        )}
      </div>

      <CancelConfirmationModal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleCancelConfirm}
        nextBillingDate={subscriptionData?.nextBillingDate}
        currentLang={currentLang}
        isLoading={isCanceling}
        currentPlanRole={currentPlanRole}
      />

      {showBillingHistory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowBillingHistory(false)} />

          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                {currentLang === 'pl' ? 'Historia płatności' : 'Billing History'}
              </h3>
              <button onClick={() => setShowBillingHistory(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-6">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                </div>
              ) : billingHistory.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-400">
                    {currentLang === 'pl' ? 'Brak historii płatności' : 'No billing history'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {billingHistory.map((invoice) => {
                    const date = new Date(invoice.date).toLocaleDateString(
                      currentLang === 'pl' ? 'pl-PL' : 'en-US',
                      { day: 'numeric', month: 'long', year: 'numeric' }
                    );
                    const amount = (invoice.amount / 100).toFixed(2);
                    const isPaid = invoice.status === 'paid';

                    return (
                      <div
                        key={invoice.id}
                        className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:bg-gray-800/70 transition-all"
                      >
                        {/* ZMIANA: flex-col na mobile, sm:flex-row na desktop */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">

                          {/* LEWA STRONA (TREŚĆ) */}
                          <div className="flex-1 w-full">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm text-gray-400">{date}</span>
                              <span
                                className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                  isPaid
                                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                    : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                }`}
                              >
                                {isPaid
                                  ? (currentLang === 'pl' ? 'Opłacona' : 'Paid')
                                  : (currentLang === 'pl' ? 'Oczekująca' : 'Pending')
                                }
                              </span>
                            </div>

                            <p className="text-white font-medium mb-1">
                              {amount} {invoice.currency}
                            </p>

                            {invoice.lines && invoice.lines.length > 0 && (
                              <div className="text-sm text-gray-400">
                                {invoice.lines.map((line: any, idx: number) => (
                                  <div key={idx}>{line.description}</div>
                                ))}
                              </div>
                            )}

                            {invoice.number && (
                              <p className="text-xs text-gray-500 mt-2">
                                {currentLang === 'pl' ? 'Numer' : 'Number'}: {invoice.number}
                              </p>
                            )}
                          </div>

                          {/* PRAWA STRONA / DÓŁ (PRZYCISKI) */}
                          {/* ZMIANA: Dodano border-t na mobile, paddingi i układ flex-row dla przycisków */}
                          <div className="flex flex-row sm:flex-col gap-3 sm:gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-gray-700 sm:border-0">
                            {invoice.pdfUrl && (
                              <a
                                href={invoice.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-2 sm:py-1.5 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-400 text-sm font-medium rounded-lg transition-all cursor-pointer"
                              >
                                <Download className="w-4 h-4" />
                                PDF
                              </a>
                            )}
                            {invoice.hostedUrl && (
                              <a
                                href={invoice.hostedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-2 sm:py-1.5 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-all cursor-pointer"
                              >
                                <ExternalLink className="w-4 h-4" />
                                {currentLang === 'pl' ? 'Pokaż' : 'View'}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}