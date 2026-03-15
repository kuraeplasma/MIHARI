"use client";

import { PropsWithChildren } from "react";
import { DashboardShell } from "@/components/dashboard-shell";

export default function DashboardLayout({ children }: PropsWithChildren) {
  return <DashboardShell>{children}</DashboardShell>;
}
