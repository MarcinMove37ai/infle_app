import React, { useEffect, useRef } from 'react';
import { AlertCircle, Loader, X, Download, ImageIcon } from 'lucide-react';
import { TocItem } from '../types';

// --- Regenerate Popup ---
interface RegeneratePopupProps {
  subtitle: string;
  originalSubtitle: string;
  isGeneratingToc: boolean;
  handleRegenerateResponse: (regenerate: boolean) => void;
}

export const RegeneratePopup: React.FC<RegeneratePopupProps> = ({
  subtitle,
  originalSubtitle,
  isGeneratingToc,
  handleRegenerateResponse
}) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full animate-fadeIn">
      <div className="text-center mb-6">
        <AlertCircle size={40} className="text-blue-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-800 mb-2">Change of ebook title</h3>
        <p className="text-gray-600">
          {subtitle !== originalSubtitle
            ? 'The title or subtitle of the ebook has been changed, which may affect its content.'
            : 'The basic data of the ebook has been changed, which may affect its content.'}
          Do you want to generate a new proposal for the chapters?
        </p>
      </div>

      <div className="flex justify-center gap-3 mt-6">
        <button
          onClick={() => handleRegenerateResponse(false)}
          className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 cursor-pointer"
          disabled={isGeneratingToc}
        >
          NO
        </button>
        <button
          onClick={() => handleRegenerateResponse(true)}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 cursor-pointer"
          disabled={isGeneratingToc}
        >
          {isGeneratingToc ? (
            <>
              <Loader size={16} className="animate-spin mr-2 inline-block" />
              Generating...
            </>
          ) : (
            'YES'
          )}
        </button>
      </div>
    </div>
  </div>
);

// --- Chapter Regenerate Popup ---
interface ChapterRegeneratePopupProps {
  chapterToRegenerate: string | null;
  tocItems: TocItem[];
  originalChapterTitle: string;
  isGeneratingSingleChapter: boolean;
  handleChapterRegenerateResponse: (regenerate: boolean) => void;
}

export const ChapterRegeneratePopup: React.FC<ChapterRegeneratePopupProps> = ({
  chapterToRegenerate,
  tocItems,
  originalChapterTitle,
  isGeneratingSingleChapter,
  handleChapterRegenerateResponse
}) => {
  const chapter = tocItems.find(item => item.id === chapterToRegenerate);
  if (!chapter) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full animate-fadeIn">
        <div className="text-center mb-6">
          <AlertCircle size={40} className="text-blue-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-800 mb-2">Change of chapter title</h3>
          <p className="text-gray-600">
            The chapter title has been changed from "{originalChapterTitle}" to "{chapter.title}".
            Do you want to generate new content for this chapter?
          </p>
        </div>

        <div className="flex justify-center gap-3 mt-6">
          <button
            onClick={() => handleChapterRegenerateResponse(false)}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 cursor-pointer"
            disabled={isGeneratingSingleChapter}
          >
            NO
          </button>
          <button
            onClick={() => handleChapterRegenerateResponse(true)}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 cursor-pointer"
            disabled={isGeneratingSingleChapter}
          >
            {isGeneratingSingleChapter ? (
              <>
                <Loader size={16} className="animate-spin mr-2 inline-block" />
                Generating...
              </>
            ) : (
              'YES'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Prompt Preview Modal ---
interface PromptPreviewModalProps {
  chapterId: string;
  onClose: () => void;
  tocItems: TocItem[];
  chapterPrompts: Record<string, string>;
  handleRegenerateAIImageWithNewPrompt: (chapterId: string) => void;
  generatingAIImageForChapter: string | null;
  isGeneratingAllImages: boolean;
}

export const PromptPreviewModal: React.FC<PromptPreviewModalProps> = ({
  chapterId,
  onClose,
  tocItems,
  chapterPrompts,
  handleRegenerateAIImageWithNewPrompt,
  generatingAIImageForChapter,
  isGeneratingAllImages
}) => {
  const chapter = tocItems.find(item => item.id === chapterId);
  const prompt = chapterPrompts[chapterId];

  if (!chapter) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-gray-800">Prompt for the image</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            <X size={24} />
          </button>
        </div>

        <div className="mb-4">
          <h4 className="font-medium text-gray-700 mb-2">Chapter: {chapter.title}</h4>
          {prompt ? (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{prompt}</p>
              <div className="mt-2 text-xs text-gray-500">
                Length: {prompt.length}/400 characters
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-700">
                The prompt has not been generated yet. It will be created during the first image generation.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            Close
          </button>
          {prompt && (
            <button
              onClick={() => {
                handleRegenerateAIImageWithNewPrompt(chapterId);
                onClose();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
              disabled={generatingAIImageForChapter === chapterId || isGeneratingAllImages}
            >
              Regenerate with a new prompt
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Image Preview Modal ---
interface ImagePreviewModalProps {
  previewImage: string | null;
  previewImageTitle: string;
  previewImageName: string;
  handleClosePreview: () => void;
  handleDownloadAsPng: (url: string | null, name: string) => void;
  isConverting: boolean;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  previewImage,
  previewImageTitle,
  previewImageName,
  handleClosePreview,
  handleDownloadAsPng,
  isConverting
}) => {
  const previewModalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClosePreview();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (previewModalContentRef.current && !previewModalContentRef.current.contains(event.target as Node)) {
        handleClosePreview();
      }
    };

    if (previewImage) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [previewImage, handleClosePreview]);

  if (!previewImage) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div ref={previewModalContentRef} className="relative w-full max-w-7xl flex flex-col bg-black/50 rounded-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <ImageIcon className="h-5 w-5 text-white flex-shrink-0" />
            <h3 className="text-white font-medium truncate">{previewImageTitle}</h3>
          </div>
          <button
            onClick={handleClosePreview}
            className="text-white hover:text-gray-300 transition-colors flex-shrink-0 ml-4"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow flex-shrink-0 flex items-center justify-center p-4 overflow-hidden">
          <img
            src={previewImage}
            alt={previewImageTitle}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-center items-center p-4 flex-shrink-0 space-x-3">
          <button
            onClick={handleClosePreview}
            className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors font-medium"
          >
            Close
          </button>
          <button
            onClick={() => handleDownloadAsPng(previewImage, previewImageName)}
            disabled={isConverting}
            className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-colors ${
              isConverting
                ? "bg-gray-400 text-white cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
            title={`Download as PNG`}
          >
            {isConverting ? (
              <>
                <Loader size={18} className="animate-spin" />
                <span>Converting...</span>
              </>
            ) : (
              <>
                <Download size={18} />
                <span>Download</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};