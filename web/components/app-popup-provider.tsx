"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type PopupTone = "info" | "success" | "error";

interface PopupOptions {
  title?: string;
  tone?: PopupTone;
  durationMs?: number;
}

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PopupItem {
  id: number;
  title: string;
  message: string;
  tone: PopupTone;
  durationMs: number;
}

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

interface AppPopupContextValue {
  showPopup: (message: string, options?: PopupOptions) => void;
  confirmPopup: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

const AppPopupContext = createContext<AppPopupContextValue | null>(null);

const DEFAULT_TITLE = "お知らせ";

export function AppPopupProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<PopupItem[]>([]);
  const [current, setCurrent] = useState<PopupItem | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const timerRef = useRef<number | null>(null);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const closePopup = useCallback(() => {
    clearTimer();
    setCurrent(null);
  }, [clearTimer]);

  const showPopup = useCallback((message: string, options: PopupOptions = {}) => {
    const tone = options.tone ?? "info";
    const defaultDuration = tone === "error" ? 6500 : 4200;

    setQueue((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        title: options.title ?? DEFAULT_TITLE,
        message,
        tone,
        durationMs: options.durationMs ?? defaultDuration
      }
    ]);
  }, []);

  const confirmPopup = useCallback((message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
      }
      confirmResolverRef.current = resolve;
      setConfirmState({
        title: options.title ?? "確認",
        message,
        confirmLabel: options.confirmLabel ?? "OK",
        cancelLabel: options.cancelLabel ?? "キャンセル"
      });
    });
  }, []);

  const resolveConfirm = useCallback((value: boolean) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(value);
      confirmResolverRef.current = null;
    }
    setConfirmState(null);
  }, []);

  useEffect(() => {
    if (current || queue.length === 0) {
      return;
    }

    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }, [current, queue]);

  useEffect(() => {
    if (!current) {
      return;
    }

    clearTimer();
    if (current.durationMs > 0) {
      timerRef.current = window.setTimeout(() => {
        setCurrent(null);
      }, current.durationMs);
    }

    return clearTimer;
  }, [clearTimer, current]);

  useEffect(() => {
    return () => {
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
        confirmResolverRef.current = null;
      }
    };
  }, []);

  const value = useMemo<AppPopupContextValue>(() => ({ showPopup, confirmPopup }), [confirmPopup, showPopup]);

  return (
    <AppPopupContext.Provider value={value}>
      {children}
      {current && (
        <div className="app-popup-layer" role="status" aria-live="polite">
          <div className={`app-popup app-popup-${current.tone}`}>
            <div className="app-popup-head">
              <p className="app-popup-title">{current.title}</p>
              <button type="button" className="app-popup-close" onClick={closePopup} aria-label="閉じる">
                ×
              </button>
            </div>
            <p className="app-popup-message">{current.message}</p>
            <div className="app-popup-actions">
              <button type="button" className="app-popup-ok" onClick={closePopup}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmState && (
        <div className="app-popup-confirm-backdrop" role="presentation" onClick={() => resolveConfirm(false)}>
          <div
            className="app-popup app-popup-confirm"
            role="dialog"
            aria-modal="true"
            aria-label={confirmState.title}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="app-popup-head">
              <p className="app-popup-title">{confirmState.title}</p>
            </div>
            <p className="app-popup-message">{confirmState.message}</p>
            <div className="app-popup-actions app-popup-actions-confirm">
              <button type="button" className="app-popup-cancel" onClick={() => resolveConfirm(false)}>
                {confirmState.cancelLabel}
              </button>
              <button type="button" className="app-popup-ok" onClick={() => resolveConfirm(true)}>
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppPopupContext.Provider>
  );
}

export function useAppPopup(): AppPopupContextValue {
  const context = useContext(AppPopupContext);
  if (!context) {
    throw new Error("useAppPopup must be used within AppPopupProvider");
  }
  return context;
}
