// src/components/ui/UpgradeModal.tsx
import React from 'react';
import { X, Check, CreditCard, FileText, AlertTriangle, Loader2, LucideIcon } from 'lucide-react';

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

// Modal potwierdzenia anulowania
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
            {currentLang === 'pl'
              ? 'Anulowanie subskrypcji spowoduje:'
              : 'Canceling your subscription will result in:'}
          </p>

          <ul className="space-y-2.5 text-gray-400 text-sm">
            <li className="flex items-center gap-3">
              <span className="text-red-400 flex-shrink-0">•</span>
              <span className="leading-relaxed">
                {currentLang === 'pl'
                  ? 'Utrata dostępu do funkcji AI'
                  : 'Loss of access to AI features'}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-red-400 flex-shrink-0">•</span>
              <span className="leading-relaxed">
                {currentLang === 'pl'
                  ? 'Strony Zapisu przestaną być publiczne'
                  : 'Landing Pages will no longer be public'}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-red-400 flex-shrink-0">•</span>
              <span className="leading-relaxed">
                {currentLang === 'pl'
                  ? 'Nowe Ledy nie będą się pojawiać'
                  : 'New Leads will stop appearing'}
              </span>
            </li>
          </ul>

          {isFreeVer && formattedDate && daysRemaining > 0 && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
              <p className="text-sm font-semibold text-red-300 mb-2">
                {currentLang === 'pl' ? '⚠️ Uwaga - Skutki natychmiastowe!' : '⚠️ Warning - Immediate effect!'}
              </p>
              <p className="text-xs text-gray-300 mb-2">
                {currentLang === 'pl'
                  ? `Pozostało Ci jeszcze ${daysRemaining} ${daysRemaining === 1 ? 'dzień' : 'dni'} darmowego okresu próbnego (do ${formattedDate}).`
                  : `You still have ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} of free trial period remaining (until ${formattedDate}).`
                }
              </p>
              <p className="text-xs text-red-300 font-medium">
                {currentLang === 'pl'
                  ? 'Po anulowaniu stracisz natychmiast dostęp do wszystkich funkcji planu Rookie i konto zostanie przełączone na wersję Darmową.'
                  : 'After cancellation, you will immediately lose access to all Rookie Plan features and your account will be switched to Free mode.'}
              </p>
            </div>
          )}

          {!isFreeVer && formattedDate && (
            <div className="mt-4 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">
                {currentLang === 'pl' ? 'Dostęp do:' : 'Access until:'}
              </p>
              <p className="text-white font-medium">{formattedDate}</p>
              <p className="text-xs text-gray-400 mt-1">
                {currentLang === 'pl'
                  ? 'Twoja subskrypcja pozostanie aktywna do końca okresu rozliczeniowego. Po tej dacie konto zostanie przełączone na wersję Demo.'
                  : 'Your subscription will remain active until the end of the billing period. After this date, your account will be switched to Demo version.'}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 px-4 bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isFreeVer
              ? (currentLang === 'pl' ? 'Zachowuję Okres Próbny' : 'Continue Trial')
              : (currentLang === 'pl' ? 'Zachowaj subskrypcję' : 'Keep subscription')
            }
          </button>

          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-3 px-4 bg-transparent border border-red-500/30 hover:bg-red-500/10 text-red-400 hover:text-red-300 font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin w-4 h-4 mr-2" />
                {currentLang === 'pl' ? 'Anulowanie...' : 'Canceling...'}
              </>
            ) : (
              isFreeVer
                ? (currentLang === 'pl' ? 'Rezygnuję z Okresu Próbnego' : 'Cancel Trial')
                : (currentLang === 'pl' ? 'Tak, anuluj' : 'Yes, cancel')
            )}
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

  const modalContainerRef = React.useRef<HTMLDivElement>(null);

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
      fetchPrices();
    }
  }, [isOpen, currentLang]);

  // --- DEFINICJA PLANÓW ---
  const allPlans = [
    {
      roleName: 'rookie',
      apiPlanName: 'rookie',
      planKey: 'planRookie',
      descriptionKey: 'planDescriptionRookie',
      pricePln: '0 zł', // FALLBACK
      priceUsd: '$0',   // FALLBACK
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
      pricePln: '0 zł', // FALLBACK
      priceUsd: '$0',   // FALLBACK
      currencyKey: 'pricing.currencyPerMonth',
      // highlighted: true, // ZOSTANIE NADPISANE DYNAMICZNIE
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
      pricePln: '0 zł', // FALLBACK
      priceUsd: '$0',   // FALLBACK
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
  const isDemoUser = subscriptionData?.role === 'demo';

  // --- HIERARCHIA RÓL ---
  // Używana do określania upgrade/downgrade i highlight
  const PLAN_ORDER = ['rookie', 'creator', 'unlimited'];

  // Normalizuj currentPlanRole: 'free_ver' -> 'rookie', inne -> bez zmian
  // Jeśli rola nie istnieje w tablicy (np. free), indexOf zwróci -1
  const normalizedCurrentRole = currentPlanRole === 'free_ver' ? 'rookie' : currentPlanRole;
  const currentPlanIndex = PLAN_ORDER.indexOf(normalizedCurrentRole);

  // --- LOGIKA FILTROWANIA PLANÓW ---
  let availablePlans = [];

  if (isDemoUser) {
    availablePlans = allPlans;
  } else {
    // Dla innych ról: Usuwamy aktualny plan i bierzemy 2 pozostałe
    availablePlans = allPlans.filter(plan => {
      // Usuwamy plan, który jest aktualnym planem
      if (plan.roleName === normalizedCurrentRole) return false;
      return true;
    }).slice(0, 2);
  }

  const translate = (key: string, fallback: string = '') => (t as any)[key] || fallback || key;

  if (!(t as any)['pricing.currencyPerMonth']) {
    (t as any)['pricing.currencyPerMonth'] = currentLang === 'pl' ? '/ mies.' : '/ mo.';
  }

  const handleCancelClick = () => {
    if (modalContainerRef.current) {
      modalContainerRef.current.scrollTop = 0;
    }
    setShowCancelConfirm(true);
  };

  const handleCancelConfirm = async () => {
    setIsCanceling(true);
    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
      });

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
    // ZMIANA: Usunięto blokadę 'alert' dla PL. Teraz wysyłamy locale: currentLang

    setIsRedirecting(plan.roleName);
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: plan.apiPlanName,
          locale: currentLang
        }),
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

        <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{t.upgradeModalTitle}</h2>
          <p className="mt-2 sm:mt-3 text-base sm:text-lg text-gray-400">{t.upgradeModalSubtitle}</p>
        </div>

        {/* --- SEKCJA GÓRNA: INFO O SUBSKRYPCJI --- */}
        {showPaymentManagement && (
          <div className="mb-6 sm:mb-8 py-4 sm:py-8 border-y border-gray-700/50">
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
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric'
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
                        ) : (
                          <div className="flex items-center space-x-2 text-gray-400">
                            <AlertTriangle className="w-5 h-5" />
                            <span className="text-sm">{t.paymentMethodPlaceholder}</span>
                          </div>
                        )}
                      </div>

                      {subscriptionData?.cardLast4 && (
                        <div className="w-full mt-4 pt-4 border-t border-gray-700/50 flex justify-end">
                          <button
                            onClick={onManageBilling}
                            className="flex items-center px-1 py-1 text-gray-400 hover:text-white text-sm font-medium transition-colors cursor-pointer"
                          >
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

        {/* --- SEKCJA ŚRODKOWA: KARTY PLANÓW --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-0">

          {/* 1. KARTY STANDARDOWE (Rookie, Creator, Unlimited) */}
          {availablePlans.map((plan) => {
            const planName = translate(plan.planKey);

            // Pobieranie cen
            const livePrice = fetchedPrices?.[plan.roleName];
            const fallbackPrice = currentLang === 'pl' ? plan.pricePln : plan.priceUsd;
            const displayPrice = livePrice || fallbackPrice;

            // --- NOWA LOGIKA HIGHLIGHT / DOWNGRADE (TYLKO DLA NIE-DEMO) ---
            let isHighlighted = false; // Domyślnie brak highlightu
            let isDowngrade = false;   // Domyślnie dostępny

            if (!isDemoUser) {
              const thisPlanIndex = PLAN_ORDER.indexOf(plan.roleName);
              // Wyjątek dla Free: next level to Rookie (0)
              // Jeśli currentPlanIndex = -1 (Free), to Rookie (0) jest next upgrade (0 == -1 + 1)
              if (thisPlanIndex === currentPlanIndex + 1) {
                isHighlighted = true; // Polecany (Next Step)
              }

              if (thisPlanIndex < currentPlanIndex) {
                isDowngrade = true; // Niższy plan
              }
            } else {
              // Dla Demo zachowujemy logikę ze statycznej definicji lub badge
              // (Ale tutaj nie używamy highlighted z allPlans, bo demo ma własne badge)
            }

            // Styl badge'a dla Demo (lub "Recommended" dla nie-demo)
            const badgeText = isDemoUser ? plan.demoBadge : (isHighlighted ? (currentLang === 'pl' ? 'Polecany' : 'Recommended') : null);
            const badgeColor = isDemoUser
                ? plan.demoBadgeColor
                : 'from-violet-500 to-fuchsia-500'; // Fiolet dla polecanego

            // Czy karta jest "wyróżniona" (fioletowa ramka)?
            // Dla demo: nie wyróżniamy ramką (mają badge). Dla nie-demo: jeśli isHighlighted.
            const isCardHighlighted = !isDemoUser && isHighlighted;

            return (
              <div key={plan.roleName} className={`relative rounded-2xl p-px ${isCardHighlighted ? `bg-gradient-to-b ${badgeColor}` : ''} ${isDemoUser ? `bg-gradient-to-b ${plan.demoBadgeColor} shadow-[0_0_20px_rgba(0,0,0,0.3)]` : ''}`}>

                {/* Badge (Dla Demo ZAWSZE, dla nie-demo tylko jeśli Highlighted) */}
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

                    <div className="mb-6 flex flex-col items-center justify-center">
                      <div className="border border-purple-500/30 rounded-xl px-6 py-3 bg-purple-500/5 min-w-[140px] text-center">

                        {isLoadingPrices && !fetchedPrices ? (
                           <div className="flex justify-center py-1">
                             <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                           </div>
                        ) : (
                           <div className="text-3xl sm:text-4xl font-bold text-white flex items-baseline justify-center">
                              <span>{displayPrice}</span>
                              <span className="text-lg sm:text-xl font-medium text-gray-400 ml-2">
                                {translate(plan.currencyKey)}
                              </span>
                           </div>
                        )}

                      </div>
                    </div>

                    <div className="mb-8 mt-auto">
                      <button
                        onClick={() => !isDowngrade && handleUpgradeClick(plan)}
                        disabled={!!isRedirecting || isDowngrade}
                        className={`w-full inline-flex justify-center items-center py-3 px-4 rounded-lg font-semibold text-sm transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDowngrade
                            ? 'bg-gray-800 text-gray-500 border border-gray-700' // Styl dla zablokowanego downgrade
                            : (isCardHighlighted || isDemoUser
                                ? `bg-gradient-to-br ${badgeColor} text-white shadow-[0_10px_20px_rgba(139,92,246,0.20)] hover:shadow-[0_15px_25px_rgba(139,92,246,0.30)] hover:-translate-y-0.5`
                                : 'bg-white/10 border border-white/10 hover:bg-white/20 text-white')
                        }`}
                      >
                        {isRedirecting === plan.roleName ? (
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : null}

                        {/* Tekst przycisku: Upgrade lub Downgrade Info */}
                        {isDowngrade
                            ? (currentLang === 'pl' ? 'Downgrade niemożliwy' : 'Downgrade unavailable')
                            : t.upgradeTo.replace('{planName}', planName)
                        }
                      </button>
                    </div>

                    <div className="flex-grow space-y-4">
                      {/* Główne Cechy */}
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

                      {/* Limity (jeśli są) */}
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

          {/* 2. Karta: WHITE LABEL (Tylko jeśli NIE jest Demo) */}
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

                  <div className="mb-6 flex flex-col items-center justify-center">
                    <div className="border border-amber-500/30 rounded-xl px-6 py-3 bg-amber-500/5">
                      <div className="text-center">
                        <div className="text-sm text-gray-400 mb-1">{currentLang === 'pl' ? 'od' : 'from'}</div>
                        <div className="text-3xl font-bold text-white">10 000 $</div>
                        <div className="text-xs text-gray-500 mt-1">{currentLang === 'pl' ? '+ koszty utrzymania' : '+ maintenance costs'}</div>
                      </div>
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
        {showPaymentManagement && !isDemoUser && (
          <div className="mt-8 pt-6 border-t border-gray-700/50">
            <button
              onClick={handleCancelClick}
              className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 hover:text-red-300 text-sm font-medium rounded-xl transition-all cursor-pointer flex items-center justify-center group"
            >
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
    </div>
  );
}