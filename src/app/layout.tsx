import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
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

            {/* Global Theme Toggle */}
            <div className="fixed top-6 right-6 z-50">
              <ModeToggle />
            </div>

            <div className="relative z-10 flex flex-col min-h-screen">
              {children}
            </div>
            <Toaster 
              position="bottom-right" 
              theme="system"
              toastOptions={{
                className: "glass-card border-border/50 shadow-lg",
                classNames: {
                  toast: "group toast group-[.toaster]:bg-background/80 group-[.toaster]:text-foreground group-[.toaster]:border-border/50 group-[.toaster]:shadow-lg group-[.toaster]:backdrop-blur-xl",
                  description: "group-[.toast]:text-muted-foreground",
                  actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
                  cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
                  error: "group-[.toaster]:text-red-600 dark:group-[.toaster]:text-red-400 group-[.toaster]:border-red-200 dark:group-[.toaster]:border-red-500/20 dark:group-[.toaster]:bg-red-500/10",
                  success: "group-[.toaster]:text-green-600 dark:group-[.toaster]:text-green-400 group-[.toaster]:border-green-200 dark:group-[.toaster]:border-green-500/20 dark:group-[.toaster]:bg-green-500/10",
                  warning: "group-[.toaster]:text-yellow-600 dark:group-[.toaster]:text-yellow-400 group-[.toaster]:border-yellow-200 dark:group-[.toaster]:border-yellow-500/20 dark:group-[.toaster]:bg-yellow-500/10",
                  info: "group-[.toaster]:text-blue-600 dark:group-[.toaster]:text-blue-400 group-[.toaster]:border-blue-200 dark:group-[.toaster]:border-blue-500/20 dark:group-[.toaster]:bg-blue-500/10",
                }
              }}
            />
        </ThemeProvider>
      </body>
    </html>
  );
}
