// src/components/ebooks/CoverVariantPickerModal.tsx
//
// Modal wyboru aktywnej okładki spośród wariantów (wygenerowanych + ewentualnego uploadu).
// Spójny z ChapterImageVariantPickerModal — model "1 + Generate more":
//   - grafika u góry (kontener 3:4), POD nią rząd przycisków (zawsze widoczne, desktop=mobile)
//   - kafelek AI:      [Select / Selected] [lupa]
//   - kafelek uploadu: [Select / Selected] [lupa] [change]
//   - aktywny: ramka 2px niebieska + plakietka "Your cover" + przycisk "Selected" (niebieski, disabled)
//   - kafelek "Upload your own" (pusty): TYLKO gdy uploadu jeszcze nie ma
//   - PASEK "Generate more" z licznikiem (N/limit) — dorabia kolejny wariant do limitu planu;
//     po wyczerpaniu limitu NIE znika, lecz zmienia się w komunikat kierujący do ustawień
//   - isLoading: szkielet zamiast siatki na czas dociągania puli (anty-blink 1→N)
//   - upload ZAWSZE na końcu (orderedVariants)
//
// Czysto prezentacyjny: dane i akcje przychodzą propsami z rodzica (EbookGeneratorModal).
// ZOOM jest WBUDOWANY (pełnoekranowy lightbox, max do rzutni, z "Select this cover").

"use client";

import React, { useState, useEffect } from 'react';
import { X, Check, Upload, ZoomIn, RefreshCw, ArrowLeft, Loader2, Plus, Info } from 'lucide-react';

export type CoverVariant = {
  url: string;
  prompt?: string;
  createdAt?: string;
  source?: string;
};

interface CoverVariantPickerModalProps {
  isOpen: boolean;
  variants: CoverVariant[];
  activeUrl?: string;
  userRole?: string | null | undefined;        // opcjonalny, nieużywany — upsell usunięty z modala
  variantLimit: number;                         // ile wariantów dozwolone na planie (getVariantLimit)
  cacheBust?: number;
  isLoading?: boolean;                          // dociąganie puli — szkielet zamiast siatki
  isSelecting?: boolean;
  isUploading?: boolean;
  isGenerating?: boolean;                       // trwa dogenerowanie kolejnego wariantu
  onSelect: (variantUrl: string) => void;
  onZoom?: (variantUrl: string) => void;        // opcjonalny, nieużywany — zoom wewnętrzny
  onUploadOwn: () => void;
  onGenerateMore: () => void;
  onUpgrade?: (targetRole: string) => void;     // opcjonalny, nieużywany — upsell usunięty z modala
  onClose: () => void;
}

const base = (u: string) => (u ? u.split('?')[0] : u);

