import React, { RefObject } from 'react';
import {
  X, Check, Loader, Save, Sparkles, ChevronRight, Upload, Lightbulb, Gem
} from 'lucide-react';
import { ScrapedContent } from '../types';
import { getChapterLimits } from '@/lib/chapterLimits';
import LimitBadge from '@/components/ui/LimitBadge';
import { getPlan } from '@/lib/planLimits';

interface Step1DetailsProps {
  title: string;
  setTitle: (value: string) => void;
  subtitle: string;
  setSubtitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  urlInputs: string[];
  handleUrlChange: (index: number, value: string) => void;
  scrapeSingleUrl: (url: string) => void;
  isScrapingSingleUrl: boolean;
  isScrapingUrls: boolean;
  scrapedContent: ScrapedContent[];
  handleRemoveScrapedContent: (item: ScrapedContent) => void;
  handlePdfUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleOpenPdfDialog: () => void;
  isUploadingPdf: boolean;
  isSaving: boolean;
  isSavingDraft: boolean;
  handleSaveDraft: () => void;
  isGeneratingToc: boolean;
  tocGenerated: boolean;
  changeStep: (step: number) => void;
  generateTableOfContents: () => void;
  userRole: string | null;
  isInitializing: boolean;
  seedSuggestions: { position: number; title: string; subtitle: string; description?: string }[];
  onInspireMe: () => void;
  // React 19: useRef<T>(null) zwraca RefObject<T | null>, wiec typ propa musi
  // dopuszczac null. Zachowanie w runtime bez zmian.
  titleInputRef: RefObject<HTMLInputElement | null>;
  subtitleInputRef: RefObject<HTMLInputElement | null>;
  descriptionInputRef: RefObject<HTMLTextAreaElement | null>;
  pdfInputRef: RefObject<HTMLInputElement | null>;
  highlightSources?: boolean;
  sourcesRef?: RefObject<HTMLDivElement | null>;
  onDismissHighlight?: () => void;
  sourcesSpotlightHidden?: boolean;
  toggleSourcesSpotlightHidden?: (checked: boolean) => void;
  bounceGenerate?: boolean;
  chapterCount: number;
  setChapterCount: (value: number) => void;
}

