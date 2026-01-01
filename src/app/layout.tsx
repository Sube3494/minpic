/*
 * @Date: 2025-12-24 21:26:18
 * @Author: Sube
 * @FilePath: layout.tsx
 * @LastEditTime: 2026-01-02 02:36:19
 * @Description: 
 */
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { NavBar } from "@/components/layout/nav-bar";
import { prisma } from "@/lib/prisma";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

function stripMarkdown(text: string): string {
  if (!text) return "";
  // Removes bold tags ** and replaces literal newlines or <br> with spaces
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/<br\s*\/?>/gi, " ").replace(/\n/g, " ");
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await prisma.systemSettings.findFirst();
  
  return {
    title: settings?.siteName || "MinPic - 现代化图床管理系统",
    description: stripMarkdown(settings?.siteDescription || "") || "基于 Next.js 16 + MinIO 构建的专业图床解决方案",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen relative selection:bg-primary/30 selection:text-primary-foreground`}
      >
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SessionProvider>
              {/* Ambient Background - Updated for Theme Support */}
              <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-140 h-140 bg-purple-500/10 rounded-full blur-3xl animate-blob" />
                <div className="absolute top-[-10%] left-[-5%] w-120 h-120 bg-blue-500/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
                <div className="absolute bottom-[-20%] left-[20%] w-160 h-160 bg-indigo-500/10 rounded-full blur-3xl animate-blob animation-delay-4000" />
              </div>

              {/* Global Navigation */}
              <NavBar />

              <div className="relative z-10 flex flex-col min-h-screen">
                {children}
              </div>
              <Toaster 
                position="top-right"
                expand={false}
                richColors={false}
                duration={2000}
              />
            </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
