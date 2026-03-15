interface FirebaseLikeError {
  code?: string | number;
  details?: string;
  message?: string;
}

function normalizeCode(code: string | number | undefined): string {
  if (typeof code === "number") {
    return String(code);
  }
  return code ?? "";
}

export function resolveApiError(error: unknown, fallback: string): { status: number; message: string } {
  if (!(error instanceof Error)) {
    return { status: 400, message: fallback };
  }

  const e = error as Error & FirebaseLikeError;
  const code = normalizeCode(e.code);
  const message = e.message ?? "";
  const details = e.details ?? "";
  const full = `${code} ${message} ${details}`.toLowerCase();

  if (
    code === "5" ||
    full.includes("not_found") ||
    full.includes("database (default) does not exist") ||
    full.includes("no databases found")
  ) {
    return {
      status: 503,
      message:
        "Cloud Firestore が未初期化です。Firebase Console > Firestore Database でデータベースを作成してください。"
    };
  }

  if (full.includes("permission_denied") || code === "7") {
    return {
      status: 403,
      message:
        "Cloud Firestore へのアクセスが拒否されました。プロジェクト設定とサービスアカウント権限を確認してください。"
    };
  }

  return { status: 400, message: message || fallback };
}