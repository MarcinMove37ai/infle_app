// Plik: src/hooks/useEbooksSSE.ts

import { useState, useEffect, useRef, useCallback } from 'react';

// ✅ USUNIĘTE: Interfejsy Ebook i Stats nie są już tu potrzebne

interface UseEbooksSSEReturn {
  connected: boolean;
  error: string | null;
  reconnect: () => void;
  updateTrigger: number;
}

export function useEbooksSSE(): UseEbooksSSEReturn {
  // ✅ USUNIĘTE: Stany ebooks, stats i loading
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    cleanup();
    const eventSource = new EventSource('/api/ebooks/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✅ SSE Connection opened');
      setConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
    };

    // ✅ UPROSZCZONE: Teraz każdy event 'ebooks-update' po prostu zwiększa trigger
    eventSource.addEventListener('ebooks-update', (event) => {
      const data = JSON.parse(event.data);
      console.log('📡 Received SSE signal:', data.type);
      setUpdateTrigger(prev => prev + 1);
    });

    eventSource.addEventListener('heartbeat', () => {
      console.log('💗 Heartbeat received');
    });

    eventSource.onerror = () => {
      console.error('❌ SSE Error');
      setConnected(false);
      const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
      reconnectAttemptsRef.current++;
      if (reconnectAttemptsRef.current <= 5) {
        setError(`Connection lost. Reconnecting in ${delay / 1000}s...`);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else {
        setError('Could not connect to the server.');
      }
    };
  }, [cleanup]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setError(null);
    connect();
  }, [connect]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  // ✅ ZWRACAMY TYLKO POTRZEBNE RZECZY
  return {
    connected,
    error,
    reconnect,
    updateTrigger,
  };
}