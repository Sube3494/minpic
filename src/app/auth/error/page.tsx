/*
 * @Date: 2025-12-29 23:45:24
 * @Author: Sube
 * @FilePath: page.tsx
 * @LastEditTime: 2025-12-31 17:51:27
 * @Description: 
 */
'use client';

import { Suspense } from 'react';

import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const errorMessages: Record<string, { title: string; description: string }> = {
  AccountSuspended: {
    title: '账号已被暂停',
    description: '您的账号已被暂停。请联系管理员以恢复访问权限。'
  },
  RegistrationClosed: {
    title: '注册已关闭',
    description: '系统当前未开放新用户注册。请联系管理员获取访问权限。'
  },
  NotWhitelisted: {
    title: '未在白名单中',
    description: '您的 GitHub 账号未在注册白名单中。请联系管理员添加您的账号。'
  },
  Default: {
    title: '登录失败',
    description: '登录过程中发生错误，请稍后重试。'
  }
};

const AuthErrorContent = () => {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'Default';
  const errorInfo = errorMessages[error] || errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-destructive/20 blur-[120px] rounded-full animate-blob" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-orange-500/20 blur-[120px] rounded-full animate-blob animation-delay-2000" />
      </div>

      <Card className="glass-strong max-w-md w-full p-8 sm:p-12 space-y-6 animate-fade-in-up">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
        </div>

        {/* Error Message */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {errorInfo.title}
          </h1>
          <p className="text-muted-foreground">
            {errorInfo.description}
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4">
          <Button
            asChild
            size="lg"
            className="w-full"
          >
            <Link href="/auth/signin" className="flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              返回登录
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  );
}
