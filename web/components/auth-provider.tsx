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
import { User, onIdTokenChanged, signInWithPopup, signOut } from "firebase/auth";
import { getFirebaseClient } from "@/lib/firebase-client";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      const { auth } = getFirebaseClient();
      unsubscribe = onIdTokenChanged(auth, async (nextUser) => {
        setUser(nextUser);
        if (!nextUser) {
          setToken(null);
          setLoading(false);
          return;
        }

        const idToken = await nextUser.getIdToken();
        setToken(idToken);

        await fetch("/api/me", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`
          }
        });

        setLoading(false);
      });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Firebase client setup failed.");
      setLoading(false);
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const { auth, googleProvider } = getFirebaseClient();
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google login failed.");
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

      return fetch(input, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          Authorization: `Bearer ${token}`
        }
      });
    },
    [token]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      authError,
      signInWithGoogle,
      signOutUser,
      apiFetch
    }),
    [apiFetch, authError, loading, signInWithGoogle, signOutUser, token, user]
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
