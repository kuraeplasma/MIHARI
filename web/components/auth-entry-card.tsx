"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";

type Mode = "login" | "register";

export function AuthEntryCard({ mode }: { mode: Mode }) {
  const { user, loading, authError, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, router, user]);

  const title = mode === "login" ? "MIHARIにログイン" : "MIHARIアカウント登録";
  const buttonLabel = mode === "login" ? "Googleでログイン" : "Googleで新規登録";

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-card-copy">
          <p className="eyebrow">Web Monitoring Dashboard</p>
          <h1>{title}</h1>
          <p className="subtitle">
            顧客ごとの監視サイト、異常検知、フォームエラー、HTTP障害を1つの画面で運用できます。
          </p>
        </div>

        <div className="auth-layout">
          <div className="auth-form-panel">
            <div className="stack-sm">
              <label className="tiny-copy" htmlFor="email">
                メールアドレス
              </label>
              <input id="email" type="email" className="input" placeholder="name@company.jp" disabled />
            </div>
            <div className="stack-sm">
              <label className="tiny-copy" htmlFor="password">
                パスワード
              </label>
              <input id="password" type="password" className="input" placeholder="••••••••" disabled />
            </div>
            <button className="btn btn-muted auth-disabled-button" disabled>
              ログイン
            </button>
            <p className="tiny-copy">メール認証UIは準備済みです。現在の認証フローはGoogleログインを利用します。</p>
          </div>

          <div className="auth-divider" aria-hidden="true">
            <span />
            <p className="tiny-copy">or</p>
            <span />
          </div>

          <div className="auth-social-panel">
            {loading ? (
              <button className="btn btn-muted" disabled>
                Loading...
              </button>
            ) : (
              <button className="btn btn-primary auth-google-button" onClick={() => void signInWithGoogle()}>
                {buttonLabel}
              </button>
            )}
            <p className="tiny-copy">Google Workspace を利用して制作会社メンバーをそのままログインさせられます。</p>
          </div>
        </div>

        {authError && (
          <div className="stack-sm">
            <p className="error-text">{authError}</p>
            <p className="tiny-copy">Firebaseの環境変数を設定後に再読み込みしてください。</p>
          </div>
        )}

        <div className="auth-links">
          {mode === "login" ? (
            <Link href="/register" className="mono-link">
              新規登録はこちら
            </Link>
          ) : (
            <Link href="/login" className="mono-link">
              既存アカウントでログイン
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
