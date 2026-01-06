import { PageWrapper } from '@/components/layout/page-wrapper';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Upload, Link2, BarChart3, ArrowRight, Sparkles, Zap, Shield, MousePointerClick, Share2, Layers, Users, Cloud, History, Globe, Clock, HardDrive, ShieldCheck, Lock } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getSystemSettings } from '@/lib/settings';
import { MarkdownText } from '@/components/ui/markdown-text';

export default async function HomePage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  
  // Fetch site settings
  const settings = await getSystemSettings();
  const siteName = settings?.siteName || "MinPic";
  const siteDescription = settings?.siteDescription || "简单好用的图床系统";
  
  return (
    <PageWrapper>
      <main className="flex flex-col items-center w-full min-h-screen relative z-10 overflow-hidden pb-32">
        
        {/* Background Blobs */}
        <div className="absolute top-[10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 blur-[128px] rounded-full animate-blob pointer-events-none" />
        <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] bg-purple-500/10 blur-[128px] rounded-full animate-blob delay-700 pointer-events-none" />

        {/* Split Hero Section */}
        <section className="w-full max-w-7xl px-6 pt-20 pb-20 md:pt-40 md:pb-52 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="flex flex-col items-center lg:items-start space-y-8 text-center lg:text-left animate-reveal">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-sm font-medium">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="bg-linear-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                更懂开发者的现代图床
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="flex items-center justify-center lg:justify-start gap-3 sm:gap-4 text-4xl sm:text-6xl md:text-8xl font-black tracking-tight leading-[1.1]">
                <Image src="/minpic.svg" alt="Logo" width={96} height={96} className="w-9 h-9 sm:w-16 sm:h-16 md:w-20 md:h-20 object-contain animate-float" />
                <span className="bg-clip-text text-transparent bg-linear-to-br from-zinc-900 via-zinc-800 to-zinc-500 dark:from-white dark:via-zinc-200 dark:to-zinc-500">
                  {siteName}
                </span>
              </h1>
              <div className="text-lg md:text-2xl text-muted-foreground font-light leading-relaxed max-w-lg mx-auto lg:mx-0">
                <MarkdownText content={siteDescription} />
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 pt-4">
               <Button asChild size="lg" className="group rounded-full h-14 px-10 text-lg font-semibold shadow-2xl shadow-primary/20 bg-primary hover:bg-primary/95 text-white transition-all duration-300">
                 <Link href={isLoggedIn ? "/files" : "/auth/signin"} className="flex items-center gap-2">
                   <span>{isLoggedIn ? "进入应用" : "立即体验"}</span>
                   <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                 </Link>
               </Button>
             </div>
          </div>

          {/* Right Side Visual - Mockup Stack */}
          <div className="relative h-[400px] sm:h-[500px] lg:h-[600px] animate-reveal delay-300 fill-mode-backwards mt-12 lg:mt-0">
            {/* Main File Card - Scaled for mobile */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 sm:w-80 p-3 sm:p-4 rounded-3xl sm:rounded-4xl glass-strong shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] dark:shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] z-30 animate-float border-white/20">
               <div className="relative aspect-square rounded-2xl sm:rounded-4xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 mb-4 sm:mb-5 border border-black/5 dark:border-white/5">
                 <div className="absolute inset-0 bg-linear-to-br from-primary/30 to-purple-500/30 mix-blend-overlay" />
                 <div className="absolute inset-10 flex items-center justify-center opacity-40">
                   <Upload className="w-full h-full text-zinc-400 p-4" />
                 </div>
                 {/* Progress indicator mockup */}
                 <div className="absolute bottom-4 left-4 right-4 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="absolute top-0 left-0 h-full w-2/3 bg-primary animate-pulse" />
                 </div>
               </div>
               <div className="space-y-2 px-3 pb-2">
                 <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                 <div className="h-3 w-1/2 bg-zinc-100 dark:bg-zinc-900 rounded-full" />
               </div>
            </div>
            
            {/* Activity / Share floating elements - Hidden on smallest phones */}
            <div className="absolute top-[5%] right-0 sm:right-[5%] w-40 sm:w-52 p-3 sm:p-5 rounded-3xl sm:rounded-4xl glass-card backdrop-blur-2xl z-40 animate-float delay-500 border-white/10">
               <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                 <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500 shadow-inner">
                   <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                 </div>
                 <div className="space-y-1 sm:space-y-1.5">
                    <div className="h-2.5 sm:h-3 w-16 sm:w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                    <div className="h-1.5 sm:h-2 w-10 sm:w-12 bg-zinc-100 dark:bg-zinc-900 rounded-full" />
                 </div>
               </div>
               <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-zinc-50/50 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-between">
                  <div className="h-1.5 sm:h-2 w-20 sm:w-24 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-1" />
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-primary/20 flex items-center justify-center">
                    <Link2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
                  </div>
               </div>
            </div>

            <div className="absolute bottom-[5%] sm:bottom-[10%] left-0 sm:left-[0%] w-48 sm:w-60 p-3 sm:p-5 rounded-3xl sm:rounded-4xl glass-card backdrop-blur-xl z-20 animate-float delay-1000 border-white/10 hidden sm:block">
               <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-linear-to-tr from-primary to-purple-500 p-[1.5px]">
                       <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-[10px] font-bold text-white">JD</div>
                    </div>
                    <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                 </div>
                 <Clock className="w-4 h-4 text-zinc-400" />
               </div>
               <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <div className="h-2 w-32 bg-zinc-100 dark:bg-zinc-900 rounded-full" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1,2,3].map(i => <div key={i} className="aspect-square rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-black/5 dark:border-white/5" />)}
                  </div>
               </div>
            </div>

            {/* Decorative background icons */}
            <div className="absolute top-[30%] left-[-10%] opacity-20 dark:opacity-10 rotate-12 -z-10 animate-pulse-slow">
              <Shield className="w-32 h-32 text-primary" />
            </div>
            <div className="absolute bottom-[20%] right-[-5%] opacity-20 dark:opacity-10 -rotate-12 -z-10 animate-pulse-slow delay-700">
              <Globe className="w-24 h-24 text-purple-500" />
            </div>
            <div className="absolute top-[15%] left-[15%] w-3 h-3 rounded-full bg-primary/40 blur-sm animate-ping" />
            <div className="absolute bottom-[40%] right-[10%] w-4 h-4 rounded-full bg-purple-500/40 blur-sm animate-ping delay-500" />
          </div>
        </section>

        {/* 3-Step Process Section */}
        <section className="w-full max-w-7xl px-6 mb-24 md:mb-40 animate-reveal delay-500 fill-mode-backwards">
          <div className="flex flex-col md:flex-row items-center md:items-end justify-between mb-12 sm:mb-16 gap-8 text-center md:text-left">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight">丝滑流程，快如闪电</h2>
              <p className="text-lg md:text-xl text-muted-foreground font-light max-w-xl mx-auto md:mx-0">从本地终端到全球 CDN，仅需三步即可完成资源的完美分发。</p>
            </div>
            <div className="hidden md:block h-px flex-1 mx-12 bg-linear-to-r from-zinc-200 dark:from-white/10 to-transparent mb-4" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: MousePointerClick, title: "即时上传", desc: "极简拖拽，多文件并发上传，支持秒传与断点续传。", color: "text-blue-500", bg: "bg-blue-500/10" },
              { icon: Layers, title: "多维管理", desc: "强大的标签管理与层级分类，让海量资源井井有条。", color: "text-purple-500", bg: "bg-purple-500/10" },
              { icon: Share2, title: "一键分享", desc: "自动生成短链与 Markdown 引用，适配所有主流编辑器。", color: "text-emerald-500", bg: "bg-emerald-500/10" }
            ].map((step, i) => (
              <div key={i} className="group p-8 rounded-4xl bg-zinc-50 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:bg-white dark:hover:bg-white/10 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 flex flex-col items-center text-center md:items-start md:text-left">
                <div className={`w-14 h-14 rounded-2xl ${step.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <step.icon className={`w-7 h-7 ${step.color}`} />
                </div>
                <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bento Grid Features Section */}
        <section className="w-full max-w-7xl px-6 mb-12 md:mb-40 animate-reveal delay-700 fill-mode-backwards">
          <div className="text-center mb-12 sm:mb-16 space-y-4">
             <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-glow">不只是图床</h2>
             <p className="text-lg md:text-xl text-muted-foreground font-light">精心设计的每一项功能，只为满足你对极致效率的追求。</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 auto-rows-[240px] sm:auto-rows-[280px]">
            {/* Large Feature 1: Team Management */}
            <div className="md:col-span-3 lg:col-span-8 group rounded-4xl glass-card relative p-8">
                <div className="relative z-10 h-full flex flex-col justify-end">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500 mb-3 sm:mb-4 group-hover:rotate-12 transition-transform">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold mb-2">团队协作与配额</h3>
                  <p className="text-sm sm:text-base text-muted-foreground max-w-md">专为团队设计，支持精细化的成员配额分配与资源管理，让多人协作井然有序。</p>
               </div>
               <div className="absolute top-0 right-0 w-2/3 h-full opacity-10 group-hover:opacity-20 transition-opacity">
                 <Shield className="w-full h-full -rotate-12 translate-x-1/4" />
               </div>
            </div>

            {/* Square Feature 1: MinIO Support */}
            <div className="md:col-span-3 lg:col-span-4 group rounded-4xl glass-card p-8 flex flex-col justify-between">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <Cloud className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">MinIO 原生支持</h3>
                <p className="text-muted-foreground">完美集成 S3 协议，支持自定义存储桶与密钥，完全掌控后端存储。</p>
              </div>
            </div>

            {/* Square Feature 2: Multipart Upload */}
            <div className="md:col-span-3 lg:col-span-4 group rounded-4xl glass-card p-8 flex flex-col justify-between">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">分片极速上传</h3>
                <p className="text-muted-foreground">针对大文件深度优化，支持并行分片传输，确保存储过程稳如泰山。</p>
              </div>
            </div>

            {/* Square Feature 3: Metadata / Thumbnails */}
            <div className="md:col-span-3 lg:col-span-4 group rounded-4xl glass-card p-8 flex flex-col justify-between">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">智能媒体处理</h3>
                <p className="text-muted-foreground">自动分析元数据并提取高清缩略图，大幅提升资源查找与管理效率。</p>
              </div>
            </div>

            {/* Square Feature 4: Audit Logs */}
            <div className="md:col-span-3 lg:col-span-4 group rounded-4xl glass-card p-8 flex flex-col justify-between">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">安全审计日志</h3>
                <p className="text-muted-foreground">全程记录每项操作，支持审计追踪与动向监控，守护每一份数字资产。</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Technical Infrastructure / Stats Transition Section - Card Redesign */}
        <section className="w-full max-w-7xl px-6 mb-12 md:mb-20 animate-reveal delay-1000 fill-mode-backwards">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[
              { label: "存储架构", value: "S3 Native", sub: "基于 MinIO 原生驱动", icon: HardDrive, color: "text-blue-500", bg: "bg-blue-500/10" },
              { label: "数据可用性", value: "99.9%", sub: "企业级高可靠性架构", icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
              { label: "安全协议", value: "SSL/TLS", sub: "端到端 256 位加密传输", icon: Lock, color: "text-purple-500", bg: "bg-purple-500/10" },
              { label: "接口响应", value: "< 20ms", sub: "私有化部署极致低延迟", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10" }
            ].map((stat, i) => (
              <div key={i} className="group glass-card p-8 rounded-4xl border border-black/5 dark:border-white/5 hover:border-primary/20 transition-all duration-500 text-center">
                <div className={`w-14 h-14 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500`}>
                  <stat.icon className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <div className="text-3xl font-black tracking-tight">{stat.value}</div>
                  <div className="text-sm font-bold tracking-widest uppercase text-muted-foreground/80 group-hover:text-primary transition-colors">{stat.label}</div>
                  <div className="text-xs text-muted-foreground/60 font-medium">{stat.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer Area */}
        <section className="w-full relative pb-12 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 mt-4 md:mt-10">
            <footer className="w-full flex flex-col items-center gap-8 text-zinc-400 dark:text-zinc-500">
              <div className="w-full h-px bg-linear-to-r from-transparent via-black/5 dark:via-white/5 to-transparent" />
              <div className="text-[10px] sm:text-xs font-medium tracking-widest uppercase italic">
                © 2026 {siteName} • All Rights Reserved
              </div>
            </footer>
          </div>
        </section>
      </main>
    </PageWrapper>
  );
}
