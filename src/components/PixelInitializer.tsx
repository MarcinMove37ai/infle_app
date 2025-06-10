'use client';

import { useEffect } from 'react';

export default function PixelInitializer() {
  useEffect(() => {
    // Inicjalizacja Facebook Pixel lub innych narzędzi śledzących
    console.log('Pixel zainicjalizowany');
  }, []);

  return null;
}