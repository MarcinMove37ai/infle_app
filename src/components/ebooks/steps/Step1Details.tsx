import React, { RefObject } from 'react';
import {
  X, Check, Loader, Save, Sparkles, ChevronRight, Upload
} from 'lucide-react';
import { ScrapedContent } from '../types';

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
  titleInputRef: RefObject<HTMLInputElement>;
  subtitleInputRef: RefObject<HTMLInputElement>;
  descriptionInputRef: RefObject<HTMLTextAreaElement>;
  pdfInputRef: RefObject<HTMLInputElement>;
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
  titleInputRef,
  subtitleInputRef,
  descriptionInputRef,
  pdfInputRef
}) => {
  // --- LOGIKA LIMITU ŹRÓDEŁ (Odtworzona z oryginału) ---
  const currentSourceCount = scrapedContent.length;
  let maxSources = Infinity;
  let roleName = "Unlimited"; // Domyślnie dla unlimited/god
  const role = String(userRole).toLowerCase();

  if (role === 'free' || role === 'free_ver' || role === 'rookie') {
    maxSources = 1;
    roleName = "Rookie";
  } else if (role === 'creator') {
    maxSources = 5;
    roleName = "Creator";
  }

  const isAtSourceLimit = currentSourceCount >= maxSources;

  return (
    <div className="sm:bg-white sm:rounded-xl sm:border sm:border-gray-200 sm:shadow-lg sm:overflow-hidden transition-all duration-300">

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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ebook Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g. The Complete Guide to Time Management"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 bg-white transition-all duration-200"
              disabled={isGeneratingToc || isSaving || isScrapingUrls}
              ref={titleInputRef}
            />
          </div>

          {/* Subtitle Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subtitle
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="E.g. Practical Methods and Tools"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 bg-white transition-all duration-200"
              disabled={isGeneratingToc || isSaving || isScrapingUrls}
              ref={subtitleInputRef}
            />
          </div>

          {/* Description Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description and guidelines
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the target audience, writing style, key topics to include..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 bg-white transition-all duration-200 resize-none"
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
          <div className="text-gray-700">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium text-gray-700">
                WWW Sources
                <span className="text-gray-400 font-normal ml-1">(optional)</span>
              </label>

              {/* Dynamic limit indicator */}
              {maxSources !== Infinity ? (
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  isAtSourceLimit ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  Sources: {currentSourceCount} / {maxSources} ({roleName} Plan)
                </span>
              ) : (
                scrapedContent.length > 0 && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    Fetched {scrapedContent.length} sources
                  </span>
                )
              )}
            </div>

            <div className="space-y-2">
              {urlInputs.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(index, e.target.value)}
                    placeholder="https://example.com/article"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                          title={isAtSourceLimit ? "You have reached the source limit for your plan" : "Approve"}
                          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                            isScrapingSingleUrl || isAtSourceLimit
                              ? 'bg-gray-400 text-white cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                          }`}
                      >
                          {isScrapingSingleUrl ? <Loader size={14} className="animate-spin" /> : 'Approve'}
                      </button>
                    )}

                    {url.trim() && scrapedContent.find(item => item.url === url) && (
                      <span className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg border border-green-200 flex items-center">
                        <Check size={14} className="mr-1" />
                        Added
                      </span>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                PDF Sources
                <span className="text-gray-400 font-normal ml-1">(optional, max 10MB)</span>
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
                className="flex items-center px-4 py-2 border border-dashed border-gray-300 rounded-lg transition-colors bg-white text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {isUploadingPdf ? (
                  <><Loader size={16} className="animate-spin mr-2" /> Processing...</>
                ) : (
                  <><Upload size={16} className="mr-2" /> Choose PDF file</>
                )}
              </button>
              <input type="file" ref={pdfInputRef} className="hidden" accept=".pdf,application/pdf" onChange={handlePdfUpload} />
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
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <button
          onClick={handleSaveDraft}
          disabled={!title.trim() || isGeneratingToc || isSaving || isScrapingUrls || isSavingDraft}
          className="w-full sm:w-auto flex items-center justify-center px-6 py-3 rounded-lg font-medium shadow-sm transition-all duration-200 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-200 disabled:cursor-not-allowed"
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
          className="w-full sm:w-auto flex items-center justify-center px-6 py-3 rounded-lg text-white font-medium shadow-md transition-all duration-200 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
    </div>
  );
};