export const Step1Details: React.FC<Step1DetailsProps> = ({
  title,
  setTitle,
  subtitle,
  setSubtitle,
  description,
  setDescription,
  urlInputs,
  handleUrlChange,
  scrapeSingleUrl,
  isScrapingSingleUrl,
  isScrapingUrls,
  scrapedContent,
  handleRemoveScrapedContent,
  handlePdfUpload,
  handleOpenPdfDialog,
  isUploadingPdf,
  isSaving,
  isSavingDraft,
  handleSaveDraft,
  isGeneratingToc,
  tocGenerated,
  changeStep,
  generateTableOfContents,
  userRole,
  isInitializing,
  seedSuggestions,
  onInspireMe,
  titleInputRef,
  subtitleInputRef,
  descriptionInputRef,
  pdfInputRef,
  highlightSources = false,
  sourcesRef,
  onDismissHighlight,
  sourcesSpotlightHidden = false,
  toggleSourcesSpotlightHidden,
  bounceGenerate = false,
  chapterCount,
  setChapterCount,
}) => {
  // Limity rozdziałów — z tego samego źródła prawdy co route (getChapterLimits),
  // na bazie tej samej roli co limit źródeł.
  const chapterLimits = getChapterLimits(userRole);
  // Pole jest "z inspiracji", gdy jego wartość dokładnie odpowiada którejś propozycji.
  // Edycja (choćby jeden znak) zrywa równość → akcent znika sam, bez dodatkowego stanu.
  const titleFromSeed = seedSuggestions.some((s) => s.title === title && title.trim() !== '');
  const subtitleFromSeed = seedSuggestions.some((s) => s.subtitle === subtitle && subtitle.trim() !== '');
  const descriptionFromSeed = seedSuggestions.some((s) => (s.description || '') === description && description.trim() !== '');

  // --- LIMIT ŹRÓDEŁ ---
  // Limity i nazwy planów czytamy z planLimits.ts (jedno źródło prawdy),
  // zamiast trzymać je zaszyte w komponencie.
  const currentSourceCount = scrapedContent.length;
  const maxSources = getPlan(userRole).sources;
  const isAtSourceLimit = currentSourceCount >= maxSources;

  return (
    <div className="relative sm:bg-white sm:rounded-xl sm:border sm:border-gray-200 sm:shadow-lg sm:overflow-hidden transition-all duration-300">

      {/* Ciemna nakładka spotlightu źródeł — fixed na cały ekran, identyczna z pierwszym spotlightem.
          Sekcja źródeł jest renderowana ponad nią (z-[61]) i pozostaje ostra. */}
      {highlightSources && (
        <div className="fixed inset-0 z-[60] bg-[#0a0f1e]/75 backdrop-blur-sm transition-opacity duration-300" onClick={onDismissHighlight} />
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 sm:p-6 text-white">
        <h2 className="text-xl font-medium pb-2 border-b border-blue-300 mb-3">
          {tocGenerated ? 'Ebook data and sources' : "Let's create your ebook"}
        </h2>
        <p className="text-blue-200 mt-1 font-normal">
          {tocGenerated
            ? 'Here you can edit the basic data and sources used to generate the content.'
            : 'Start with a title and optional sources, and we will generate a table of contents for you.'}
        </p>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Title Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <label className="block text-sm font-medium text-gray-700">
                  Ebook Title *
                </label>
                {titleFromSeed && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600">
                    <Gem size={11} /> Suggested
                  </span>
                )}
              </div>
              {seedSuggestions.length > 0 && !tocGenerated && (
                <button
                  type="button"
                  onClick={onInspireMe}
                  className="inline-flex items-center gap-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                >
                  <Lightbulb size={14} />
                  Inspire me
                </button>
              )}
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g. The Complete Guide to Time Management"
              className={`w-full px-4 py-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 transition-all duration-200 ${
                titleFromSeed ? 'border border-indigo-300 bg-indigo-50/40' : 'border border-gray-300 bg-white'
              }`}
              disabled={isGeneratingToc || isSaving || isScrapingUrls}
              ref={titleInputRef}
            />
          </div>

          {/* Subtitle Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Subtitle
                <span className="text-gray-400 font-normal ml-1">(optional)</span>
              </label>
              {subtitleFromSeed && (
                <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600">
                  <Gem size={11} /> Suggested
                </span>
              )}
            </div>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="E.g. Practical Methods and Tools"
              className={`w-full px-4 py-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 transition-all duration-200 ${
                subtitleFromSeed ? 'border border-indigo-300 bg-indigo-50/40' : 'border border-gray-300 bg-white'
              }`}
              disabled={isGeneratingToc || isSaving || isScrapingUrls}
              ref={subtitleInputRef}
            />
          </div>

          {/* Description Section */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Description and guidelines
                <span className="text-gray-400 font-normal ml-1">(optional)</span>
              </label>
              {descriptionFromSeed && (
                <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600">
                  <Gem size={11} /> Suggested
                </span>
              )}
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the target audience, writing style, key topics to include..."
              className={`w-full px-4 py-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 transition-all duration-200 resize-none ${
                descriptionFromSeed ? 'border border-indigo-300 bg-indigo-50/40' : 'border border-gray-300 bg-white'
              }`}
              rows={4}
              disabled={isGeneratingToc || isSaving || isScrapingUrls}
              maxLength={1000}
              ref={descriptionInputRef}
            />
            <div className="text-xs text-gray-400 mt-1">
              {description.length}/1000 characters
            </div>
          </div>

          {/* Sources Section */}
          <div
            ref={sourcesRef}
            className={`text-gray-700 transition-all duration-300 ${
              highlightSources
                ? 'relative z-[61] rounded-xl border-2 border-indigo-500 p-4 ring-4 ring-indigo-500/15 bg-white'
                : 'border-t border-gray-200 pt-6'
            }`}
          >
            {/* Naglowek sekcji — limit dotyczy SUMY zrodel (WWW + PDF),
                wiec badge stoi nad kolumnami, a nie w ktorejkolwiek z nich. */}
            <div className="flex justify-between items-center mb-3 min-h-[26px]">
              <label className="text-sm font-medium text-gray-700">
                Sources
                <span className="text-gray-400 font-normal ml-1">(optional)</span>
              </label>

              {maxSources !== Infinity ? (
                <LimitBadge
                  aspect="sources"
                  current={currentSourceCount}
                  max={maxSources}
                  role={userRole}
                />
              ) : (
                scrapedContent.length > 0 && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    Fetched {scrapedContent.length} sources
                  </span>
                )
              )}
            </div>

            {/* WWW i PDF obok siebie — dwa rownorzedne sposoby dodania zrodla. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">

              {/* Kolumna 1 — zrodla WWW */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Website URL
                </label>

                <div className="space-y-2">
                  {urlInputs.map((url, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => handleUrlChange(index, e.target.value)}
                        placeholder="https://example.com/article"
                        className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isGeneratingToc || isSaving || isScrapingUrls || isScrapingSingleUrl || isAtSourceLimit}
                      />
                      {url.trim() && !scrapedContent.find(item => item.url === url) && (
                        <button
                          onClick={() => scrapeSingleUrl(url)}
                          disabled={
                            isInitializing ||
                            isGeneratingToc ||
                            isSaving ||
                            isScrapingUrls ||
                            isScrapingSingleUrl ||
                            isAtSourceLimit
                          }
                          title={isAtSourceLimit ? "You have reached the source limit for your plan" : ""}
                          className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors ${
                            isScrapingSingleUrl || isAtSourceLimit
                              ? 'bg-gray-400 text-white cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                          }`}
                        >
                          {isScrapingSingleUrl ? <Loader size={14} className="animate-spin" /> : 'Get content'}
                        </button>
                      )}

                      {url.trim() && scrapedContent.find(item => item.url === url) && (
                        <span className="flex-shrink-0 px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg border border-green-200 flex items-center">
                          <Check size={14} className="mr-1" />
                          Added
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Kolumna 2 — zrodla PDF */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  PDF file
                  <span className="font-normal text-gray-400 ml-1">(max 10MB)</span>
                </label>
                <button
                  onClick={handleOpenPdfDialog}
                  disabled={
                    isInitializing ||
                    isGeneratingToc ||
                    isSaving ||
                    isScrapingUrls ||
                    isScrapingSingleUrl ||
                    isUploadingPdf ||
                    isAtSourceLimit
                  }
                  title={isAtSourceLimit ? "You have reached the source limit for your plan" : "Choose PDF file"}
                  className="w-full flex items-center justify-center px-4 py-2 border border-dashed border-gray-300 rounded-lg transition-colors bg-white text-gray-700 hover:bg-gray-50 cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {isUploadingPdf ? (
                    <><Loader size={16} className="animate-spin mr-2" /> Processing...</>
                  ) : (
                    <><Upload size={16} className="mr-2" /> Choose PDF file</>
                  )}
                </button>
                <input type="file" ref={pdfInputRef} className="hidden" accept=".pdf,application/pdf" onChange={handlePdfUpload} />
              </div>

            </div>

            {scrapedContent.length > 0 && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Fetched sources:</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {scrapedContent.map((item, index) => (
                    <div key={index} className="text-xs bg-gray-50 p-2 rounded border relative">
                      <button
                        onClick={() => handleRemoveScrapedContent(item)}
                        className="absolute top-1 right-1 text-red-500 hover:text-red-700 p-1"
                        title="Remove source"
                      >
                        <X size={12} />
                      </button>
                      <div className="font-medium text-gray-800 truncate pr-6">{item.title}</div>
                      <div className="text-gray-500 truncate pr-6">{item.url}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {highlightSources && (
              <div className="mt-4 rounded-xl border border-gray-200 p-4 bg-white">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-md bg-indigo-100 flex items-center justify-center mt-0.5">
                    <Lightbulb size={16} className="text-indigo-600" />
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">Optionally, add your own sources</div>
                    <div className="text-[13px] text-gray-500 mt-0.5 leading-relaxed">
                      Enrich the context with your materials and real examples, your website, a blog post, or a PDF from your knowledge base.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onDismissHighlight}
                    aria-label="Dismiss"
                    className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="border-t border-gray-200 mt-3 pt-2.5 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-[13px] text-gray-500 select-none">
                    <input
                      type="checkbox"
                      checked={sourcesSpotlightHidden}
                      onChange={(e) => toggleSourcesSpotlightHidden?.(e.target.checked)}
                      className="w-4 h-4 cursor-pointer accent-indigo-700"
                    />
                    Don&apos;t show this again
                  </label>
                  <button
                    type="button"
                    onClick={onDismissHighlight}
                    className="inline-flex items-center gap-1.5 bg-indigo-700 hover:bg-indigo-800 text-white text-[13px] font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <Check size={14} /> Got it
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Liczba rozdzialow — wlasny blok, poza sekcja zrodel.
              Wczesniej siedzial wewnatrz sourcesRef i przygasal razem ze zrodlami
              przy spotlighcie, choc nie ma z nimi nic wspolnego. */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">Chapters</label>
              <LimitBadge
                aspect="chapters"
                current={chapterCount}
                max={chapterLimits.max}
                role={userRole}
              />
            </div>
            <input
              type="range"
              min={chapterLimits.min}
              max={chapterLimits.max}
              step={1}
              value={chapterCount}
              onChange={(e) => setChapterCount(Number(e.target.value))}
              disabled={isGeneratingToc || isSaving || isScrapingUrls}
              className="w-full accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-gray-400">{chapterLimits.min}</span>
              <span className="text-[11px] text-gray-400">{chapterLimits.max}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <button
          onClick={handleSaveDraft}
          disabled={!title.trim() || isGeneratingToc || isSaving || isScrapingUrls || isSavingDraft}
          className="w-full sm:w-auto flex items-center justify-center px-6 py-3 rounded-lg font-medium shadow-sm transition-all duration-200 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 cursor-pointer disabled:bg-gray-200 disabled:cursor-not-allowed"
        >
          {isSavingDraft ? (
            <><Loader size={20} className="animate-spin mr-3" /> Saving...</>
          ) : (
            <><Save size={20} className="mr-3" /> Save & Close</>
          )}
        </button>
        <button
          onClick={tocGenerated ? () => changeStep(2) : generateTableOfContents}
          disabled={!title.trim() || isGeneratingToc || isSaving || isScrapingUrls}
          className={`w-full sm:w-auto flex items-center justify-center px-6 py-3 rounded-lg text-white font-medium shadow-md transition-all duration-200 bg-blue-600 hover:bg-blue-700 cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed ${bounceGenerate ? 'animate-toc-bounce' : ''}`}
        >
          {isGeneratingToc ? (
            <><Loader size={20} className="animate-spin mr-3" /> Generating...</>
          ) : isScrapingUrls ? (
            <><Loader size={20} className="animate-spin mr-3" /> Fetching...</>
          ) : tocGenerated ? (
            <>Go to Table of Contents <ChevronRight size={20} className="ml-2" /></>
          ) : (
            <><Sparkles size={20} className="mr-3" /> Generate table of contents</>
          )}
        </button>
      </div>

      <style jsx>{`
        @keyframes tocBounce {
          0%, 100% { transform: translateY(0); }
          25% { transform: translateY(-8px); }
          50% { transform: translateY(0); }
          70% { transform: translateY(-4px); }
          85% { transform: translateY(0); }
        }
        :global(.animate-toc-bounce) {
          animation: tocBounce 0.9s ease-in-out;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25);
        }
      `}</style>
    </div>
  );
};