import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Geist_Mono, Orbitron } from "next/font/google";
import { NotebookDashboardProvider } from "@/context/NotebookDashboardContext";
import { PlantSimulationProvider } from "@/context/PlantSimulationContext";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AIFI Smart Factory · TEP Digital Twin",
  description:
    "Industry 4.0 predictive fault monitoring for chemical manufacturing (Tennessee Eastman Process).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${orbitron.variable} ${dmSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#020617]" suppressHydrationWarning>
        <PlantSimulationProvider>
          <NotebookDashboardProvider>{children}</NotebookDashboardProvider>
        </PlantSimulationProvider>
      </body>
    </html>
  );
}
