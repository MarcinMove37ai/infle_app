import React, { RefObject } from 'react';
import {
  BookOpen, Edit, Plus, ArrowUp, ArrowDown, X, Check, Loader,
  MoreVertical, Sparkles, ChevronRight
} from 'lucide-react';
import { TocItem } from '../types';
import LimitBadge from '@/components/ui/LimitBadge';
import { hasIntroAccess } from '@/lib/planLimits';
import { getChapterLimits } from '@/lib/chapterLimits';

interface Step2StructureProps {
  title: string;
  subtitle: string;
  tocItems: TocItem[];
  userRole: string | null;
  editingItemId: string | null;
  editingItemTitle: string;
  setEditingItemTitle: (value: string) => void;
  editItemInputRef: RefObject<HTMLInputElement | null>;
  handleKeyDown: (e: React.KeyboardEvent, action: () => void) => void;
  handleSaveEdit: () => void;
  isGeneratingContent: boolean;
  generatingChapterIds: string[];
  completedChapterIds: string[];
  currentGeneratingIndex: number;
  handleCancelEdit: () => void;
  handleContextMenu: (e: React.MouseEvent, id: string) => void;
  contextMenuVisible: string | null;
  handleMoveItem: (id: string, direction: 'up' | 'down') => void;
  isSaving: boolean;
  handleStartEditing: (item: TocItem) => void;
  handleRemoveItem: (id: string) => void;
  newItemTitle: string;
  setNewItemTitle: (value: string) => void;
  handleAddItem: () => void;
  newItemInputRef: RefObject<HTMLInputElement | null>;
  setStep: (step: number) => void;
  contentGenerated: boolean;
  changeStep: (step: number) => void;
  generateChaptersContent: () => void;
  /** Czy do ebooka ma zostac wygenerowany wstep (plan Business i wyzej). */
  includeIntro: boolean;
  setIncludeIntro: (value: boolean) => void;
}

