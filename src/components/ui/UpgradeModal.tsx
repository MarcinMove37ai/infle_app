// src/components/ui/UpgradeModal.tsx
import React from 'react';
import { X, Check, CreditCard, FileText, AlertTriangle, Loader2 } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: any;
  currentLang: 'pl' | 'en';
  currentPlanRole: string;
  subscriptionData: any;
  onManageBilling: () => void;
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

  // Oblicz ile dni pozostało do końca okresu próbnego
  const daysRemaining = nextBillingDate
    ? Math.ceil((new Date(nextBillingDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={isLoading ? undefined : onClose} />

      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 mx-4">

        {/* Ikona ostrzeżenia */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>

        {/* Nagłówek */}
        <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-3">
          {currentLang === 'pl' ? 'Czy na pewno chcesz anulować?' : 'Are you sure you want to cancel?'}
        </h3>

        {/* Treść */}
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

          {/* Informacja dla free_ver - natychmiastowe skutki */}
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

          {/* Informacja dla płatnych ról - dostęp do końca okresu */}
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

        {/* Przyciski */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Przycisk główny - Zachowaj subskrypcję / okres próbny */}
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 px-4 bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" // <-- DODANE
          >
            {isFreeVer
              ? (currentLang === 'pl' ? 'Zachowuję Okres Próbny' : 'Continue Trial')
              : (currentLang === 'pl' ? 'Zachowaj subskrypcję' : 'Keep subscription')
            }
          </button>

          {/* Przycisk drugorzędny - Anuluj / Przejdź na Demo */}
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-3 px-4 bg-transparent border border-red-500/30 hover:bg-red-500/10 text-red-400 hover:text-red-300 font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer" // <-- DODANE
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
  // State dla modala anulowania
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false);
  const [isCanceling, setIsCanceling] = React.useState(false);

  // Ref do głównego kontenera modala
  const modalContainerRef = React.useRef<HTMLDivElement>(null);

  // Definicja planów dla modala
  const modalPlans = [
    {
      roleName: 'rookie',
      planKey: 'planRookie',
      descriptionKey: 'planDescriptionRookie',
      price: '29 zł',
      currencyKey: 'pricing.currencyPerMonth',
      featuresKeys: ['featureRookie1', 'featureRookie2', 'featureRookie3'],
      planPath: '/free'
    },
    {
      roleName: 'creator',
      planKey: 'planCreator',
      descriptionKey: 'planDescriptionCreator',
      price: '87 zł',
      currencyKey: 'pricing.currencyPerMonth',
      featuresKeys: ['featureCreator1', 'featureCreator2', 'featureCreator3'],
      planPath: '/crea',
      highlighted: true
    },
    {
      roleName: 'unlimited',
      planKey: 'planUnlimited',
      descriptionKey: 'planDescriptionUnlimited',
      price: '299 zł',
      currencyKey: 'pricing.currencyPerMonth',
      featuresKeys: ['featureUnlimited1', 'featureUnlimited2', 'featureUnlimited3'],
      planPath: '/inf'
    }
  ];

  const translate = (key: string, fallback: string = '') => (t as any)[key] || fallback || key;

  if (!(t as any)['pricing.currencyPerMonth']) {
    (t as any)['pricing.currencyPerMonth'] = currentLang === 'pl' ? '/ mies.' : '/ mo.';
  }

  // Funkcja otwierająca modal potwierdzenia
  const handleCancelClick = () => {
    // Zresetuj scroll głównego modala do góry
    if (modalContainerRef.current) {
      modalContainerRef.current.scrollTop = 0;
    }
    setShowCancelConfirm(true);
  };

  // Funkcja faktycznego anulowania
  const handleCancelConfirm = async () => {
    setIsCanceling(true);
    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
      });

      if (response.ok) {
        // Zamknij wszystkie modale i przeładuj
        setShowCancelConfirm(false);
        onClose(); // Zamknij UpgradeModal
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

  const getButton = (plan: typeof modalPlans[0], isCurrent: boolean) => {
    const planName = translate(plan.planKey);
    const targetUrl = `https://app.inflee.app/register${plan.planPath}?lang=${currentLang}`;

    if (isCurrent) {
      const disabledClass = `w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all opacity-50 cursor-not-allowed text-center ${
        plan.highlighted
          ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white'
          : (plan.roleName === 'unlimited' ? 'bg-gray-600 text-white' : 'bg-white/10 border border-white/10 text-white')
      }`;

      return <button disabled className={disabledClass}>{t.currentPlanBadge}</button>;
    }

    let buttonClass = '';
    if (plan.roleName === 'unlimited') {
      buttonClass = `w-full inline-flex justify-center items-center py-3 px-4 rounded-lg font-semibold text-sm transition-all shadow-md bg-gray-600 text-white hover:bg-gray-700 cursor-pointer`;
    } else {
      buttonClass = `w-full inline-flex justify-center items-center py-3 px-4 rounded-lg font-semibold text-sm transition-all shadow-md cursor-pointer ${
        plan.highlighted
          ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_10px_20px_rgba(139,92,246,0.20)] hover:shadow-[0_15px_25px_rgba(139,92,246,0.30)] hover:-translate-y-0.5'
          : 'bg-white/10 border border-white/10 hover:bg-white/20 text-white'
      }`;
    }

    return (
      <a href={targetUrl} target="_blank" rel="noopener noreferrer" className={buttonClass}>
        {t.upgradeTo.replace('{planName}', planName)}
      </a>
    );
  };

  if (!isOpen) return null;

  const showPaymentManagement = subscriptionData && subscriptionData.role !== 'free';
  const isDemoUser = subscriptionData?.role === 'demo';

  let paymentTypeLabel = null;
  let paymentTypeClass = '';

  if (subscriptionData?.subscriptionStatus === 'one_time_paid') {
      paymentTypeLabel = currentLang === 'pl' ? 'Płatność jednorazowa' : 'One-time payment';
      paymentTypeClass = 'bg-purple-500/20 text-purple-300 border border-purple-500/30'; // Ciemny motyw
  } else if (subscriptionData?.subscriptionStatus === 'active' || subscriptionData?.subscriptionStatus === 'trialing') {
      if (showPaymentManagement && !isDemoUser) {
          paymentTypeLabel = currentLang === 'pl' ? 'Subskrypcja' : 'Subscription';
          paymentTypeClass = 'bg-blue-500/20 text-blue-300 border border-blue-500/30'; // Ciemny motyw
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

      {/* Główny modal z zawartością - ukryty gdy showCancelConfirm jest true */}
      <div className={`relative bg-gray-900 bg-opacity-90 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl px-3 py-4 sm:p-6 md:p-8 max-w-6xl w-full my-8 text-white overflow-hidden ${
        showCancelConfirm ? 'hidden' : ''
      }`}>

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10">
          <X className="w-6 h-6" />
        </button>

        <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{t.upgradeModalTitle}</h2>
          <p className="mt-2 sm:mt-3 text-base sm:text-lg text-gray-400">{t.upgradeModalSubtitle}</p>
        </div>

        {/* --- PRZENIESIONA SEKCJA: Płatności --- */}
        {showPaymentManagement && (
          <div className="mb-6 sm:mb-8 py-4 sm:py-8 border-y border-gray-700/50">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:items-stretch">
              {/* Lewa kolumna: Info o planie */}
              <div className="flex flex-col h-full">
                 <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 sm:p-5 w-full h-full flex flex-col gap-0 justify-center">

                    {/* GÓRA: Badge i Nazwa Planu */}
                    <div>
                        {/* ZMIANA: Flex container dla badge'y */}
                        <div className="mb-2 flex flex-wrap gap-2">
                           <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-md uppercase tracking-wider">
                             {t.currentPlan}
                           </span>

                           {/* NOWY BADGE: Rodzaj płatności */}
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

                    {/* DÓŁ: Data i Cena - ukryte dla demo */}
                    {!isDemoUser && (
                      <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-700/50">
                          {/* Data odnowienia */}
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

                          {/* Cena */}
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

              {/* Prawa kolumna: Karta + Przycisk Historii */}
              <div className="flex flex-col h-full">
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 sm:p-5 w-full h-full flex flex-col gap-3 justify-center">

                  {isDemoUser ? (
                    /* Komunikat dla użytkownika DEMO */
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
                      {/* GÓRA: Nagłówek i Dane Karty */}
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

                      {/* DÓŁ: Przycisk Historii z linią podziału */}
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

        {/* Karty Planów */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-0">
          {modalPlans.map((plan) => {
            const isCurrent = plan.roleName === currentPlanRole || (plan.roleName === 'rookie' && currentPlanRole === 'free_ver');
            return (
              <div key={plan.roleName} className={`relative rounded-2xl p-0.5 ${plan.highlighted ? 'bg-gradient-to-b from-purple-500 to-indigo-500' : ''}`}>
                <div className={`relative bg-gray-950 backdrop-blur-sm rounded-[15px] h-full flex flex-col p-6 ${!plan.highlighted ? 'border-2 border-purple-500/20' : ''}`}>

                  {isCurrent && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg whitespace-nowrap">
                        {t.currentPlanBadge}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col h-full">
                    <h3 className="text-2xl font-bold text-white mb-2">{translate(plan.planKey)}</h3>
                    <p className="text-sm text-gray-400 mb-6 min-h-[40px]">{translate(plan.descriptionKey)}</p>

                    <div className="mb-6 flex flex-col items-center justify-center">
                      <div className="border border-purple-500/30 rounded-xl px-6 py-3">
                        <div className="text-4xl font-bold text-white flex items-baseline">
                          <span>{plan.price}</span>
                          <span className="text-xl font-medium text-gray-400 ml-2">{translate(plan.currencyKey)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-8 mt-auto">{getButton(plan, isCurrent)}</div>

                    <div className="flex-grow">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t.features}:</div>
                      {plan.featuresKeys.map((featureKey, index) => (
                        <div key={index} className="flex items-start mb-3">
                          <Check className="w-5 h-5 text-indigo-400 mr-3 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-300 leading-relaxed">{translate(featureKey)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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

      {/* Modal potwierdzenia anulowania - NA ZEWNĄTRZ głównego diva, ale wewnątrz kontenera */}
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