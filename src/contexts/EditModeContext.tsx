// src/contexts/EditModeContext.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

// Rozszerzony interfejs dla kontekstu trybu edycji
interface EditModeContextType {
  isTextEditMode: boolean;                            // Czy tryb edycji tekstu jest aktywny
  pendingChanges: Record<string, string>;            // Zbiór oczekujących zmian tekstu
  pendingColorChange: string | null;                 // Oczekująca zmiana kolorystyki
  setTextEditMode: (isActive: boolean) => void;      // Przełączanie trybu edycji
  handleTextChange: (field: string, value: string) => void; // Obsługa zmiany tekstu
  handleColorChange: (color: string) => void;        // Obsługa zmiany kolorystyki
  hasPendingChanges: boolean;                        // Czy są jakieś oczekujące zmiany (tekst lub kolor)
  clearPendingChanges: () => void;                   // Czyszczenie wszystkich oczekujących zmian
  getPendingChangesCount: () => number;              // Ilość oczekujących zmian (tekst + kolor)
  getOriginalValue: (field: string) => string | undefined; // Pobieranie oryginalnej wartości pola
  getOriginalColor: () => string | undefined;        // Pobieranie oryginalnej kolorystyki
  saveAllChanges: (pageId: string, userCredentials?: {userId?: string, cognitoSub?: string}) => Promise<boolean>; // Zapisywanie wszystkich zmian
  isSaving: boolean;                                 // Czy trwa zapisywanie zmian
  saveError: string | null;                          // Błąd podczas zapisywania, jeśli wystąpił
  isFieldChanged: (fieldName: string) => boolean;    // Sprawdza czy konkretne pole ma niezapisane zmiany
  getCurrentValue: (fieldName: string) => string | undefined; // Zwraca bieżącą wartość pola z uwzględnieniem pendingChanges
  revertField: (fieldName: string) => void;          // Usuwa pojedyncze pole z pendingChanges (gdy user wrócił do oryginału)
}

// Inicjalizacja kontekstu z wartościami domyślnymi
const EditModeContext = createContext<EditModeContextType>({
  isTextEditMode: false,
  pendingChanges: {},
  pendingColorChange: null,
  setTextEditMode: () => {},
  handleTextChange: () => {},
  handleColorChange: () => {},
  hasPendingChanges: false,
  clearPendingChanges: () => {},
  getPendingChangesCount: () => 0,
  getOriginalValue: () => undefined,
  getOriginalColor: () => undefined,
  saveAllChanges: async () => false,
  isSaving: false,
  saveError: null,
  isFieldChanged: () => false,
  getCurrentValue: () => undefined,
  revertField: () => {},
});

// Hook do użycia kontekstu edycji
export const useEditMode = () => useContext(EditModeContext);

interface EditModeProviderProps {
  children: ReactNode;
  initialValues?: Record<string, string>; // Początkowe wartości pól
  initialColor?: string;                  // Początkowa kolorystyka
  autoEnableEditMode?: boolean;           // Czy automatycznie włączyć tryb edycji
  onToast?: (message: {type: 'success' | 'error', text: string}) => void; // Callback dla powiadomień
}

// ─── Helper: parsowanie fieldName na path do jsonb_set ───────────────────
// Konwencja:
//   - "hero.headline_l1"            → ["hero", "headline_l1"]
//   - "hero.barriers.0"             → ["hero", "barriers", 0]
//   - "benefits.items.2.title"      → ["benefits", "items", 2, "title"]
function parseFieldNameToPath(fieldName: string): Array<string | number> {
  return fieldName.split('.').map(p => {
    const num = Number(p);
    return Number.isInteger(num) && p !== '' ? num : p;
  });
}

/**
 * Provider kontekstu trybu edycji
 */
