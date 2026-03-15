"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SiteThumbnailImage from "@/components/site-thumbnail-image";
import { useAuth } from "@/components/auth-provider";
import { SiteDoc, PlanName } from "@/types/domain";

interface SitesResponse {
  sites: SiteDoc[];
  plan: {
    name: PlanName;
    maxSites: number;
    intervalMinutes: number;
    formMonitoring: boolean;
    aiAnalysis: boolean;
  };
}

interface WallSlot {
  siteId: string;
  url: string;
  status: SiteDoc["status"];
}

function normalizedWallPlanMax(maxSites: number | undefined): 3 | 15 | 40 {
  if (maxSites === 3 || maxSites === 15) return maxSites;
  return 40;
}


export default function WallThumbnailsPage() {
  const { apiFetch, token, user, loading } = useAuth();
  const router = useRouter();
  const [sites, setSites] = useState<SiteDoc[]>([]);
  const [planMax, setPlanMax] = useState<3 | 15 | 40>(40);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!token) return;
    const loadSites = async () => {
      try {
        const res = await apiFetch("/api/sites");
        if (!res.ok) return;
        const payload = (await res.json()) as SitesResponse;
        setSites(payload.sites);
        setPlanMax(normalizedWallPlanMax(payload.plan?.maxSites));
      } catch (e) {
        console.error("Failed to fetch wall thumbnails:", e);
      }
    };
    void loadSites();
  }, [apiFetch, token]);

  const slots = useMemo(
    () =>
      Array.from({ length: planMax }, (_, i): WallSlot => {
        const s = sites[i];
        if (s) {
          return {
            siteId: s.siteId,
            url: s.url,
            status: s.status
          };
        }
        return {
          siteId: "",
          url: "",
          status: "pending"
        };
      }),
    [planMax, sites]
  );

  return (
    <main className="wall-fullscreen-page">
      <div className={`wall-fullscreen-grid plan-slot-grid plan-slot-grid-${planMax}`}>
        {slots.map((item, idx) => {
          if (!item.siteId) {
            return <div key={`empty-${idx}`} className="plan-slot-thumb empty" aria-label={`空きスロット ${idx + 1}`} />;
          }

          return (
            <Link
              key={item.siteId}
              href={`/dashboard/sites/${item.siteId}`}
              className={`plan-slot-thumb ${item.status}`}
            >
              <SiteThumbnailImage
                url={item.url}
                alt="site thumbnail"
              />
            </Link>
          );
        })}
      </div>
    </main>
  );
}



