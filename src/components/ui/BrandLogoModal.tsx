'use client';

// src/components/ui/BrandLogoModal.tsx
//
// Modal kadrowania brand logo (prostokątny crop, nie kółko jak ProfilePictureCropModal).
//
// Cechy:
//   - 3 dostępne aspect ratios: 3:1 / 4:1 / 5:1 (segmented control)
//   - Default: 5:1 (najszersze — pasuje do text-only logos)
//   - Output: PNG zawsze (transparency support — brand logo często mają przeźroczyste tło)
//   - Wymiary output: 384×128 (3:1) | 512×128 (4:1) | 640×128 (5:1)
//   - Brak `cropShape='round'` — prostokątny preview
//
// Wzorzec analogiczny do ProfilePictureCropModal.tsx ale dla rectangular brand logo.

import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { Loader2, X, Crop as CropIcon } from 'lucide-react';

// ─── Stałe ────────────────────────────────────────────────────────────────

const ASPECT_OPTIONS = [
  { key: '3:1' as const, value: 3, outputWidth: 384, label: '3:1' },
  { key: '4:1' as const, value: 4, outputWidth: 512, label: '4:1' },
  { key: '5:1' as const, value: 5, outputWidth: 640, label: '5:1' },
];
const OUTPUT_HEIGHT = 128;
const DEFAULT_ASPECT_KEY = '5:1';

type AspectKey = typeof ASPECT_OPTIONS[number]['key'];

// ─── Translations ─────────────────────────────────────────────────────────

const translations = {
  pl: {
    title: 'Wgraj logo brandu',
    subtitle: 'Wybierz proporcje i przytnij logo',
    aspectLabel: 'Proporcje',
    cancel: 'Anuluj',
    save: 'Zapisz logo',
    saving: 'Zapisywanie...',
    aspectHint: 'Wybierz proporcje najlepiej pasujące do Twojego logo',
  },
  en: {
    title: 'Upload brand logo',
    subtitle: 'Choose aspect ratio and crop your logo',
    aspectLabel: 'Aspect ratio',
    cancel: 'Cancel',
    save: 'Save logo',
    saving: 'Saving...',
    aspectHint: 'Pick the aspect ratio that best fits your logo',
  },
};

// ─── Helper — utwórz blob z cropowanego obrazu ─────────────────────────────
// Używamy canvas API: rysujemy fragment original obrazu w nowym canvasie o wymiarach
// outputWidth × outputHeight, zachowując transparency (canvas domyślnie ma alpha channel).
async function getCroppedBlob(
  imageSrc: string,
  cropPixels: { x: number; y: number; width: number; height: number },
  outputWidth: number,
  outputHeight: number
): Promise<Blob> {
  const image = new window.Image();
  image.crossOrigin = 'anonymous';
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to load image'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  // Rysujemy cropowany fragment original obrazu, skalując do outputWidth × outputHeight
  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }
        resolve(blob);
      },
      'image/png',
      0.95
    );
  });
}

// ─── Props ────────────────────────────────────────────────────────────────

interface BrandLogoModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onCancel: () => void;
  onSave: (croppedFile: File) => void | Promise<void>;
  language?: 'pl' | 'en';
}

// ═══════════════════════════════════════════════════════════════════════════

export default function BrandLogoModal({
  isOpen,
  imageSrc,
  onCancel,
  onSave,
  language = 'pl',
}: BrandLogoModalProps) {
  const t = translations[language];

  const [aspectKey, setAspectKey] = useState<AspectKey>(DEFAULT_ASPECT_KEY);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentAspect = ASPECT_OPTIONS.find(opt => opt.key === aspectKey)!;

  // Reset cropu gdy zmieniamy aspect (Cropper sam to robi ale dla bezpieczeństwa)
  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }, [aspectKey]);

  // Reset całkowity gdy zamykamy modal
  useEffect(() => {
    if (!isOpen) {
      setAspectKey(DEFAULT_ASPECT_KEY);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setIsSaving(false);
    }
  }, [isOpen]);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels || isSaving) return;
    setIsSaving(true);
    try {
      const blob = await getCroppedBlob(
        imageSrc,
        croppedAreaPixels,
        currentAspect.outputWidth,
        OUTPUT_HEIGHT
      );
      const file = new File([blob], `brand-logo-${currentAspect.key}.png`, { type: 'image/png' });
      await onSave(file);
    } catch (error) {
      console.error('❌ Error saving brand logo:', error);
    } finally {
      setIsSaving(false);
    }
  }, [imageSrc, croppedAreaPixels, currentAspect, isSaving, onSave]);

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm cursor-pointer"
        onClick={!isSaving ? onCancel : undefined}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <CropIcon className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-base font-bold text-gray-900">{t.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            aria-label={t.cancel}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aspect ratio selector */}
        <div className="px-6 pt-4 pb-2">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">
            {t.aspectLabel}
          </label>
          <div className="flex gap-1.5" role="group" aria-label={t.aspectLabel}>
            {ASPECT_OPTIONS.map(opt => {
              const isActive = opt.key === aspectKey;
              return (
                <button
                  key={opt.key}
                  onClick={() => setAspectKey(opt.key)}
                  disabled={isSaving}
                  className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                    isActive
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-[0.65rem] text-gray-400 mt-1.5 italic">{t.aspectHint}</p>
        </div>

        {/* Cropper */}
        <div className="relative w-full h-[320px] bg-gray-100 overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={currentAspect.value}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
          />
        </div>

        {/* Zoom slider */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              disabled={isSaving}
              className="flex-1 accent-blue-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Zoom"
            />
            <span className="text-xs font-mono text-gray-500 w-10 text-right">{zoom.toFixed(1)}×</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !croppedAreaPixels}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.saving}
              </>
            ) : (
              t.save
            )}
          </button>
        </div>
      </div>
    </div>
  );
}