import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

interface LegacyDashboardPageProps {
  searchParams?: SearchParams;
}

function toQueryString(searchParams: SearchParams | undefined) {
  if (!searchParams) {
    return "";
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
      continue;
    }
    if (typeof value === "string") {
      query.set(key, value);
    }
  }

  const queryText = query.toString();
  return queryText ? `?${queryText}` : "";
}

export default function LegacyDashboardPage({ searchParams }: LegacyDashboardPageProps) {
  redirect(`/dashboard${toQueryString(searchParams)}`);
}
