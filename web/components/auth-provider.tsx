"use client";

import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { User, onIdTokenChanged, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { getFirebaseClient } from "@/lib/firebase-client";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  profile: Record<string, unknown> | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeAuthErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;

  if (message.includes("auth/configuration-not-found")) {
    return "Firebase Authentication が未初期化です。Firebase Console > Authentication で「始める」を実行し、Google プロバイダを有効化してください。";
  }

  if (message.includes("auth/operation-not-allowed")) {
    return "このログイン方式は無効です。Firebase Console で Google プロバイダを有効化してください。";
  }

  if (message.includes("auth/unauthorized-domain")) {
    return "このドメインは Firebase Authentication で許可されていません。Authentication > 設定 > 承認済みドメインを確認してください。";
  }

  if (message.includes("auth/admin-restricted-operation")) {
    return "この操作は管理者により制限されています。Authentication 設定でユーザー作成制限を確認してください。";
  }

  if (message.includes("auth/account-exists-with-different-credential")) {
    return "このメールアドレスは別のログイン方式で既に登録されています。既存の方式でログイン後に連携してください。";
  }

  if (message.includes("auth/app-not-authorized")) {
    return "Firebase のアプリ設定と API キー設定が一致していません。環境変数を確認してください。";
  }

  return message;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const timeoutId = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          setAuthError("接続エラーが発生しました。インターネット接続を確認して再読み込みしてください。");
        }
        return false;
      });
    }, 5000);

    try {
      const { auth } = getFirebaseClient();
      unsubscribe = onIdTokenChanged(
        auth,
        async (nextUser) => {
          setAuthError(null);

          if (!nextUser) {
            setUser(null);
            setToken(null);
            setLoading(false);
            clearTimeout(timeoutId);
            return;
          }

          try {
            const nextToken = await nextUser.getIdToken();
            setUser(nextUser);
            setToken(nextToken);
          } catch (error) {
            setUser(null);
            setToken(null);
            setAuthError(normalizeAuthErrorMessage(error, "Token acquisition failed."));
          } finally {
            setLoading(false);
            clearTimeout(timeoutId);
          }
        },
        (error) => {
          setUser(null);
          setToken(null);
          setLoading(false);
          setAuthError(normalizeAuthErrorMessage(error, "Authentication state listener failed."));
          clearTimeout(timeoutId);
        }
      );
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_CONFIG_MISSING") {
        setAuthError("Firebase認証の設定が不足しています。管理者に環境変数設定を確認してください。");
      } else {
        setAuthError(normalizeAuthErrorMessage(error, "Firebase client setup failed."));
      }
      setUser(null);
      setToken(null);
      setLoading(false);
      clearTimeout(timeoutId);
    }

    return () => {
      unsubscribe?.();
      clearTimeout(timeoutId);
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { auth, googleProvider } = getFirebaseClient();
    setAuthError(null);

    try {
      await signInWithPopup(auth, googleProvider);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google login failed.";
      const shouldFallbackToRedirect =
        message.includes("auth/popup-blocked") ||
        message.includes("auth/operation-not-supported-in-this-environment");

      if (shouldFallbackToRedirect) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      setAuthError(normalizeAuthErrorMessage(error, "Google login failed."));
      throw error;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    const { auth } = getFirebaseClient();
    await signOut(auth);
  }, []);

  const apiFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!token) {
        throw new Error("Not authenticated");
      }

      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);

      return fetch(input, {
        ...init,
        headers
      });
    },
    [token]
  );

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (e) {
      console.error("Failed to refresh profile:", e);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    if (token) {
      void refreshProfile();
    } else {
      setProfile(null);
    }
  }, [token, refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      authError,
      signInWithGoogle,
      signOutUser,
      apiFetch,
      profile,
      refreshProfile
    }),
    [apiFetch, authError, loading, signInWithGoogle, signOutUser, token, user, profile, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
