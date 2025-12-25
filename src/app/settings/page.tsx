'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useMinioConfig } from '@/hooks/use-minio-config';
import { useShortlinkConfig } from '@/hooks/use-shortlink-config';
import { useSync } from '@/hooks/use-sync';
import { ConfigList } from '@/components/settings/config-list';
import { ConfigEditor } from '@/components/settings/config-editor';
import { ShortlinkConfigSection } from '@/components/settings/shortlink-config';
import { PageWrapper } from '@/components/layout/page-wrapper';

export default function SettingsPage() {
  const { 
    configs, activeId, selectedId, setSelectedId, loading: minioLoading, testing: minioTesting,
    createConfig, deleteConfig, updateSelectedConfig, activateConfig, saveConfigs, testMinioConnection
  } = useMinioConfig();

  const {
    shortlinkConfig, updateShortlinkConfig, saveShortlinkConfig, testShortlinkConnection, 
    loading: slLoading, testing: slTesting
  } = useShortlinkConfig();

  const { syncing, syncFiles } = useSync();

  const [syncDialog, setSyncDialog] = useState<{ open: boolean; configId: string }>({ open: false, configId: '' });

  const selectedConfig = configs.find(c => c.id === selectedId);
  const loading = minioLoading || slLoading;

  const handleSaveAll = async () => {
    await Promise.all([saveConfigs(), saveShortlinkConfig()]);
  };

  const handleSyncClick = (id: string) => {
    setSyncDialog({ open: true, configId: id });
  };

  const confirmSync = async () => {
      const { configId } = syncDialog;
      setSyncDialog({ open: false, configId: '' });
      if (configId) {
          const success = await syncFiles(configId);
          if (success) {
            // Reload to show new files in file manager
            setTimeout(() => {
                // Optional: redirect or just refresh
                // window.location.href = '/files'; 
            }, 1000);
          }
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
          <div className="flex items-center gap-2 md:gap-3">
             <Button 
                onClick={handleSaveAll} 
                disabled={loading} 
                className="h-9 md:h-11 rounded-full px-4 md:px-6 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all text-xs md:text-sm font-bold"
             >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                保存更改
              </Button>
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
                    />

                    {/* Shortlink Section - Only visible on desktop */}
                    <div className="hidden lg:block">
                        <ShortlinkConfigSection
                            config={shortlinkConfig}
                            isTesting={slTesting}
                            onUpdate={updateShortlinkConfig}
                            onTest={testShortlinkConnection}
                        />
                    </div>
                </div>

                {/* Right: MinIO Config Editor + Mobile Shortlink */}
                <div className="lg:col-span-8 space-y-6 sm:space-y-8">
                    {selectedConfig && (
                        <ConfigEditor 
                            config={selectedConfig}
                            isActive={activeId === selectedConfig.id}
                            canDelete={configs.length > 1}
                            isSyncing={syncing}
                            isTesting={minioTesting}
                            onUpdate={updateSelectedConfig}
                            onActivate={activateConfig}
                            onDelete={deleteConfig}
                            onSync={handleSyncClick}
                            onTest={testMinioConnection}
                        />
                    )}

                    {/* Shortlink Section - Only visible on mobile, at bottom */}
                    <div className="lg:hidden">
                        <ShortlinkConfigSection
                            config={shortlinkConfig}
                            isTesting={slTesting}
                            onUpdate={updateShortlinkConfig}
                            onTest={testShortlinkConnection}
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
            description="确定要扫描并同步此配置的所有文件吗？\n\n此操作将:\n• 扫描 MinIO 存储桶中的所有文件\n• 自动识别文件类型并生成缩略图\n• 批量导入到数据库\n• 跳过已存在的文件\n\n⚠️ 这可能需要一些时间,特别是如果存储桶中有大量文件。"
            confirmText="开始同步"
            cancelText="取消"
            onConfirm={confirmSync}
            isLoading={syncing}
        />
      </div>
    </div>
  </PageWrapper>
);
}