export const CoverVariantPickerModal: React.FC<CoverVariantPickerModalProps> = ({
  isOpen,
  variants,
  activeUrl,
  variantLimit,
  cacheBust,
  isLoading = false,
  isSelecting = false,
  isUploading = false,
  isGenerating = false,
  onSelect,
  onUploadOwn,
  onGenerateMore,
  onClose,
}) => {
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  // Który wariant jest w trakcie wyboru — żeby spinner pokazał się tylko na klikniętym przycisku.
  const [selectingUrl, setSelectingUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setZoomUrl(null);
  }, [isOpen]);

  // Gdy rodzic skończy zapis wyboru (isSelecting → false), czyścimy lokalny wskaźnik spinnera.
  useEffect(() => {
    if (!isSelecting) setSelectingUrl(null);
  }, [isSelecting]);

  if (!isOpen) return null;

  const bust = cacheBust ?? 0;
  const withBust = (u: string) => `${base(u)}${bust ? `?t=${bust}` : ''}`;

  const hasUpload = variants.some((v) => v.source === 'uploaded');
  const zoomIsActive = !!zoomUrl && !!activeUrl && base(zoomUrl) === base(activeUrl);

  // "Generate more" liczy tylko warianty AI (uploadu nie wliczamy do limitu generacji).
  const generatedCount = variants.filter((v) => v.source !== 'uploaded').length;
  const canGenerateMore = generatedCount < variantLimit;

  // Kolejność wyświetlania: najpierw warianty AI ('generated'), upload ('uploaded') ZAWSZE na końcu.
  const orderedVariants = [...variants].sort((a, b) => {
    const au = a.source === 'uploaded' ? 1 : 0;
    const bu = b.source === 'uploaded' ? 1 : 0;
    return au - bu;
  });

  const handleSelect = (url: string) => {
    setSelectingUrl(url);
    onSelect(url);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">

        {/* Nagłówek */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Choose your cover</h3>
            <p className="text-sm text-gray-500 mt-1">You can change this anytime.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Siatka / szkielet */}
        <div className="px-5 py-5 overflow-y-auto">
          {isLoading ? (
            // Szkielet — placeholdery kafelków, żeby nie pokazywać niepełnej listy (anty-blink).
            <div className="grid gap-4 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fill, 160px)' }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col">
                  <div className="rounded-lg bg-gray-100 animate-pulse" style={{ aspectRatio: '3 / 4' }} />
                  <div className="flex items-stretch gap-1.5 mt-2">
                    <div className="flex-1 h-9 rounded-lg bg-gray-100 animate-pulse" />
                    <div className="w-9 h-9 rounded-lg bg-gray-100 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fill, 160px)' }}>

                {orderedVariants.map((v, idx) => {
                  const isActive = activeUrl && base(activeUrl) === base(v.url);
                  const isUploaded = v.source === 'uploaded';
                  const isSelectingThis = isSelecting && selectingUrl != null && base(selectingUrl) === base(v.url);
                  return (
                    <div key={`${base(v.url)}-${idx}`} className="flex flex-col">

                      {/* Grafika (3:4) */}
                      <div
                        className={`relative rounded-lg overflow-hidden bg-gray-100 transition-all ${
                          isActive ? 'border-2 border-blue-600' : 'border border-gray-200'
                        }`}
                        style={{ aspectRatio: '3 / 4' }}
                      >
                        <img
                          src={withBust(v.url)}
                          alt={isUploaded ? 'Uploaded cover' : `Cover variant ${idx + 1}`}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        {isActive ? (
                          <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-blue-600 text-white text-[11px] font-medium px-2 py-0.5 rounded-md shadow">
                            <Check size={12} /> Your cover
                          </span>
                        ) : isUploaded ? (
                          <span className="absolute top-2 left-2 bg-white/90 text-gray-700 text-[11px] font-medium px-2 py-0.5 rounded-md shadow-sm">
                            Your upload
                          </span>
                        ) : null}
                      </div>

                      {/* Przyciski pod grafiką: [Select / Selected] [lupa] (+[change] dla uploadu) */}
                      <div className="flex items-stretch gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => handleSelect(v.url)}
                          disabled={isSelecting || !!isActive}
                          className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-2 rounded-lg text-[13px] font-medium transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white cursor-default'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'
                          }`}
                        >
                          {isSelectingThis ? (
                            <><Loader2 size={15} className="animate-spin flex-shrink-0" /> Selecting…</>
                          ) : isActive ? (
                            <><Check size={15} className="flex-shrink-0" /> Selected</>
                          ) : 'Select'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setZoomUrl(v.url)}
                          aria-label="Zoom"
                          title="Zoom"
                          className="w-9 h-9 flex-shrink-0 inline-flex items-center justify-center rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-blue-600 cursor-pointer transition-colors active:scale-95"
                        >
                          <ZoomIn size={16} />
                        </button>

                        {isUploaded && (
                          <button
                            type="button"
                            onClick={onUploadOwn}
                            disabled={isUploading}
                            aria-label="Change"
                            title="Change"
                            className="w-9 h-9 flex-shrink-0 inline-flex items-center justify-center rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-blue-600 cursor-pointer transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isUploading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Upload własnej — pusty kafelek TYLKO gdy uploadu jeszcze nie ma (sama grafika-dropzone) */}
                {!hasUpload && (
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={onUploadOwn}
                      disabled={isUploading}
                      className={`relative rounded-lg overflow-hidden border border-dashed border-gray-400 flex flex-col items-center justify-center gap-2 p-2 text-center transition-colors ${
                        isUploading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 cursor-pointer'
                      }`}
                      style={{ aspectRatio: '3 / 4' }}
                    >
                      {isUploading ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} />}
                      <span className="text-xs px-1">{isUploading ? 'Uploading…' : 'Upload your own'}</span>
                    </button>
                  </div>
                )}

              </div>

              {/* Pasek "Generate more" — dorobienie kolejnego wariantu do limitu planu.
                  Po wyczerpaniu limitu NIE znika, lecz zmienia się w komunikat kierujący do ustawień. */}
              {canGenerateMore ? (
                <div className="mt-4 flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-dashed border-gray-300 bg-gray-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 text-gray-600">
                      <Plus size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-gray-900">Generate another option</p>
                      <p className="text-xs text-gray-500 mt-0.5">{generatedCount} of {variantLimit} used on your plan</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onGenerateMore}
                    disabled={isGenerating}
                    className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <><Loader2 size={15} className="animate-spin" /> Generating…</>
                    ) : (
                      <><Plus size={15} /> Generate more</>
                    )}
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex items-start gap-3 px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50">
                  <span className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 text-gray-500">
                    <Info size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-gray-900">You've reached the cover limit for this ebook</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Go to <span className="font-medium text-gray-700">Settings → Manage plan</span> to increase your generation limits.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Stopka */}
        <div className="flex items-center justify-end px-5 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* ZOOM — pełnoekranowy lightbox wbudowany w modal (maks do rzutni) */}
      {zoomUrl && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => setZoomUrl(null)}
              className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white cursor-pointer transition-colors"
            >
              <ArrowLeft size={16} /> Back to all
            </button>
            <button
              type="button"
              onClick={() => setZoomUrl(null)}
              aria-label="Close preview"
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
            >
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center px-4">
            <img
              src={withBust(zoomUrl)}
              alt="Cover preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          </div>

          <div className="flex items-center justify-center gap-2.5 px-4 py-4">
            <button
              type="button"
              onClick={() => setZoomUrl(null)}
              className="text-sm px-4 py-2 rounded-lg border border-white/30 text-white/90 hover:bg-white/10 cursor-pointer transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => { handleSelect(zoomUrl); setZoomUrl(null); }}
              disabled={isSelecting || zoomIsActive}
              className={`inline-flex items-center gap-1.5 text-sm font-medium px-5 py-2 rounded-lg transition-colors ${
                zoomIsActive
                  ? 'bg-white/20 text-white/70 cursor-default'
                  : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed'
              }`}
            >
              {isSelecting && !zoomIsActive ? (
                <><Loader2 size={16} className="animate-spin" /> Selecting…</>
              ) : (
                <><Check size={16} /> {zoomIsActive ? 'Current cover' : 'Select this cover'}</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};