'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Github, Sparkles, Shield, Zap } from 'lucide-react';

export default function SignInPage() {
  const handleGitHubSignIn = () => {
    signIn('github', { callbackUrl: '/settings' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 blur-[120px] rounded-full animate-blob" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-500/20 blur-[120px] rounded-full animate-blob animation-delay-2000" />
        <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-purple-500/20 blur-[120px] rounded-full animate-blob animation-delay-4000" />
      </div>

      <Card className="glass-strong max-w-md w-full p-8 sm:p-12 space-y-8 animate-fade-in-up">
        {/* Logo & Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 text-sm font-medium mb-2">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <span className="bg-linear-to-r from-primary via-blue-500 to-purple-500 bg-clip-text text-transparent">
              新一代图床解决方案
            </span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            <span className="bg-clip-text text-transparent bg-linear-to-br from-zinc-900 via-zinc-700 to-zinc-500 dark:from-white dark:via-white/90 dark:to-white/70">
              MinPic
            </span>
          </h1>
          
          <p className="text-muted-foreground text-sm sm:text-base">
            使用 GitHub 账号登录以继续
          </p>
        </div>

        {/* Sign In Button */}
        <div className="space-y-4">
          <Button
            onClick={handleGitHubSignIn}
            size="lg"
            className="w-full group relative overflow-hidden h-12 text-base font-semibold shadow-[0_0_50px_-10px_rgba(139,92,246,0.5)] hover:shadow-[0_0_70px_-10px_rgba(139,92,246,0.7)] bg-primary hover:bg-primary/90 text-white border-0 active:scale-95 transition-all duration-300"
          >
            <Github className="w-5 h-5 mr-2 relative z-10" />
            <span className="relative z-10">使用 GitHub 登录</span>
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent bg-size-[200%_100%] group-hover:animate-shimmer" />
          </Button>
        </div>

        {/* Features */}
        <div className="pt-8 border-t border-border/50 space-y-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Shield className="w-4 h-4 text-primary shrink-0" />
            <span>安全的 OAuth 2.0 认证</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-primary shrink-0" />
            <span>无需注册，一键登录</span>
          </div>
        </div>


      </Card>
    </div>
  );
}
