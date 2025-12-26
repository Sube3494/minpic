import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { NavBar } from "@/components/layout/nav-bar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MinPic - 现代化图床管理系统",
  description: "基于 Next.js 15 + MinIO 构建的专业图床解决方案",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen relative selection:bg-primary/30 selection:text-primary-foreground`}
      >
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
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
            />
        </ThemeProvider>
      </body>
    </html>
  );
}
