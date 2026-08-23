import React, { RefObject, useEffect } from 'react';
import {
  AlertCircle, Loader, Sparkles, FileText, Check, Edit, Save, X,
  ChevronLeft, ChevronRight, BookOpen, ImageIcon, Info
} from 'lucide-react';
import { TocItem } from '../types';

interface Step3ContentProps {
  title: string;
  subtitle: string;
  tocItems: TocItem[];
  chaptersWithoutContent: string[];
  setChaptersWithoutContent: (ids: string[]) => void;
  isGeneratingMissingContent: boolean;
  generateMissingContent: () => void;
  activeChapterId: string | null;
  setActiveChapterId: (id: string) => void;
  editingContent: boolean;
  isGeneratingContent: boolean;
  completedChapterIds: string[];
  generatingChapterIds: string[];
  handleGenerateChapterContent: (id: string) => void;
  isSaving: boolean;
  isGeneratingSingleChapter: boolean;
  chapterToRegenerate: string | null;
  handleStartEditingContent: (item: TocItem) => void;
  handleSaveEditedContent: () => void;
  handleCancelEditContent: () => void;
  editingChapterContent: string;
  setEditingChapterContent: (content: string) => void;
  contentEditRef: RefObject<HTMLTextAreaElement | null>;
  currentGeneratingIndex: number;
  setStep: (step: number) => void;
}

