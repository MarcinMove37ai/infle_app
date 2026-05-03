// src/components/ui/ProfilePictureCropModal.tsx
//
// Modal kadrowania zdjęcia profilowego do okręgu.
// Użytkownik wybiera plik → otwiera się modal z react-easy-crop:
//   - kółko-overlay pokazuje obszar widoczny w headerze
//   - drag-pan pozwala ustawić co wpada w okrąg
//   - slider zoom (1x - 3x)
//   - "Anuluj" / "Zapisz"
// Po "Zapisz" modal canvas-uje wycięty kwadrat (256×256), zwraca jako File
// do parent'a. Parent wysyła do /api/user/profile-picture (PUT FormData).
//
// Server-side sharp też zrobi resize/cover na safe — ten modal generuje
// dokładnie kadr który user widzi.

"use client";

import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check } from 'lucide-react';

// Typ zwracany przez react-easy-crop w onCropComplete
interface CroppedAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  isOpen: boolean;
  imageSrc: string | null;        // data URL z FileReader (input[type=file])
  onCancel: () => void;
  onSave: (file: File) => void;   // wycięty plik 256×256 PNG
  language?: 'pl' | 'en';
}

const OUTPUT_SIZE = 256; // 256×256px output (renderowane jako rounded-full w UI)

// ─── Helper — wytnij obszar z imageSrc na canvas i zwróć Blob/File ──────
async function getCroppedFile(
  imageSrc: string,
  pixelCrop: CroppedAreaPixels,
): Promise<File> {
  // Załaduj obraz źródłowy
  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Image load failed'));
  });

  // Stwórz canvas o docelowym rozmiarze
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Wytnij i przeskaluj
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,  // source rect
    0, 0, OUTPUT_SIZE, OUTPUT_SIZE,                                 // target rect
  );

  // Konwersja canvas → Blob → File (PNG dla zachowania jakości)
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob failed'));
          return;
        }
        resolve(new File([blob], 'profile-picture.png', { type: 'image/png' }));
      },
      'image/png',
      0.95,
    );
  });
}

// ─── Komponent ─────────────────────────────────────────────────────────────

const ProfilePictureCropModal: React.FC<Props> = ({
  isOpen,
  imageSrc,
  onCancel,
  onSave,
  language = 'pl',
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedAreaPixels | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isEN = language === 'en';
  const t = {
    title:       isEN ? 'Adjust profile picture'                         : 'Dopasuj zdjęcie profilowe',
    description: isEN ? 'Drag to reposition. Use the slider to zoom in.' : 'Przeciągnij aby przesunąć. Suwakiem zmień powiększenie.',
    zoomLabel:   isEN ? 'Zoom'                                           : 'Powiększenie',
    cancel:      isEN ? 'Cancel'                                         : 'Anuluj',
    save:        isEN ? 'Save'                                           : 'Zapisz',
    saving:      isEN ? 'Saving...'                                      : 'Zapisywanie...',
  };

  const onCropComplete = useCallback(
    (_croppedArea: unknown, croppedPixels: CroppedAreaPixels) => {
      setCroppedAreaPixels(croppedPixels);
    },
    [],
  );

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels || isSaving) return;
    setIsSaving(true);
    try {
      const file = await getCroppedFile(imageSrc, croppedAreaPixels);
      onSave(file);
    } catch (err) {
      console.error('❌ Crop save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isSaving) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    onCancel();
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
          </div>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 -mr-1 cursor-pointer disabled:cursor-not-allowed"
            aria-label={t.cancel}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cropper area — kwadratowy kontener, react-easy-crop renderuje obraz pod overlay'em */}
        <div className="relative w-full bg-gray-900" style={{ aspectRatio: '1 / 1' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"        // ⭕ kółko-overlay
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-600 uppercase tracking-wide flex-shrink-0">
              {t.zoomLabel}
            </label>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.05}
              aria-labelledby="zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 cursor-pointer accent-blue-600"
              disabled={isSaving}
            />
            <span className="text-xs font-mono text-gray-500 w-10 text-right">
              {zoom.toFixed(1)}×
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 bg-gray-50">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !croppedAreaPixels}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t.saving}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {t.save}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePictureCropModal;