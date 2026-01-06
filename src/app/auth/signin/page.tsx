'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Github, Sparkles, Shield, Zap, Lock, User, Loader2, UserPlus, KeyRound, Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

type AuthMode = 'signin' | 'register' | 'forgot';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/settings';
  
  const [loading, setLoading] = useState(false);
  const [ghLoading, setGhLoading] = useState(false);
  const [githubEnabled, setGithubEnabled] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [countdown, setCountdown] = useState(0);

  const [formData, setFormData] = useState({
    account: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    code: '',
  });

  useEffect(() => {
    // Check GitHub enabled status
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.githubLoginEnabled !== undefined) {
          setGithubEnabled(data.githubLoginEnabled);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async () => {
    if (!formData.email) {
      toast.error('请先填写邮箱地址');
      return;
    }
    
    // Simple email regex check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error('请输入有效的邮箱地址');
      return;
    }

    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          type: authMode === 'register' ? 'register' : 'reset'
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '验证码发送失败');
      } else {
        toast.success('验证码已发送，请查收邮件');
        setCountdown(60);
      }
    } catch {
       toast.error('发送请求失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (authMode === 'register') {
        if (formData.password !== formData.confirmPassword) {
          toast.error('两次输入的密码不一致');
          setLoading(false);
          return;
        }

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: formData.username,
            email: formData.email,
            password: formData.password,
            code: formData.code,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || '注册失败');
          setLoading(false);
          return;
        }

        toast.success('注册成功，正在登录...');
        
        // Auto Login
        const signInRes = await signIn('credentials', {
            account: formData.email,
            password: formData.password,
            redirect: false,
        });

        if (signInRes?.error) {
            toast.error('自动登录失败，请手动登录');
            setAuthMode('signin');
        } else {
            router.push(callbackUrl);
            router.refresh();
        }
        setLoading(false);
      } else if (authMode === 'forgot') {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            code: formData.code,
            newPassword: formData.password,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || '重置失败');
          setLoading(false);
          return;
        }

        toast.success('密码重置成功，请登录');
        setAuthMode('signin');
        setLoading(false);

      } else {
        // Sign In
        const res = await signIn('credentials', {
          account: formData.account,
          password: formData.password,
          redirect: false,
        });

        if (res?.error) {
          toast.error('登录失败，请检查账号密码');
          setLoading(false);
        } else {
          router.push(callbackUrl);
          router.refresh();
        }
      }
    } catch {
      toast.error('发生错误');
      setLoading(false);
    }
  };

  const handleGitHubSignIn = () => {
    setGhLoading(true);
    signIn('github', { callbackUrl });
  };

  const getTitle = () => {
    switch (authMode) {
      case 'register': return '加入 MinPic';
      case 'forgot': return '重置密码';
      default: return '欢迎回来';
    }
  };

  const getSubtitle = () => {
    switch (authMode) {
      case 'register': return '开启您的云端图床之旅';
      case 'forgot': return '我们将发送验证码至您的邮箱';
      default: return '请输入您的账号密码以登录';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 blur-[120px] rounded-full animate-blob" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-500/20 blur-[120px] rounded-full animate-blob animation-delay-2000" />
        <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-purple-500/20 blur-[120px] rounded-full animate-blob animation-delay-4000" />
      </div>

      <Card className="glass-strong max-w-[800px] w-full p-0 overflow-hidden animate-fade-in-up border-zinc-200/50 dark:border-white/10 shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left Column: Form */}
          <div className="p-8 sm:p-10 space-y-6 border-b md:border-b-0 md:border-r border-border/50 bg-white/30 dark:bg-black/20">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">{getTitle()}</h2>
              <p className="text-muted-foreground text-xs italic">{getSubtitle()}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-xs font-semibold">用户名</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      placeholder="设置您的用户名"
                      className="pl-9 h-10 text-sm bg-white/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email / Account Field */}
              <div className="space-y-1.5">
                <Label htmlFor="account" className="text-xs font-semibold">
                  {authMode === 'signin' ? '账号' : '电子邮箱'}
                </Label>
                <div className="relative">
                  {authMode !== 'signin' ? (
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  ) : (
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  )}
                  <Input
                    id={authMode === 'signin' ? "account" : "email"}
                    type={authMode === 'signin' ? "text" : "email"}
                    placeholder={authMode === 'signin' ? "输入用户名或邮箱" : "name@example.com"}
                    className="pl-9 h-10 text-sm bg-white/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10"
                    value={authMode === 'signin' ? formData.account : formData.email}
                    onChange={(e) => authMode === 'signin'
                      ? setFormData({ ...formData, account: e.target.value })
                      : setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {/* Verification Code for Register/Forgot */}
              {authMode !== 'signin' && (
                 <div className="space-y-1.5">
                   <Label htmlFor="code" className="text-xs font-semibold">验证码</Label>
                   <div className="flex gap-2">
                     <div className="relative flex-1">
                       <Shield className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                       <Input
                         id="code"
                         placeholder="请输入6位验证码"
                         className="pl-9 h-10 text-sm bg-white/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10"
                         value={formData.code}
                         onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                         required
                         maxLength={6}
                       />
                     </div>
                     <Button 
                       type="button" 
                       variant="outline" 
                       className="w-24 shrink-0 bg-white/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10"
                       onClick={handleSendCode}
                       disabled={countdown > 0}
                     >
                       {countdown > 0 ? `${countdown}s` : '获取'}
                     </Button>
                   </div>
                 </div>
              )}
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold">
                    {authMode === 'forgot' ? '新密码' : '密码'}
                  </Label>
                  {authMode === 'signin' && (
                    <button 
                      type="button" 
                      onClick={() => setAuthMode('forgot')}
                      className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                    >
                      忘记密码？
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={authMode === 'register' ? "设置登录密码" : authMode === 'forgot' ? "请输入新密码" : "请输入密码"}
                    className="pl-9 h-10 text-sm bg-white/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {authMode === 'register' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                  <div className="flex justify-between">
                    <Label htmlFor="confirmPassword" className="text-xs font-semibold">确认密码</Label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="请再次输入密码"
                      className={cn(
                        "pl-9 h-10 text-sm bg-white/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 transition-colors",
                        formData.confirmPassword && formData.password !== formData.confirmPassword && "border-red-500/50 dark:border-red-500/50 focus-visible:ring-red-500/20"
                      )}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <span className="text-[10px] text-red-500 font-medium animate-in fade-in block mt-1 ml-1">密码不一致</span>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full h-10 text-sm font-semibold shadow-md active:scale-[0.98] transition-transform" disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : authMode === 'register' ? (
                  <UserPlus className="w-4 h-4 mr-2" />
                ) : authMode === 'forgot' ? (
                  <KeyRound className="w-4 h-4 mr-2" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                {authMode === 'register' ? '立即注册' : authMode === 'forgot' ? '重置密码' : '登录系统'}
              </Button>
            </form>

            <div className="text-center">
              {authMode === 'forgot' ? (
                 <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center justify-center w-full gap-1 group"
                >
                  <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> 返回登录
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'signin' ? 'register' : 'signin')}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors group"
                >
                  {authMode === 'register' ? '已有账号？' : '还没有账号？'} 
                  <span className="font-semibold text-primary/80 group-hover:text-primary ml-1">
                    {authMode === 'register' ? '立即登录' : '创建新账号'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Social & Info */}
          <div className="p-8 sm:p-10 flex flex-col justify-center gap-12 bg-white/30 dark:bg-black/20">
            <div className="space-y-8">
              {/* Branding (Small) */}
              <div className="space-y-4 flex flex-col items-center text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-[10px] font-bold uppercase tracking-wider text-primary">
                  <Sparkles className="w-3 h-3" />
                  Private Cloud Storage
                </div>
                <Link href="/" className="hover:opacity-80 transition-opacity">
                  <h1 className="text-4xl font-extrabold tracking-tighter italic">
                    MinPic<span className="text-primary not-italic">.</span>
                  </h1>
                </Link>
              </div>

              {/* GitHub OAuth */}
              {githubEnabled && authMode !== 'forgot' && (
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                      <span className="bg-transparent px-2">Social Auth</span>
                    </div>
                  </div>
                  <Button
                    onClick={handleGitHubSignIn}
                    variant="outline"
                    size="lg"
                    className="w-full h-12 text-sm font-bold bg-white dark:bg-white/5 border-2 border-zinc-200 dark:border-white/10 hover:border-primary/50 hover:bg-zinc-50 dark:hover:bg-white/10 transition-all group"
                    disabled={ghLoading}
                  >
                    {ghLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Github className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
                    )}
                    {authMode === 'register' ? '使用 GitHub 注册' : '使用 GitHub 继续'}
                  </Button>
                </div>
              )}
            </div>

            {/* Features List */}
            <div className="pt-8 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold leading-none mb-1">私有化存储</h4>
                  <p className="text-[10px] text-muted-foreground">完全掌控您的文件，支持 MinIO 等 S3 兼容存储</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold leading-none mb-1">极速分发</h4>
                  <p className="text-[10px] text-muted-foreground">优化的响应策略，为您的博客提供飞一般的速度</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
