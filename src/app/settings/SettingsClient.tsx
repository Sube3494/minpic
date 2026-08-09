'use client';

import { useState } from 'react';
import { AlertTriangle, Info, RefreshCw, Database, FileImage, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useMinioConfig } from '@/hooks/use-minio-config';
import { useShortlinkConfig } from '@/hooks/use-shortlink-config';
import { useSync } from '@/hooks/use-sync';
import { useTeam } from '@/hooks/use-team';
import { ConfigList } from '@/components/settings/config-list';
import { ConfigEditor } from '@/components/settings/config-editor';
import { ShortlinkConfigSection } from '@/components/settings/shortlink-config';
import { PageWrapper } from '@/components/layout/page-wrapper';
export function SettingsClient() {
  const { 
    configs, activeId, selectedId, setSelectedId, loading: minioLoading, saving: minioSaving, testing: minioTesting,
    createConfig, deleteConfig, updateSelectedConfig, activateConfig, saveConfigs, testMinioConnection
  } = useMinioConfig();

  const {
    shortlinkConfig, updateShortlinkConfig, saveShortlinkConfig, testShortlinkConnection, 
    loading: slLoading, saving: slSaving, testing: slTesting
  } = useShortlinkConfig();

  const { syncing, syncProgress, syncFiles, cancelSync } = useSync();
  
  const { teamInfo } = useTeam();

  const [syncDialog, setSyncDialog] = useState<{ open: boolean; configId: string }>({ open: false, configId: '' });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; configId: string }>({ open: false, configId: '' });

  const selectedConfig = configs.find(c => c.id === selectedId);
  const loading = minioLoading || slLoading;

  // Determine if user can edit configs
  // Team members (not owner) can only view and sync TEAM configs
  // But they can create/edit/delete their PERSONAL configs
  const isTeamOwner = teamInfo?.role === 'OWNER';




  const handleSyncClick = (id: string) => {
    setSyncDialog({ open: true, configId: id });
  };

  const confirmSync = async () => {
    const { configId } = syncDialog;
    if (configId) {
        await syncFiles(configId);
        // We keep dialog open to show 100% progress, then user can close it
        // Or we could auto-close after 1.5s
        setTimeout(() => {
          setSyncDialog({ open: false, configId: '' });
        }, 2000);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteDialog({ open: true, configId: id });
  };

  const confirmDelete = async () => {
    const { configId } = deleteDialog;
    setDeleteDialog({ open: false, configId: '' });
    if (configId) {
      await deleteConfig(configId);
      toast.success('配置已删除');
    }
  };

  return (
    <PageWrapper>
      <div className="min-h-screen p-4 sm:p-6 md:p-12 pb-32">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 mt-12 sm:mt-16">
          <div className="space-y-1 md:space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-glow">
              <span className="bg-clip-text text-transparent bg-linear-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-white/40">
                存储配置
              </span>
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm md:text-lg">
              管理多图床源配置与外部服务集成
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start"
            >
                {/* Left Sidebar Skeleton */}
                <div className="lg:col-span-4 space-y-4 sm:space-y-6">
                    <div className="space-y-3">
                        <Skeleton className="h-14 w-full rounded-2xl" />
                        <Skeleton className="h-14 w-full rounded-2xl" />
                        <Skeleton className="h-14 w-full rounded-2xl" />
                    </div>
                    <Skeleton className="hidden lg:block h-[180px] w-full rounded-2xl" />
                </div>

                {/* Right Editor Skeleton */}
                <div className="lg:col-span-8 space-y-6 sm:space-y-8">
                     <Skeleton className="h-[500px] w-full rounded-2xl" />
                     <Skeleton className="lg:hidden h-[180px] w-full rounded-2xl" />
                </div>
            </motion.div>
          ) : (
            <motion.div 
                key="content"
                className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
            >
                {/* Left Sidebar - Desktop: includes shortlink config */}
                <div className="lg:col-span-4 space-y-4 sm:space-y-6">


                    {/* Config List */}
                    <ConfigList 
                        configs={configs}
                        activeId={activeId}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onCreate={createConfig}
                        onDelete={handleDeleteClick}
                        canDelete={true}
                        canEdit={true}
                    />

                    {/* Shortlink Section - Only visible on desktop */}
                    <div className="hidden lg:block">
                        <ShortlinkConfigSection
                            config={shortlinkConfig}
                            isTesting={slTesting}
                            isSaving={slSaving}
                            onUpdate={updateShortlinkConfig}
                            onTest={testShortlinkConnection}
                            onSave={saveShortlinkConfig}
                        />
                    </div>
                </div>

                {/* Right: MinIO Config Editor + Mobile Shortlink */}
                <div className="lg:col-span-8 space-y-6 sm:space-y-8">
                    {selectedConfig && (
                        <ConfigEditor 
                            config={selectedConfig}
                            isSyncing={syncing}
                            isTesting={minioTesting}
                            isSaving={minioSaving}
                            canEdit={!selectedConfig.isTeam || isTeamOwner}
                            onUpdate={updateSelectedConfig}
                            onSync={handleSyncClick}
                            onTest={testMinioConnection}
                            onSave={() => saveConfigs(selectedConfig.name)}
                        />
                    )}

                    {/* Shortlink Section - Only visible on mobile, at bottom */}
                    <div className="lg:hidden">
                        <ShortlinkConfigSection
                            config={shortlinkConfig}
                            isTesting={slTesting}
                            isSaving={slSaving}
                            onUpdate={updateShortlinkConfig}
                            onTest={testShortlinkConnection}
                            onSave={saveShortlinkConfig}
                        />
                    </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <ConfirmDialog
            open={syncDialog.open}
            onOpenChange={(open) => !open && setSyncDialog({ open: false, configId: '' })}
            title="同步文件库"
            description={
                <div className="flex flex-col items-center gap-6 py-4">
                    {/* Hero Icon */}
                    <div className="relative flex items-center justify-center w-20 h-20">
                        <div className={`absolute inset-0 bg-blue-500/10 dark:bg-blue-400/10 rounded-full animate-ping opacity-20 duration-3000 ${syncing ? 'block' : 'hidden'}`} />
                        <div className="relative flex items-center justify-center w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-100 dark:border-blue-800/30">
                            <RefreshCw className={`w-10 h-10 text-blue-600 dark:text-blue-400 ${syncing ? 'animate-spin' : 'animate-spin-slow'}`} />
                        </div>
                    </div>

                    <div className="space-y-4 w-full">
                        <div className="text-center space-y-1">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                {syncing ? '正在同步文件...' : '准备同步文件'}
                            </h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-[280px] mx-auto">
                                {syncing ? '扫描并导入 MinIO 存储桶中的内容' : '将会对接 MinIO 存储桶并执行全量扫描'}
                            </p>
                        </div>

                        {syncing && syncProgress ? (
                            <div className="space-y-4 px-2 w-full max-w-[320px] sm:max-w-[400px] mx-auto overflow-hidden">
                                {/* Progress Bar */}
                                <div className="space-y-2 w-full">
                                    <div className="flex justify-between text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                                        <span>当前进度</span>
                                        <span>{Math.round((syncProgress.current || 0) / syncProgress.total * 100)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden border border-zinc-200/50 dark:border-white/5">
                                        <motion.div 
                                            className="h-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)]"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(syncProgress.current || 0) / syncProgress.total * 100}%` }}
                                        />
                                    </div>
                                    {syncProgress.currentFilename && (
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate text-center animate-pulse w-full px-1" title={syncProgress.currentFilename}>
                                            正在处理: {syncProgress.currentFilename}
                                        </div>
                                    )}
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-emerald-50/50 dark:bg-emerald-500/5 p-2 rounded-xl border border-emerald-100/50 dark:border-emerald-500/10 text-center">
                                        <div className="text-emerald-600 dark:text-emerald-400 text-lg font-bold">{syncProgress.imported}</div>
                                        <div className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60 font-medium">已导入</div>
                                    </div>
                                    <div className="bg-zinc-50/50 dark:bg-white/5 p-2 rounded-xl border border-zinc-100/50 dark:border-white/10 text-center">
                                        <div className="text-zinc-600 dark:text-zinc-400 text-lg font-bold">{syncProgress.skipped}</div>
                                        <div className="text-[10px] text-zinc-600/60 dark:text-zinc-400/60 font-medium">已跳过</div>
                                    </div>
                                    <div className="bg-red-50/50 dark:bg-red-500/5 p-2 rounded-xl border border-red-100/50 dark:border-red-500/10 text-center">
                                        <div className="text-red-600 dark:text-red-400 text-lg font-bold">{syncProgress.errors}</div>
                                        <div className="text-[10px] text-red-600/60 dark:text-red-400/60 font-medium">失败</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-zinc-50/50 dark:bg-white/5 p-4 rounded-2xl border border-zinc-100/50 dark:border-white/5 space-y-3">
                                {[
                                    { icon: Database, text: "扫描存储桶中的所有文件", color: "text-purple-500" },
                                    { icon: FileImage, text: "自动生成文件缩略图", color: "text-amber-500" },
                                    { icon: Share2, text: "智能识别并跳过已有记录", color: "text-emerald-500" }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-white dark:hover:bg-white/5 transition-colors group">
                                        <div className={`p-2 rounded-lg bg-white dark:bg-white/5 shadow-sm border border-zinc-100 dark:border-white/5 group-hover:scale-105 transition-transform ${item.color}`}>
                                            <item.icon className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex items-start gap-3 text-zinc-500 dark:text-zinc-400 text-xs bg-zinc-50 dark:bg-white/5 p-3.5 rounded-xl">
                            <Info className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />
                            <p className="leading-normal opacity-80">
                                {syncing ? '正在实时同步，请勿离开此页面以确保任务完成。' : '同步耗时取决于文件数量。任务将在后台执行，期间请勿关闭服务器。'}
                            </p>
                        </div>
                    </div>
                </div>
            }
            confirmText={syncing ? "暂停同步" : "开始同步"}
            cancelText="取消"
            onConfirm={syncing ? () => {
              cancelSync();
              setSyncDialog({ open: false, configId: '' });
            } : confirmSync}
            isLoading={syncing}
            confirmDisabled={false}
            cancelDisabled={false}
        />

        <ConfirmDialog
            open={deleteDialog.open}
            onOpenChange={(open) => !open && setDeleteDialog({ open: false, configId: '' })}
            title="删除配置"
            description={
                <div className="flex flex-col items-center gap-6 py-4">
                    {/* Hero Icon */}
                    <div className="relative flex items-center justify-center w-20 h-20">
                        <div className="absolute inset-0 bg-red-500/10 dark:bg-red-400/10 rounded-full animate-ping opacity-20 duration-3000" />
                        <div className="relative flex items-center justify-center w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full border border-red-100 dark:border-red-800/30">
                            <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
                        </div>
                    </div>

                    <div className="space-y-4 w-full">
                        <div className="text-center space-y-1">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">确定删除此配置？</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-[280px] mx-auto">
                                此操作将移除配置和数据库引用
                            </p>
                        </div>

                        <div className="bg-zinc-50/50 dark:bg-white/5 p-4 rounded-2xl border border-zinc-100/50 dark:border-white/5 space-y-3">
                            <div className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-white dark:hover:bg-white/5 transition-colors group">
                                <div className="p-2 rounded-lg bg-white dark:bg-white/5 shadow-sm border border-zinc-100 dark:border-white/5 group-hover:scale-105 transition-transform text-red-500">
                                    <Database className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">删除配置和数据库记录</span>
                            </div>
                            <div className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-white dark:hover:bg-white/5 transition-colors group">
                                <div className="p-2 rounded-lg bg-white dark:bg-white/5 shadow-sm border border-zinc-100 dark:border-white/5 group-hover:scale-105 transition-transform text-emerald-500">
                                    <FileImage className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">MinIO 中的文件保持不变</span>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/30 p-3.5 rounded-xl border border-red-100/50 dark:border-red-900/10">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <p className="leading-normal font-medium">
                                此操作不可撤销，请谨慎操作
                            </p>
                        </div>
                    </div>
                </div>
            }
            confirmText="确认删除"
            cancelText="取消"
            onConfirm={confirmDelete}
            variant="destructive"
        />
      </div>
    </div>
  </PageWrapper>
);
}
