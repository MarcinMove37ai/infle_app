// src/hooks/useReelSessionState.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Typy ────────────────────────────────────────────────────────────────────

export interface CoverParams {
  scale: number;
  positionX: number;
  positionY: number;
  seed: number | null;
}

export interface ReelModalState {
  reelIntro: string;
  reelCover: string;
  reelHeader: string;
  reelCTA: string;
  CTAtext: string;
  audioGender: "MALE" | "FEMALE" | null;
  coverParams: CoverParams;
}

const DEFAULT_STATE: ReelModalState = {
  reelIntro: "",
  reelCover: "",
  reelHeader: "",
  reelCTA: "download",
  CTAtext: "",
  audioGender: "MALE",
  coverParams: {
    scale: 1,
    positionX: 0,
    positionY: 0,
    seed: null,
  },
};

// ─── sessionStorage helpers ─────────────────────────────────────────────────

function getSessionKey(pageId: string) {
  return `reel_modal_${pageId}`;
}

function loadFromSession(pageId: string): Partial<ReelModalState> | null {
  try {
    const raw = sessionStorage.getItem(getSessionKey(pageId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveToSession(pageId: string, state: ReelModalState) {
  try {
    sessionStorage.setItem(getSessionKey(pageId), JSON.stringify(state));
  } catch (err) {
    console.warn("[useReelSessionState] sessionStorage write failed:", err);
  }
}

export function clearReelSession(pageId: string) {
  try {
    sessionStorage.removeItem(getSessionKey(pageId));
  } catch {}
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useReelSessionState(pageId: string | null) {
  const [state, setState] = useState<ReelModalState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const initialized = useRef(false);

  // ── 1. Inicjalizacja: session → DB fallback ──
  useEffect(() => {
    if (!pageId) return;
    initialized.current = false;

    const init = async () => {
      setIsLoading(true);

      // sessionStorage — szybki cache pól edytowalnych
      const cached = loadFromSession(pageId);
      if (cached) {
        console.log("[reel] Loaded editable fields from sessionStorage");
        setState((prev) => ({ ...prev, ...cached }));
      }

      // ZAWSZE pobierz z DB — reelIntro jest readonly, nie przechodzi przez formularz
      try {
        const res = await fetch(`/api/reel/${pageId}`);
        if (res.ok) {
          const data = await res.json();
          if (cached) {
            // Mamy cache — nadpisz tylko pola readonly z bazy
            setState((prev) => ({
              ...prev,
              reelIntro: data.reelIntro ?? "",
              reelCover: data.reelCover ?? "",
            }));
          } else {
            // Brak cache — załaduj cały stan z DB
            // Parsuj format "comment;HASŁO" z powrotem na dwa pola
            let parsedCTA = data.reelCTA ?? "";
            let parsedCTAtext = data.CTAtext ?? "";
            if (parsedCTA.startsWith("comment;")) {
              parsedCTAtext = parsedCTA.substring("comment;".length);
              parsedCTA = "comment";
            }

            const dbState: ReelModalState = {
              reelIntro: data.reelIntro ?? "",
              reelCover: data.reelCover ?? "",
              reelHeader: data.reelHeader ?? "",
              reelCTA: parsedCTA,
              CTAtext: parsedCTAtext,
              audioGender: data.audioGender ?? null,
              coverParams: data.coverParams ?? DEFAULT_STATE.coverParams,
            };
            setState(dbState);
            saveToSession(pageId, dbState);
          }
        } else if (res.status === 404 && !cached) {
          console.log("[reel] No existing reel, using defaults");
          setState(DEFAULT_STATE);
        }
      } catch (err) {
        console.error("[reel] Failed to load from DB:", err);
      }

      initialized.current = true;
      setIsLoading(false);
    };

    init();
  }, [pageId]);

  // ── 2. Auto-zapis do sessionStorage przy każdej zmianie ──
  useEffect(() => {
    if (!pageId || !initialized.current) return;
    saveToSession(pageId, state);
  }, [pageId, state]);

  // ── 3. Aktualizacja pojedynczego pola ──
  const updateField = useCallback(
    <K extends keyof ReelModalState>(field: K, value: ReelModalState[K]) => {
      setState((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // ── 4. Aktualizacja coverParams (częściowa) ──
  const updateCoverParams = useCallback(
    (partial: Partial<CoverParams>) => {
      setState((prev) => ({
        ...prev,
        coverParams: { ...prev.coverParams, ...partial },
      }));
    },
    []
  );

  // ── 5. Zapis do bazy danych (przy generowaniu lub zamknięciu) ──
  const saveToDB = useCallback(
    async () => {
      if (!pageId) return false;
      setIsSaving(true);

      try {
        // Sprawdź czy reel istnieje
        const checkRes = await fetch(`/api/reel/${pageId}`);
        const method = checkRes.ok ? "PUT" : "POST";

        const res = await fetch(`/api/reel/${pageId}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reelHeader: state.reelHeader || null,
            reelCTA: state.reelCTA === "comment" && state.CTAtext
              ? `comment;${state.CTAtext}`
              : state.reelCTA || null,
            CTAtext: state.CTAtext || null,
            audioGender: state.audioGender || "MALE",
            coverParams: state.coverParams,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        console.log(`[reel] ✅ Saved to DB via ${method}`);
        return true;
      } catch (err) {
        console.error("[reel] ❌ Save to DB failed:", err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [pageId, state]
  );

  // ── 6. Reset ──
  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
    if (pageId) clearReelSession(pageId);
  }, [pageId]);

  return {
    state,
    isLoading,
    isSaving,
    updateField,
    updateCoverParams,
    saveToDB,
    reset,
  };
}