export const Step3Content: React.FC<Step3ContentProps> = ({
  title,
  subtitle,
  tocItems,
  chaptersWithoutContent,
  setChaptersWithoutContent,
  isGeneratingMissingContent,
  generateMissingContent,
  activeChapterId,
  setActiveChapterId,
  editingContent,
  isGeneratingContent,
  completedChapterIds,
  generatingChapterIds,
  handleGenerateChapterContent,
  isSaving,
  isGeneratingSingleChapter,
  chapterToRegenerate,
  handleStartEditingContent,
  handleSaveEditedContent,
  handleCancelEditContent,
  editingChapterContent,
  setEditingChapterContent,
  contentEditRef,
  currentGeneratingIndex,
  setStep
}) => {
  const activeChapter = tocItems.find(item => item.id === activeChapterId);
  const isIntroActive = activeChapterId === 'intro';

  // Zawsze cos ma byc wybrane. Pilnuje tego SAM komponent, a nie handlery
  // nawigacji — dzieki temu dziala niezaleznie od drogi wejscia do kroku 3
  // (przejscie z kroku 2, zakonczenie generowania, ponowne otwarcie szkicu).
  // Lapie tez przypadek, gdy wstep znika z listy po odznaczeniu checkboxa:
  // aktywne 'intro' przestaje istniec, wiec przeskakujemy na pierwszy rozdzial.
  useEffect(() => {
    if (tocItems.length === 0) return;
    const stillExists = tocItems.some(item => item.id === activeChapterId);
    if (!stillExists) {
      setActiveChapterId(tocItems[0].id);
    }
  }, [tocItems, activeChapterId, setActiveChapterId]);

  // Wstep moze, ale NIE MUSI byc na liscie — zalezy od planu i wyboru usera.
  // Dlatego numeracji nie da sie oprzec na stalym przesunieciu o jeden;
  // sprawdzamy faktyczna zawartosc listy.
  const hasIntroItem = tocItems.some(item => item.id === 'intro');
  const chapterCount = hasIntroItem ? tocItems.length - 1 : tocItems.length;

  // Helper do wyświetlania numeru lub ikony
  const renderChapterNumber = (item: TocItem, index: number) => {
    if (item.id === 'intro') {
      return <Info size={14} className="text-blue-600" />;
    }
    return <span>{hasIntroItem ? index : index + 1}</span>;
  };

  return (
    <div className="sm:bg-white sm:rounded-xl sm:border sm:border-gray-200 sm:shadow-lg sm:overflow-hidden transition-all duration-300 flex flex-col">
      {chaptersWithoutContent.length > 0 && (
        <div className="bg-yellow-50 border-b border-yellow-200 p-4 sm:rounded-t-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start sm:items-center">
              <AlertCircle size={20} className="text-yellow-600 mr-3 flex-shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <p className="text-yellow-800 font-medium">
                  {chaptersWithoutContent.length === 1
                    ? 'A new chapter without content has been detected'
                    : `Detected ${chaptersWithoutContent.length} chapters without content`}
                </p>
                <p className="text-yellow-700 text-sm">
                  Do you want to generate content for {chaptersWithoutContent.length === 1 ? 'this chapter' : 'these chapters'}?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 sm:mt-0">
              <button
                onClick={() => setChaptersWithoutContent([])}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                disabled={isGeneratingMissingContent}
              >
                Not now
              </button>
              <button
                onClick={generateMissingContent}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center cursor-pointer"
                disabled={isGeneratingMissingContent}
              >
                {isGeneratingMissingContent ? (
                  <>
                    <Loader size={14} className="mr-1.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} className="mr-1.5" />
                    Generate content
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Block */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 sm:p-6 text-white">
        <div className="flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-medium pb-2 border-b border-blue-300 mb-3">Customize the ebook content</h2>
            <p className="text-xl sm:text-2xl text-white mt-1 font-bold max-w-2xl line-clamp-3">
              {title}
            </p>
            {subtitle && (
              <p className="text-blue-200 mt-1 font-normal line-clamp-2">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Header Controls */}
      <div className="sm:hidden border-b border-gray-200 p-3 bg-blue-50">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            {isIntroActive ? (
               <Info size={16} className="mr-2 text-blue-500" />
            ) : (
               <FileText size={16} className="mr-2 text-blue-500" />
            )}
            <span className="text-sm font-medium text-gray-700">
              {isIntroActive
                ? 'Introduction'
                : `Chapter ${tocItems.findIndex(item => item.id === activeChapterId) + (hasIntroItem ? 0 : 1)} of ${chapterCount}`}
            </span>
          </div>

          {activeChapterId && activeChapter && !editingContent ? (
            <div className="flex items-center">
              {isGeneratingContent && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center mr-2">
                  <Loader size={10} className="animate-spin" />
                </span>
              )}

              {!(completedChapterIds.includes(activeChapterId) || (activeChapter.content && activeChapter.content.trim().length > 0)) ? (
                <button
                  onClick={() => handleGenerateChapterContent(activeChapterId)}
                  className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors flex items-center cursor-pointer"
                  disabled={isSaving || isGeneratingSingleChapter}
                >
                  {isGeneratingSingleChapter && (chapterToRegenerate === activeChapterId || (activeChapterId === 'intro' && generatingChapterIds.includes('intro'))) ? (
                    <>
                      <Loader size={12} className="animate-spin mr-1.5" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} className="mr-1.5" />
                      Generate
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => handleStartEditingContent(activeChapter)}
                  className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors flex items-center cursor-pointer"
                  disabled={isSaving || isGeneratingSingleChapter}
                >
                  <Edit size={12} className="mr-1.5" />
                  Edit
                </button>
              )}
            </div>
          ) : isGeneratingContent && (
            <div className="flex items-center">
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center">
                <Loader size={10} className="animate-spin" />
              </span>
            </div>
          )}
        </div>

        {editingContent && (
          <div className="flex justify-end space-x-2 mt-2">
            <button
              onClick={handleSaveEditedContent}
              className="px-3 py-1.5 text-xs bg-green-50 text-green-600 rounded-lg border border-green-200 hover:bg-green-100 transition-colors flex items-center cursor-pointer"
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader size={12} className="mr-1.5 animate-spin" />
              ) : (
                <Save size={12} className="mr-1.5" />
              )}
              Save
            </button>
            <button
              onClick={handleCancelEditContent}
              className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 transition-colors flex items-center cursor-pointer"
              disabled={isSaving}
            >
              <X size={12} className="mr-1.5" />
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Mobile Navigation */}
      <div className="sm:hidden flex justify-between items-center px-3 py-2 border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => {
            if (editingContent) return;
            const currentIndex = tocItems.findIndex(item => item.id === activeChapterId);
            if (currentIndex > 0) {
              setActiveChapterId(tocItems[currentIndex - 1].id);
            }
          }}
          disabled={editingContent || tocItems.findIndex(item => item.id === activeChapterId) <= 0}
          className={`flex items-center px-2 py-1.5 rounded-md ${
            editingContent || tocItems.findIndex(item => item.id === activeChapterId) <= 0
              ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
              : 'text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer'
          }`}
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center overflow-x-auto hide-scrollbar px-1 space-x-1 max-w-[80%]">
          {tocItems.map((item, index) => {
            let statusIcon = null;
            if (isGeneratingContent && generatingChapterIds.includes(item.id)) {
              statusIcon = <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                <Loader size={8} className="animate-spin text-blue-600" />
              </div>;
            } else if (isGeneratingContent && currentGeneratingIndex < index && !completedChapterIds.includes(item.id)) {
              statusIcon = <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              </div>;
            }

            return (
              <button
                key={item.id}
                onClick={() => !editingContent && setActiveChapterId(item.id)}
                disabled={editingContent}
                className={`relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  activeChapterId === item.id
                    ? 'bg-blue-600 text-white shadow-sm cursor-pointer'
                    : (completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0))
                      ? 'bg-green-100 text-green-800 border border-green-300 cursor-pointer'
                      : 'bg-gray-100 text-gray-700 border border-gray-300 cursor-pointer'
                } ${editingContent ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={item.title}
              >
                {renderChapterNumber(item, index)}
                {statusIcon}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => {
            if (editingContent) return;
            const currentIndex = tocItems.findIndex(item => item.id === activeChapterId);
            if (currentIndex < tocItems.length - 1) {
              setActiveChapterId(tocItems[currentIndex + 1].id);
            }
          }}
          disabled={editingContent || tocItems.findIndex(item => item.id === activeChapterId) >= tocItems.length - 1}
          className={`flex items-center px-2 py-1.5 rounded-md ${
            editingContent || tocItems.findIndex(item => item.id === activeChapterId) >= tocItems.length - 1
              ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
              : 'text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer'
          }`}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Main Content Area (Split View) */}
      <div className="flex" style={{ height: "500px", minHeight: "400px" }}>
        {/* Left Sidebar (Desktop) */}
        <div className="hidden sm:flex sm:flex-col w-1/4 border-r border-gray-200 bg-gray-50">
          <div className="p-3 bg-blue-50 font-medium border-b border-gray-200 text-gray-700 flex items-center justify-between">
            <div className="flex items-center">
              <FileText size={16} className="mr-2 text-blue-500" />
              Table of contents
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {tocItems.map((item, index) => (
              <div
                key={item.id}
                onClick={() => !editingContent && setActiveChapterId(item.id)}
                className={`p-3 ${!editingContent ? 'cursor-pointer hover:bg-blue-50' : 'cursor-not-allowed opacity-70'} border-b border-gray-200 transition-colors ${
                  activeChapterId === item.id
                    ? 'bg-blue-100 text-blue-800 font-medium'
                    : 'text-gray-700'
                }`}
              >
                <div className="flex items-center">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm text-xs font-semibold mr-2 flex-shrink-0 ${
                    item.id === 'intro' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-700'
                  }`}>
                    {renderChapterNumber(item, index)}
                  </span>
                  <span className="truncate">{item.title}</span>
                </div>

                <div className="flex items-center mt-1 ml-8">
                  {(completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0)) ? (
                    <span className="text-xs text-green-600 flex items-center">
                      <Check size={12} className="mr-1" />
                      Content ready
                    </span>
                  ) : isGeneratingContent && generatingChapterIds.includes(item.id) ? (
                    <span className="text-xs text-blue-600 flex items-center">
                      <Loader size={12} className="mr-1 animate-spin" />
                      Generating...
                    </span>
                  ) : isGeneratingContent && currentGeneratingIndex < index && !completedChapterIds.includes(item.id) ? (
                    <span className="text-xs text-gray-600 flex items-center">
                      <span className="w-2 h-2 bg-gray-300 rounded-full mr-1"></span>
                      Waiting in queue
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      No content
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Content Area */}
        <div className="w-full sm:w-3/4 flex flex-col bg-white">
          {activeChapterId && activeChapter ? (
            <>
              <div className="p-3 sm:p-4 border-b border-gray-200 bg-white">
                <h3 className="font-semibold text-gray-800 text-lg line-clamp-2">
                  {activeChapter.title}
                </h3>

                <div className="hidden sm:flex space-x-2 mt-2">
                  {!editingContent ? (
                    <>
                        {!(completedChapterIds.includes(activeChapterId) || (activeChapter.content && activeChapter.content.trim().length > 0)) && (
                          <button
                            onClick={() => handleGenerateChapterContent(activeChapterId)}
                            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center cursor-pointer"
                            disabled={isSaving || isGeneratingSingleChapter}
                          >
                          {isGeneratingSingleChapter && (chapterToRegenerate === activeChapterId || (activeChapterId === 'intro' && generatingChapterIds.includes('intro'))) ? (
                            <>
                              <Loader size={14} className="animate-spin mr-1.5" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} className="mr-1.5" />
                              Generate content
                            </>
                          )}
                        </button>
                      )}
                      {(completedChapterIds.includes(activeChapterId) || (activeChapter.content && activeChapter.content.trim().length > 0)) && (
                        <button
                          onClick={() => handleStartEditingContent(activeChapter)}
                          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center cursor-pointer"
                          disabled={isSaving || isGeneratingSingleChapter}
                        >
                          <Edit size={14} className="mr-1.5" />
                          Edit
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleSaveEditedContent}
                        className="px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors flex items-center cursor-pointer"
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <Loader size={14} className="mr-1.5 animate-spin" />
                        ) : (
                          <Save size={14} className="mr-1.5" />
                        )}
                        Save
                      </button>
                      <button
                        onClick={handleCancelEditContent}
                        className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center cursor-pointer"
                        disabled={isSaving}
                      >
                        <X size={14} className="mr-1.5" />
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
                {editingContent ? (
                  <textarea
                    value={editingChapterContent}
                    onChange={(e) => setEditingChapterContent(e.target.value)}
                    className="w-full h-full p-4 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-text"
                    placeholder={activeChapterId === 'intro' ? "Enter the intro content..." : "Enter the chapter content..."}
                    ref={contentEditRef}
                    disabled={isSaving}
                  />
                ) : (
                  <div className="text-gray-800 prose prose-blue max-w-none">
                    {isGeneratingSingleChapter && (chapterToRegenerate === activeChapterId || (activeChapterId === 'intro' && generatingChapterIds.includes('intro'))) ? (
                      <div className="flex flex-col items-center justify-center h-64">
                        <Loader size={48} className="text-blue-500 animate-spin mb-4" />
                        <p className="text-center text-gray-600">
                          Generating content for {activeChapterId === 'intro' ? 'the introduction' : 'the chapter'}...
                          <br />
                          This may take a few moments.
                        </p>
                      </div>
                    ) : activeChapter.content ? (
                      <div style={{ whiteSpace: 'pre-wrap' }}>
                        {activeChapter.content}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <BookOpen size={48} className="mb-4 text-gray-300" />
                        <p className="text-center">
                          This chapter does not have content yet.
                          <br />
                          Use the "Generate content" button to add content.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Select a chapter from the list.</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-gray-200 pt-4 px-4 sm:px-6 pb-4 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 mt-auto">
        <button
          onClick={() => setStep(2)}
          className={`w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg flex items-center justify-center sm:justify-start transition-colors ${
            editingContent
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-50 cursor-pointer'
          }`}
          disabled={isSaving || editingContent}
          title={editingContent ? "Finish editing content to go to the table of contents" : ""}
        >
          <ChevronLeft size={16} className="mr-1" />
          Table of contents
        </button>

        <button
          onClick={() => setStep(4)}
          className={`w-full sm:w-auto px-6 py-2.5 rounded-lg flex items-center justify-center transition-all duration-200 ${
            editingContent
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md cursor-pointer'
          }`}
          disabled={isSaving || editingContent}
          title={editingContent ? "Finish editing content to go to graphics and cover" : ""}
        >
          <ImageIcon size={16} className="mr-2" />
          Graphics and cover
        </button>
      </div>
    </div>
  );
};