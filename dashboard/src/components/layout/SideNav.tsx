"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  BellRing,
  Cpu,
  LayoutDashboard,
  Network,
  Siren,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/architecture", label: "Architecture", icon: Network },
  { href: "/simulation", label: "Fault simulation", icon: Siren },
  { href: "/alarm-xmeas13", label: "Alarm lab (xmeas_13)", icon: BellRing },
  { href: "/alerts", label: "Alerts & incidents", icon: AlertTriangle },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
] as const;

export function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="relative z-20 hidden w-56 shrink-0 flex-col border-r border-white/[0.07] bg-[#030712]/90 py-4 backdrop-blur-xl md:flex">
      <div className="mb-6 flex items-center gap-2 px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10">
          <Cpu className="h-4 w-4 text-cyan-300" />
        </div>
        <div>
          <p className="font-[family-name:var(--font-orbitron)] text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            AIFI
          </p>
          <p className="text-xs font-medium text-slate-200">TEP Command</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} className="block">
              <motion.span
                whileHover={{ x: 2 }}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium transition-colors ${
                  active
                    ? "border border-cyan-400/25 bg-cyan-500/10 text-cyan-100 shadow-[0_0_24px_-8px_rgba(34,211,238,0.5)]"
                    : "border border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={1.5} />
                {label}
              </motion.span>
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto px-4 pt-4 text-[9px] uppercase tracking-widest text-slate-600">
        Industry 4.0 · Digital twin
      </p>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-white/[0.07] bg-[#030712]/95 px-2 py-2 md:hidden">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide ${
              active
                ? "bg-cyan-500/15 text-cyan-200"
                : "text-slate-500"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label.split(" ")[0]}
          </Link>
        );
      })}
    </nav>
  );
}
