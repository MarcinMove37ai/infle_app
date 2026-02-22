import React, { RefObject } from 'react';
import {
  FileText, Palette, Loader, Sparkles, Upload, ImageIcon,
  ChevronLeft, Download, BookOpen
} from 'lucide-react';
import { TocItem, EbookCoverData } from '../types';

interface Step4GraphicsProps {
  title: string;
  subtitle: string;
  tocItems: TocItem[];
  coverData: EbookCoverData | null;
  fileInputRef: RefObject<HTMLInputElement>;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  imageRefreshTimestamp: number;
  handleImagePreview: (imageUrl: string | undefined, title: string, downloadName?: string) => void;
  fetchCoverStatus: () => void;
  refreshImagesStatus: () => void;
  generateCover: (forceRegenerate: boolean, generatePdf: boolean) => void;
  isGeneratingCover: boolean;
  isGeneratingAllImages: boolean;
  uploadingCoverImage: boolean;
  handleOpenCoverFileDialog: () => void;
  handleOpenFileDialog: (chapterId: string) => void;
  isSaving: boolean;
  uploadingImageForChapter: string | null;
  handleGenerateAIImage: (chapterId: string, forceRegenerate: boolean) => void;
  completedChapterIds: string[];
  generatingAIImageForChapter: string | null;
  aiImageGenerationError: string | null;
  generatedImagesCount: number;
  totalImagesToGenerate: number;
  setStep: (step: number) => void;
  handleGenerateAllImages: () => void;
  handleExportEbook: () => void;
}

