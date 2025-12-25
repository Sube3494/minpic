import { PageWrapper } from '@/components/layout/page-wrapper';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Link2, Settings, BarChart3, ArrowRight, Sparkles, Zap, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <PageWrapper>
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-4 sm:p-6 md:p-12 relative z-10 w-full overflow-hidden">
      
      {/* Hero Section */}
      <div className="text-center space-y-6 sm:space-y-8 max-w-5xl relative mt-16 sm:mt-20 mb-24 sm:mb-32">
        {/* Glow effect backend */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/15 blur-[120px] rounded-full -z-10 pointer-events-none" />
        
        <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary animate-pulse" />
          <span className="bg-gradient-to-r from-primary via-blue-500 to-purple-500 bg-clip-text text-transparent">
            新一代图床解决方案
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-glow mb-4 sm:mb-6 animate-fade-in-up delay-100 fill-mode-backwards">
          <span className="bg-clip-text text-transparent bg-linear-to-br from-zinc-900 via-zinc-700 to-zinc-500 dark:from-white dark:via-white/90 dark:to-white/70">
            MinPic
          </span>
        </h1>
        
        <p className="text-base sm:text-xl md:text-2xl text-muted-foreground font-light tracking-wide max-w-2xl mx-auto leading-relaxed px-4 animate-fade-in-up delay-200 fill-mode-backwards">
          体验对数字资产的 <span className="text-primary dark:text-white font-medium">极致掌控</span>。
          <br className="hidden md:block" />
          无缝集成 MinIO 对象存储与自定义短链服务。
        </p>
        
        <div className="flex items-center justify-center gap-6 pt-6 sm:pt-8 animate-fade-in-up delay-300 fill-mode-backwards">
           <Button asChild size="lg" className="group rounded-full h-11 sm:h-12 px-12 sm:px-16 text-sm sm:text-base font-semibold shadow-[0_0_50px_-10px_rgba(139,92,246,0.5)] hover:shadow-[0_0_70px_-10px_rgba(139,92,246,0.7)] bg-primary hover:bg-primary/90 text-white border-0 ring-offset-0 active:scale-95 transition-all duration-300 relative overflow-hidden">
             <Link href="/settings" className="flex items-center gap-2">
               <span className="relative z-10">开始使用</span>
               <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform duration-300 relative z-10" />
               <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent bg-size-[200%_100%] group-hover:animate-shimmer" />
             </Link>
           </Button>
        </div>
      </div>

      {/* Feature Showcase Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl">
        
        <Card className="glass-card group hover:border-primary/50 relative overflow-hidden animate-fade-in-up delay-400 fill-mode-backwards">
          <div className="absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader>
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-colors duration-500">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-xl">智能上传</CardTitle>
            <CardDescription className="text-zinc-400">
              支持多种格式拖拽上传，即时处理与响应。
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="glass-card group hover:border-purple-500/50 relative overflow-hidden animate-fade-in-up delay-500 fill-mode-backwards">
          <div className="absolute inset-0 bg-linear-to-b from-purple-500/5 via-blue-500/5 to-transparent dark:from-purple-500/20 dark:via-blue-500/10 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors duration-500">
              <Link2 className="w-6 h-6 text-purple-500" />
            </div>
            <CardTitle className="text-xl">自动短链</CardTitle>
            <CardDescription className="text-zinc-400">
              上传资源自动生成并管理简洁短链。
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="glass-card group hover:border-blue-500/50 relative overflow-hidden animate-fade-in-up delay-700 fill-mode-backwards">
          <div className="absolute inset-0 bg-linear-to-br from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors duration-500">
              <Settings className="w-6 h-6 text-blue-500" />
            </div>
            <CardTitle className="text-xl">多源配置</CardTitle>
            <CardDescription className="text-zinc-400">
             无缝切换多个 MinIO 存储桶与环境配置。
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="glass-card group hover:border-green-500/50 relative overflow-hidden animate-fade-in-up delay-1000 fill-mode-backwards">
          <div className="absolute inset-0 bg-linear-to-br from-green-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader>
            <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center mb-4 group-hover:bg-green-500/30 transition-colors duration-500">
              <BarChart3 className="w-6 h-6 text-green-500" />
            </div>
            <CardTitle className="text-xl">数据洞察</CardTitle>
            <CardDescription className="text-zinc-400">
              可视化展示存储用量与文件访问热度。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Decorative Footer Area */}
      <div className="mt-32 w-full max-w-7xl border-t border-zinc-200 dark:border-white/5 pt-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4">
               <h3 className="text-lg font-semibold flex items-center gap-2">
                 <Zap className="w-5 h-5 text-yellow-500" /> 极速性能
               </h3>
               <p className="text-sm text-zinc-500">基于 Next.js 15 构建，秒级加载与交互响应。</p>
            </div>
            <div className="space-y-4">
               <h3 className="text-lg font-semibold flex items-center gap-2">
                 <Shield className="w-5 h-5 text-emerald-500" /> 安全存储
               </h3>
               <p className="text-sm text-zinc-500">文件安全存储于您自托管的 MinIO 实例中。</p>
            </div>
            <div className="text-right flex flex-col items-end justify-center">
               <div className="text-sm text-zinc-600">Powered by</div>
               <div className="font-mono text-xs text-zinc-700 mt-1">MinPic v1.0 • React 19</div>
            </div>
        </div>
      </div>
    </main>
  </PageWrapper>
);
}