export const Step2Structure: React.FC<Step2StructureProps> = ({
  title,
  subtitle,
  tocItems,
  userRole,
  editingItemId,
  editingItemTitle,
  setEditingItemTitle,
  editItemInputRef,
  handleKeyDown,
  handleSaveEdit,
  isGeneratingContent,
  generatingChapterIds,
  completedChapterIds,
  currentGeneratingIndex,
  handleCancelEdit,
  handleContextMenu,
  contextMenuVisible,
  handleMoveItem,
  isSaving,
  handleStartEditing,
  handleRemoveItem,
  newItemTitle,
  setNewItemTitle,
  handleAddItem,
  newItemInputRef,
  setStep,
  contentGenerated,
  changeStep,
  generateChaptersContent,
  includeIntro,
  setIncludeIntro
}) => {
  // --- LIMIT ROZDZIAŁÓW ---
  // Czytamy z chapterLimits.ts, tak samo jak suwak w kroku 1 i endpoint generate-toc.
  // Wczesniej byla tu wlasna kopia liczb (6/12) i nazw planow — trzecie miejsce do rozjechania.
  const currentChapterCount = tocItems.length;
  const maxChapters = getChapterLimits(userRole).max;
  const isAtChapterLimit = currentChapterCount >= maxChapters;

  return (
    <div className="sm:bg-white sm:rounded-xl sm:border sm:border-gray-200 sm:shadow-lg sm:overflow-hidden transition-all duration-300">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 sm:p-6 text-white">
        <div className="flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-medium pb-2 border-b border-blue-300 mb-3">Customize the ebook structure</h2>
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

      <div className="p-4 sm:p-6">
        {/* Wstep — funkcja planu Business i wyzej. Stoi nad rozdzialami,
            bo w gotowym ebooku pojawia sie przed nimi. */}
        {(() => {
          const introAvailable = hasIntroAccess(userRole);
          return (
            <div className="flex items-center justify-between gap-4 mb-5 pb-5 border-b border-gray-200">
              <label
                className={`flex items-center gap-2.5 min-w-0 ${
                  introAvailable ? 'cursor-pointer' : 'cursor-not-allowed'
                }`}
              >
                <input
                  type="checkbox"
                  checked={introAvailable && includeIntro}
                  onChange={(e) => setIncludeIntro(e.target.checked)}
                  disabled={!introAvailable}
                  className="w-4 h-4 flex-shrink-0 accent-indigo-700 cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="min-w-0">
                  <span className={`text-sm font-medium ${introAvailable ? 'text-gray-800' : 'text-gray-400'}`}>
                    Add an intro
                  </span>
                  <span className={`hidden sm:inline text-sm ml-1.5 ${introAvailable ? 'text-gray-400' : 'text-gray-300'}`}>
                    — a short opening written from your ebook structure
                  </span>
                </span>
              </label>

              <div className="flex-shrink-0">
                <LimitBadge
                  aspect="intro"
                  current={introAvailable ? 1 : 0}
                  max={1}
                  role={userRole}
                />
              </div>
            </div>
          );
        })()}

        <div className="mb-6">
          <div className="text-sm font-semibold text-gray-800 mb-3 flex items-center justify-between">
            <div className="flex items-center">
              <BookOpen size={16} className="mr-2 text-blue-500" />
              Chapters ({currentChapterCount})
            </div>

            <LimitBadge
              aspect="chapters"
              current={currentChapterCount}
              max={maxChapters}
              role={userRole}
            />
          </div>

          <div className="space-y-2 mb-4 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
            {tocItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                <BookOpen size={36} className="text-gray-400 mb-2" />
                <p>No chapters. Add the first chapter below.</p>
              </div>
            ) : (
              tocItems.map((item, index) => (
                <div
                  key={item.id}
                  data-chapter-id={item.id}
                  className={`relative flex items-center p-3 ${
                    editingItemId === item.id
                      ? 'bg-blue-50 border border-blue-300'
                      : 'bg-gray-50 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                  } rounded-lg group transition-all duration-200`}
                >
                  <div className="mr-3 text-gray-700 font-semibold w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                    {index + 1}
                  </div>

                  {editingItemId === item.id ? (
                    <div className="flex-grow mr-2">
                      <input
                        type="text"
                        value={editingItemTitle}
                        onChange={(e) => setEditingItemTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 bg-white"
                        onKeyDown={(e) => handleKeyDown(e, handleSaveEdit)}
                        ref={editItemInputRef}
                      />
                    </div>
                  ) : (
                    <div className="flex-grow mr-2 text-gray-800 font-medium break-words min-w-0">
                      {item.title}
                    </div>
                  )}

                  {!editingItemId && (
                    <div className="flex items-center sm:ml-auto ml-auto mt-1 mb-1 sm:mt-0 sm:mb-0 mr-2 flex-shrink-0">
                      {isGeneratingContent && (
                        <>
                          {generatingChapterIds.includes(item.id) ? (
                            <span className="text-blue-600 flex items-center">
                              <Loader size={14} className="animate-spin mr-1 sm:mr-1" />
                              <span className="text-xs whitespace-nowrap hidden sm:inline">Generating...</span>
                            </span>
                          ) :
                          completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0) ? (
                            <span className="text-green-600 flex items-center">
                              <Check size={14} className="mr-0 sm:mr-1" />
                              <span className="text-xs whitespace-nowrap hidden sm:inline">Ready</span>
                            </span>
                          ) :
                          currentGeneratingIndex < index && !completedChapterIds.includes(item.id) ? (
                            <span className="text-gray-500 hidden sm:flex items-center">
                              <span className="text-xs whitespace-nowrap">Waiting in queue...</span>
                            </span>
                          ) : null}
                        </>
                      )}

                      {!isGeneratingContent && (completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0)) && (
                        <span className="text-green-600 flex items-center">
                          <Check size={14} className="mr-0 sm:mr-1" />
                          <span className="text-xs whitespace-nowrap hidden sm:inline">Content added</span>
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex ml-auto flex-shrink-0">
                    {editingItemId === item.id ? (
                      <div className="flex space-x-1">
                        <button
                          onClick={handleSaveEdit}
                          className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-100 rounded-lg transition-colors cursor-pointer"
                          title="Save"
                          disabled={isSaving}
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                          title="Cancel"
                          disabled={isSaving}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          onClick={(e) => handleContextMenu(e, item.id)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors context-menu-button cursor-pointer"
                          disabled={isSaving}
                        >
                          <MoreVertical size={18} />
                        </button>

                        {contextMenuVisible === item.id && (
                          <div className="absolute right-0 top-8 w-40 bg-white rounded-lg shadow-xl border border-gray-200 z-[9999] animate-fadeIn context-menu cursor-pointer" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleMoveItem(item.id, 'up')}
                              disabled={index === 0 || isSaving}
                              className={`flex items-center w-full px-3 py-2 text-left text-sm ${
                                index === 0 || isSaving
                                  ? 'text-gray-400 cursor-not-allowed'
                                  : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer'
                              } transition-colors`}
                            >
                              <ArrowUp size={14} className="mr-2" />
                              Move up
                            </button>
                            <button
                              onClick={() => handleMoveItem(item.id, 'down')}
                              disabled={index === tocItems.length - 1 || isSaving}
                              className={`flex items-center w-full px-3 py-2 text-left text-sm ${
                                index === tocItems.length - 1 || isSaving
                                  ? 'text-gray-400 cursor-not-allowed'
                                  : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer'
                              } transition-colors`}
                            >
                              <ArrowDown size={14} className="mr-2" />
                              Move down
                            </button>
                            <button
                              onClick={() => handleStartEditing(item)}
                              disabled={isSaving}
                              className={`flex items-center w-full px-3 py-2 text-left text-sm ${
                                isSaving ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer'
                              } transition-colors`}
                            >
                              <Edit size={14} className="mr-2" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              disabled={isSaving}
                              className={`flex items-center w-full px-3 py-2 text-left text-sm ${
                                isSaving ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-red-50 hover:text-red-600 cursor-pointer'
                              } transition-colors rounded-b-lg`}
                            >
                              <X size={14} className="mr-2" />
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4">
            {!isAtChapterLimit ? (
              <div className="flex flex-col sm:flex-row rounded-lg overflow-hidden shadow-sm border border-gray-200 focus-within:border-blue-300 focus-within:ring-1 focus-within:ring-blue-300 transition-all duration-200 bg-white">
                <input
                  type="text"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  placeholder="New chapter title"
                  className="flex-grow px-4 py-3 text-gray-700 border-0 focus:ring-0 focus:outline-none"
                  onKeyDown={(e) => handleKeyDown(e, handleAddItem)}
                  ref={newItemInputRef}
                  disabled={isSaving || isAtChapterLimit}
                />
                <button
                  onClick={handleAddItem}
                  disabled={!newItemTitle.trim() || isSaving || isAtChapterLimit}
                  className={`flex items-center justify-center px-4 py-3 sm:py-2 ${
                    !newItemTitle.trim() || isSaving || isAtChapterLimit
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer'
                  } transition-colors`}
                >
                  {isSaving ? (
                    <Loader size={18} className="animate-spin mr-1" />
                  ) : (
                    <Plus size={18} className="mr-1" />
                  )}
                  Add
                </button>
              </div>
            ) : (
              <div className="p-3 text-center bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                You have reached the chapter limit ({maxChapters}) for your plan.
              </div>
            )}
          </div>
        </div>

        {isGeneratingContent && (
          <div className="mt-4 mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200 animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-blue-800 flex items-center">
                <Loader size={16} className="mr-2 animate-spin text-blue-600" />
                Generating content
              </h3>
              <span className="text-sm text-blue-600 font-medium">
                {completedChapterIds.length}/{tocItems.length}
              </span>
            </div>

            <div className="w-full bg-white rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(completedChapterIds.length / tocItems.length) * 100}%` }}
              ></div>
            </div>

            <p className="text-xs text-blue-700 mt-2 truncate">
              {generatingChapterIds.length > 0 &&
                `Currently generating: ${tocItems.find(item => generatingChapterIds.includes(item.id))?.title || 'chapter'}`
              }
            </p>
          </div>
        )}

        <div className="mt-8 border-t border-gray-200 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
          <button
            onClick={() => setStep(1)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center w-full sm:w-auto justify-center sm:justify-start cursor-pointer"
            disabled={isSaving}
          >
            <Edit size={16} className="mr-1" />
            Change data
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {contentGenerated ? (
              <button
                onClick={() => changeStep(3)}
                className="px-6 py-2.5 rounded-lg text-white flex items-center bg-blue-600 hover:bg-blue-700 hover:shadow-md transition-all duration-200 w-full sm:w-auto justify-center cursor-pointer"
                disabled={isSaving}
              >
                <BookOpen size={18} className="mr-2" />
                Go to content
                <ChevronRight size={16} className="ml-1" />
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                {tocItems.length < 3 && (
                  <div className="text-amber-600 text-sm flex items-center bg-amber-50 px-3 py-1.5 rounded-lg w-full sm:w-auto mb-2 sm:mb-0">
                    <BookOpen size={14} className="mr-1.5 flex-shrink-0" />
                    <span>The ebook should contain at least 3 chapters</span>
                  </div>
                )}

                <button
                  onClick={generateChaptersContent}
                  disabled={tocItems.length < 3 || isGeneratingContent || isSaving}
                  className={`px-6 py-2.5 rounded-lg text-white flex items-center justify-center transition-all duration-200 w-full ${
                    tocItems.length < 3 || isGeneratingContent || isSaving
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md cursor-pointer'
                  }`}
                >
                  {isGeneratingContent ? (
                    <>
                      <Loader size={18} className="mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} className="mr-2" />
                      {tocItems.length < 3
                        ? 'Add min. 3 chapters'
                        : 'Generate content'}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};