export const Step4Graphics: React.FC<Step4GraphicsProps> = ({
  title,
  subtitle,
  tocItems,
  coverData,
  fileInputRef,
  handleFileChange,
  imageRefreshTimestamp,
  handleImagePreview,
  fetchCoverStatus,
  refreshImagesStatus,
  generateCover,
  isGeneratingCover,
  isGeneratingAllImages,
  uploadingCoverImage,
  handleOpenCoverFileDialog,
  handleOpenFileDialog,
  isSaving,
  uploadingImageForChapter,
  handleGenerateAIImage,
  completedChapterIds,
  generatingAIImageForChapter,
  aiImageGenerationError,
  generatedImagesCount,
  totalImagesToGenerate,
  setStep,
  handleGenerateAllImages,
  handleExportEbook
}) => {
  return (
    <div className="sm:bg-white sm:rounded-xl sm:border sm:border-gray-200 sm:shadow-lg sm:overflow-hidden transition-all duration-300">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 sm:p-6 text-white">
        <div className="flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-medium pb-2 border-b border-blue-300 mb-3">Graphics and cover of the ebook</h2>
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
      <div className="p-4 md:p-6">

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-gray-800 flex items-center">
              <FileText size={16} className="mr-2 text-blue-500" />
              Graphics ({tocItems.filter(item => item.image_url).length + (coverData?.cover_url ? 1 : 0)}/{tocItems.length + 1})
            </div>
            <div className="bg-blue-50 px-3 py-1 rounded-full text-xs text-blue-700">
              {Math.round(((tocItems.filter(item => item.image_url).length + (coverData?.cover_url ? 1 : 0)) / (tocItems.length + 1)) * 100)}% completed
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${((tocItems.filter(item => item.image_url).length + (coverData?.cover_url ? 1 : 0)) / (tocItems.length + 1)) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">

          {/* COVER */}
          <div className="border-2 border-dashed border-gray-400 rounded-lg shadow-sm bg-gray-100 overflow-hidden h-full flex flex-col">
            <div className="bg-gray-200 px-3 py-2 border-b border-gray-300 flex items-center justify-between">
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                📖 COVER
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                coverData?.cover_url
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-300 text-gray-700'
              }`}>
                {coverData?.cover_url ? 'Ready ✓' : 'No cover'}
              </span>
            </div>

            <div className="p-3 flex-grow flex flex-col bg-gray-50">
              {/* Cover image — aspect-square container, 3:4 image letterboxed, rounded */}
              <div className="w-full flex-1 min-h-0 bg-gray-100 rounded-lg flex items-center justify-center mb-3 overflow-hidden">
                {coverData?.cover_url && coverData.cover_url.trim() ? (
                  <img
                    key={`cover-${imageRefreshTimestamp}`}
                    src={coverData.cover_url}
                    alt="Ebook cover"
                    className="object-contain h-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => handleImagePreview(
                      coverData.cover_url,
                      `Okładka - ${title}`,
                      `okladka_${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpg`
                    )}
                    onLoad={() => console.log('✅ Cover loaded successfully:', coverData.cover_url)}
                    onError={() => {
                      console.error('❌ Error loading cover:', coverData.cover_url);
                      setTimeout(() => fetchCoverStatus(), 2000);
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-500 text-sm p-4 text-center w-full h-full bg-gray-200">
                    <Palette size={32} className="text-gray-400 mb-2" />
                    <p>No cover</p>
                  </div>
                )}
              </div>

              {/* Buttons: Generate left, Upload right */}
              <div className="flex flex-col sm:flex-row gap-2 mt-auto">
                <button
                  onClick={() => generateCover(true, false)}
                  disabled={isGeneratingCover || isGeneratingAllImages || uploadingCoverImage}
                  className={`flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center text-sm ${
                    isGeneratingCover || isGeneratingAllImages || uploadingCoverImage
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                  }`}
                >
                  {isGeneratingCover ? (
                    <>
                      <Loader size={14} className="animate-spin mr-1.5" />
                      <span className="truncate">Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="mr-1.5 flex-shrink-0" />
                      <span className="truncate">{coverData?.cover_url ? 'Regenerate' : 'Generate with AI'}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleOpenCoverFileDialog}
                  disabled={isGeneratingCover || isGeneratingAllImages || uploadingCoverImage}
                  className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg transition-colors flex items-center justify-center text-sm ${
                    isGeneratingCover || isGeneratingAllImages || uploadingCoverImage
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  {uploadingCoverImage ? (
                    <>
                      <Loader size={14} className="animate-spin mr-1.5" />
                      <span className="truncate">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} className="mr-1.5 flex-shrink-0" />
                      <span className="truncate">Upload</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* CHAPTER GRAPHICS */}
          {tocItems.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-10 text-gray-500 border border-dashed border-gray-300 rounded-lg bg-gray-50">
              <BookOpen size={36} className="text-gray-400 mb-2" />
              <p>No chapters. Go back to step 2 to add chapters.</p>
            </div>
          ) : (
            tocItems.map((item, index) => (
              <div
                key={item.id}
                className="border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden h-full flex flex-col"
              >
                <div className="bg-gray-50 p-3 border-b border-gray-200 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    {(completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0)) ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        Content ✓
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        No content
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.image_url
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {item.image_url ? 'Graphic ✓' : 'No graphic'}
                    </span>
                  </div>

                  <div className="border-t border-gray-200 mb-2"></div>

                  <div className="flex items-baseline">
                    <div className="mr-2 min-w-6 h-6 w-6 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold shadow-sm text-xs flex-shrink-0" style={{transform: 'translateY(-1px)'}}>
                      {index + 1}
                    </div>
                    <h3 className="font-medium text-gray-800 text-sm break-words">{item.title}</h3>
                  </div>
                </div>

                <div className="p-3 flex-grow flex flex-col">
                  <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-3 border border-dashed border-gray-300 overflow-hidden">
                    {item.image_url ? (
                      <img
                        key={`${item.id}-${imageRefreshTimestamp}`}
                        src={item.image_url}
                        alt={`Illustration for the chapter: ${item.title}`}
                        className="object-cover w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => handleImagePreview(
                          item.image_url,
                          `Ilustracja Rozdziału ${index + 1}. - ${item.title}`,
                          `rozdzial_${index + 1}_${item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpg`
                        )}
                        onLoad={() => console.log(`✅ Image loaded: ${item.title}`)}
                        onError={() => {
                          console.error(`❌ Error loading image for ${item.title}:`, item.image_url);
                          setTimeout(() => refreshImagesStatus(), 2000);
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-500 text-sm p-4 text-center">
                        <ImageIcon size={32} className="text-gray-300 mb-2" />
                        <p>No graphic</p>
                      </div>
                    )}
                  </div>

                  {/* Buttons: Generate left, Upload right */}
                  <div className="flex flex-col sm:flex-row gap-2 mt-auto">
                    <button
                      onClick={() => handleGenerateAIImage(item.id, !!item.image_url)}
                      disabled={
                        !((completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0)))
                        || isSaving || generatingAIImageForChapter === item.id || isGeneratingAllImages || uploadingCoverImage
                      }
                      className={`flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center text-sm ${
                        !((completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0)))
                        || isSaving || generatingAIImageForChapter === item.id || isGeneratingAllImages || uploadingCoverImage
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                      }`}
                    >
                      {generatingAIImageForChapter === item.id ? (
                        <>
                          <Loader size={14} className="animate-spin mr-1.5 flex-shrink-0" />
                          <span className="truncate">Generating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} className="mr-1.5 flex-shrink-0" />
                          <span className="truncate">{item.image_url ? 'Regenerate' : 'Generate with AI'}</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleOpenFileDialog(item.id)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center text-sm cursor-pointer"
                      disabled={(isSaving && uploadingImageForChapter === item.id) || isGeneratingAllImages || uploadingCoverImage}
                    >
                      {isSaving && uploadingImageForChapter === item.id ? (
                        <>
                          <Loader size={14} className="animate-spin mr-1.5" />
                          <span className="truncate">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={14} className="mr-1.5 flex-shrink-0" />
                          <span className="truncate">Upload</span>
                        </>
                      )}
                    </button>
                  </div>

                  {aiImageGenerationError && generatingAIImageForChapter === item.id && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 p-1.5 rounded-md">
                      <span className="line-clamp-2">{aiImageGenerationError}</span>
                    </div>
                  )}

                  {!((completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0))) && (
                    <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-1.5 rounded-md">
                      <span className="line-clamp-2">First, add chapter content</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {isGeneratingAllImages && (
          <div className="mt-2 mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200 animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-blue-800 flex items-center">
                <Loader size={16} className="mr-2 animate-spin text-blue-600" />
                Generating graphics
              </h3>
              <span className="text-sm text-blue-600 font-medium">
                {generatedImagesCount}/{totalImagesToGenerate}
              </span>
            </div>
            <div className="w-full bg-white rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(generatedImagesCount / totalImagesToGenerate) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-blue-700 mt-2 truncate">
              {generatingAIImageForChapter &&
                `Currently generating: graphic for chapter "${
                  tocItems.find(item => item.id === generatingAIImageForChapter)?.title || 'unknown'
                }"`
              }
            </p>
          </div>
        )}

        <div className="mt-6 border-t border-gray-200 pt-4 px-4 sm:px-6 pb-4 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
          <button
            onClick={() => setStep(3)}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center sm:justify-start cursor-pointer"
            disabled={isSaving || isGeneratingAllImages || isGeneratingCover || uploadingCoverImage}
          >
            <ChevronLeft size={16} className="mr-1" />
            Content
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleGenerateAllImages}
              disabled={isGeneratingAllImages || isSaving || isGeneratingCover || uploadingCoverImage || !tocItems.some(item =>
                (completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0)) && !item.image_url
              )}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-lg flex items-center justify-center ${
                isGeneratingAllImages || isSaving || isGeneratingCover || uploadingCoverImage || !tocItems.some(item =>
                  (completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0)) && !item.image_url
                )
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-md cursor-pointer'
              } transition-all duration-200`}
            >
              {isGeneratingAllImages ? (
                <>
                  <Loader size={16} className="mr-2 animate-spin" />
                  {`Generating (${generatedImagesCount}/${totalImagesToGenerate})`}
                </>
              ) : (
                <>
                  <Sparkles size={16} className="mr-2" />
                  Generate missing graphics
                </>
              )}
            </button>

            <button
              onClick={handleExportEbook}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-white flex items-center justify-center bg-green-600 hover:bg-green-700 hover:shadow-md transition-all duration-200 cursor-pointer"
              disabled={isSaving || isGeneratingAllImages || isGeneratingCover || uploadingCoverImage}
            >
              {isSaving ? (
                <>
                  <Loader size={16} className="mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download size={16} className="mr-2" />
                  Download as PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};