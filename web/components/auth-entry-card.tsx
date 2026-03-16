"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword
} from "firebase/auth";
import { useAuth } from "@/components/auth-provider";
import { useAppPopup } from "@/components/app-popup-provider";
import { extractMissingAuthConfigKeys, getFirebaseClient } from "@/lib/firebase-client";

type Mode = "login" | "register";

function mapAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : "認証処理に失敗しました。";

  if (message.includes("auth/invalid-email")) return "メールアドレスの形式が正しくありません。";
  if (message.includes("auth/user-not-found")) return "このメールアドレスのアカウントは見つかりません。";
  if (message.includes("auth/wrong-password")) return "パスワードが正しくありません。";
  if (message.includes("auth/invalid-credential")) return "メールアドレスまたはパスワードが正しくありません。";
  if (message.includes("auth/configuration-not-found")) return "Firebase Authentication が未初期化です。Firebase Console > Authentication で「始める」を実行し、Google プロバイダを有効化してください。";
  if (message.includes("auth/operation-not-allowed")) return "Google ログインが無効です。Firebase Console で Google プロバイダを有効化してください。";
  if (message.includes("auth/unauthorized-domain")) return "このドメインは Firebase Authentication で許可されていません。Authentication > 設定 > 承認済みドメインを確認してください。";
  if (message.includes("auth/admin-restricted-operation")) return "この操作は管理者制限されています。Authentication 設定のユーザー作成制限を確認してください。";
  if (message.includes("auth/account-exists-with-different-credential")) return "このメールアドレスは別のログイン方式で既に登録されています。";
  if (message.includes("auth/app-not-authorized")) return "Firebase のアプリ設定または API キー設定が一致していません。";
  if (message.includes("auth/operation-not-supported-in-this-environment")) return "このブラウザ環境ではポップアップ認証が使えません。リダイレクトで再試行してください。";
  if (message.includes("auth/popup-blocked")) return "ポップアップがブロックされました。ブラウザのポップアップ許可後に再試行してください。";
  if (message.includes("auth/popup-closed-by-user")) return "Google ログインのポップアップが閉じられました。再度お試しください。";
  if (message.includes("auth/email-already-in-use")) return "このメールアドレスは既に使用されています。";
  if (message.includes("auth/weak-password")) return "パスワードは8文字以上で設定してください。";
  if (message.includes("auth/too-many-requests")) return "試行回数が多すぎます。しばらく待ってから再試行してください。";
  if (message.includes("AUTH_CONFIG_MISSING")) {
    const missingKeys = extractMissingAuthConfigKeys(message);
    if (missingKeys.length > 0) {
      return `認証設定が不足しています。不足キー: ${missingKeys.join(", ")}`;
    }
    return "認証設定が不足しています。管理者に環境設定を確認してください。";
  }

  return message;
}

export function AuthEntryCard({ mode }: { mode: Mode }) {
  const { user, loading, authError, signInWithGoogle } = useAuth();
  const { showPopup } = useAppPopup();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, router, user]);

  const handleEmailAuth = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setLocalError("メールアドレスを入力してください。");
      return;
    }

    if (!password) {
      setLocalError("パスワードを入力してください。");
      return;
    }

    if (mode === "register" && password.length < 8) {
      setLocalError("パスワードは8文字以上で入力してください。");
      return;
    }

    setSubmitting(true);
    try {
      const { auth } = getFirebaseClient();

      if (mode === "login") {
        await signInWithEmailAndPassword(auth, normalizedEmail, password);
      } else {
        await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      }

      router.replace("/dashboard");
    } catch (firebaseError) {
      setLocalError(mapAuthError(firebaseError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setLocalError("パスワード再設定にはメールアドレスの入力が必要です。");
      return;
    }

    try {
      const { auth } = getFirebaseClient();
      await sendPasswordResetEmail(auth, normalizedEmail);
      showPopup("パスワード再設定メールを送信しました。受信ボックスをご確認ください。", {
        title: "メール送信",
        tone: "success"
      });
    } catch (error) {
      setLocalError(mapAuthError(error));
    }
  };

  const handleGoogleAuth = async () => {
    setLocalError(null);
    try {
      await signInWithGoogle();
      router.replace("/dashboard");
    } catch (error) {
      setLocalError(mapAuthError(error));
    }
  };

  const displayError = localError ?? authError;
  const disabled = loading || submitting;
  const googleButtonLabel = mode === "register" ? "Google で新規登録" : "Google でサインイン";

  return (
    <div className="auth-page">
      <div className="auth-card animate-in">
        <div className="auth-logo">
          <img src="/logo_transparent.png" alt="MIHARI Logo" />
          <span className="auth-logo-text">MIHARI</span>
        </div>

        <div>
          <h1 className="auth-header-title">
            {mode === "login" ? "おかえりなさい。" : "はじめましょう。"}
          </h1>
          <p className="auth-header-sub">
            AI搭載のWebサイト監視プラットフォーム
          </p>
        </div>

        <button
          className="google-login-btn"
          onClick={() => void handleGoogleAuth()}
          disabled={disabled}
        >
          {loading ? (
            <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "rgba(255,255,255,0.7)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.25 17.64 11.943 17.64 9.2z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.964 10.705A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.705V4.963H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.037l3.007-2.332z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.963l3.007 2.332C4.672 5.168 6.656 3.58 9 3.58z" />
            </svg>
          )}
          <span>{googleButtonLabel}</span>
        </button>

        <div className="auth-divider">または</div>

        <form className="auth-form" onSubmit={(e) => void handleEmailAuth(e)}>
          <div className="auth-field">
            <label className="auth-label">メールアドレス</label>
            <input
              className="auth-input"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="auth-label">パスワード</label>
              <button
                type="button"
                onClick={() => void handleForgotPassword()}
                style={{ fontSize: "0.75rem", color: "var(--emerald)", fontWeight: 600, background: "transparent", border: "none", cursor: "pointer" }}
              >
                忘れた場合
              </button>
            </div>
            <input
              className="auth-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {displayError && (
            <p className="auth-error">{displayError}</p>
          )}

          <button type="submit" className="auth-submit" disabled={disabled}>
            {submitting ? "処理中..." : mode === "login" ? "ログイン" : "アカウント作成"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: "0.8125rem", color: "rgba(255,255,255,0.35)" }}>
          {mode === "login" ? (
            <>アカウントをお持ちでないですか？{" "}
              <Link href="/register" style={{ color: "var(--emerald)", fontWeight: 600 }}>
                無料登録
              </Link>
            </>
          ) : (
            <>登録済みの方は{" "}
              <Link href="/login" style={{ color: "var(--emerald)", fontWeight: 600 }}>
                こちらからログイン
              </Link>
            </>
          )}
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

