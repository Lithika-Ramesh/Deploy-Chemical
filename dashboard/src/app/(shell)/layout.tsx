import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default function ShellLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