export const EditModeProvider: React.FC<EditModeProviderProps> = ({
  children,
  initialValues = {},
  initialColor,
  autoEnableEditMode = false,
  onToast
}) => {
  const [isTextEditMode, setTextEditMode] = useState(autoEnableEditMode);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [pendingColorChange, setPendingColorChange] = useState<string | null>(null);
  const [originalValues, setOriginalValues] = useState<Record<string, string>>(initialValues);
  const [originalColor, setOriginalColor] = useState<string | undefined>(initialColor);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (autoEnableEditMode) {
      setTextEditMode(true);
    }
  }, [autoEnableEditMode]);

  useEffect(() => {
    setOriginalValues(initialValues);
    setOriginalColor(initialColor);
  }, [initialValues, initialColor]);

  const handleTextChange = useCallback((field: string, value: string) => {
    if (originalValues[field] === value) {
      setPendingChanges(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    } else {
      setPendingChanges(prev => ({
        ...prev,
        [field]: value
      }));
    }
  }, [originalValues]);

  const handleColorChange = useCallback((color: string) => {
    if (color === originalColor) {
      setPendingColorChange(null);
    } else {
      setPendingColorChange(color);
    }
  }, [originalColor]);

  const hasPendingChanges = Object.keys(pendingChanges).length > 0 || pendingColorChange !== null;

  const clearPendingChanges = useCallback(() => {
    setPendingChanges({});
    setPendingColorChange(null);
  }, []);

  // ─── revertField — usuwa pojedyncze pole z pendingChanges ──────────────
  // Wywoływane przez EditableText gdy user wpisał z powrotem oryginalną
  // wartość po wcześniejszej modyfikacji. Bez tego pendingChanges trzymałby
  // martwą zmianę (taka sama jak baza), pole pokazywałoby badge "Edited"
  // mimo że faktycznie nic się nie zmieniło.
  const revertField = useCallback((fieldName: string) => {
    setPendingChanges(prev => {
      if (!(fieldName in prev)) return prev;
      const updated = { ...prev };
      delete updated[fieldName];
      return updated;
    });
  }, []);

  const getPendingChangesCount = useCallback(() => {
    return Object.keys(pendingChanges).length + (pendingColorChange !== null ? 1 : 0);
  }, [pendingChanges, pendingColorChange]);

  const getOriginalValue = useCallback((field: string) => {
    return originalValues[field];
  }, [originalValues]);

  const getCurrentValue = useCallback((field: string) => {
    if (pendingChanges.hasOwnProperty(field)) {
      return pendingChanges[field];
    }
    return originalValues[field];
  }, [pendingChanges, originalValues]);

  const getOriginalColor = useCallback(() => {
    return originalColor;
  }, [originalColor]);

  const isFieldChanged = useCallback((fieldName: string) => {
    return pendingChanges.hasOwnProperty(fieldName);
  }, [pendingChanges]);

  const updateOriginalValues = useCallback((newTextValues: Record<string, string>, newColor?: string) => {
    if (Object.keys(newTextValues).length > 0) {
      setOriginalValues(prev => ({
        ...prev,
        ...newTextValues
      }));
    }
    if (newColor !== undefined) {
      setOriginalColor(newColor);
    }
  }, []);

  // ─── Zapis wszystkich zmian ────────────────────────────────────────────
  // Konwencja fieldName:
  //   - z kropkami ("hero.headline_l1") → /api/pages/[id]/content (atomic jsonb_set)
  //   - bez kropek ("color", "status")  → /api/pages/[id] (page-level update)
  // Pendingi czyszczone TYLKO gdy wszystkie requesty się powiodły.
  const saveAllChanges = useCallback(async (
    pageId: string,
    userCredentials?: {userId?: string, cognitoSub?: string}
  ): Promise<boolean> => {
    if (!hasPendingChanges) return true;

    setIsSaving(true);
    setSaveError(null);

    try {
      const contentChanges: Array<{ path: Array<string | number>; value: string; fieldName: string }> = [];
      const pageLevelChanges: Record<string, string> = {};

      for (const [fieldName, value] of Object.entries(pendingChanges)) {
        if (fieldName.includes('.')) {
          contentChanges.push({
            path: parseFieldNameToPath(fieldName),
            value,
            fieldName,
          });
        } else {
          pageLevelChanges[fieldName] = value;
        }
      }

      if (pendingColorChange !== null) {
        pageLevelChanges.color = pendingColorChange;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (userCredentials?.userId) headers['X-User-Id'] = userCredentials.userId;
      if (userCredentials?.cognitoSub) headers['X-User-Cognito-Sub'] = userCredentials.cognitoSub;

      const contentRequests = contentChanges.map(async ({ path, value, fieldName }) => {
        const res = await fetch(`/api/pages/${pageId}/content`, {
          method: 'PATCH',
          headers,
          credentials: 'include',
          body: JSON.stringify({ path, value }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(`${fieldName}: ${err.error || `HTTP ${res.status}`}`);
        }
      });

      const pageLevelRequest = Object.keys(pageLevelChanges).length > 0
        ? fetch(`/api/pages/${pageId}`, {
            method: 'PATCH',
            headers,
            credentials: 'include',
            body: JSON.stringify(pageLevelChanges),
          }).then(async res => {
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(`page-level: ${err.error || `HTTP ${res.status}`}`);
            }
          })
        : Promise.resolve();

      await Promise.all([...contentRequests, pageLevelRequest]);

      updateOriginalValues(pendingChanges, pendingColorChange || undefined);
      clearPendingChanges();

      if (onToast) {
        onToast({
          type: 'success',
          text: 'Zmiany zostały zapisane',
        });
      }

      return true;
    } catch (error) {
      console.error('Błąd podczas zapisywania zmian:', error);
      const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd';
      setSaveError(errorMessage);

      if (onToast) {
        onToast({
          type: 'error',
          text: `Nie udało się zapisać zmian: ${errorMessage}`,
        });
      }

      return false;
    } finally {
      setIsSaving(false);
    }
  }, [pendingChanges, pendingColorChange, hasPendingChanges, clearPendingChanges, updateOriginalValues, onToast]);

  const contextValue: EditModeContextType = {
    isTextEditMode,
    pendingChanges,
    pendingColorChange,
    setTextEditMode,
    handleTextChange,
    handleColorChange,
    hasPendingChanges,
    clearPendingChanges,
    getPendingChangesCount,
    getOriginalValue,
    getOriginalColor,
    saveAllChanges,
    isSaving,
    saveError,
    isFieldChanged,
    getCurrentValue,
    revertField,
  };

  return (
    <EditModeContext.Provider value={contextValue}>
      {children}
    </EditModeContext.Provider>
  );
};

export default EditModeProvider;