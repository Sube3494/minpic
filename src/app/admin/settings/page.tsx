'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings2, Shield, HardDrive, FileStack } from 'lucide-react';
import { toast } from 'sonner';

interface Settings {
  id: string;
  registrationEnabled: boolean;
  requireWhitelist: boolean;
  defaultStorageQuota: string;
  defaultFileQuota: number;
  siteName: string;
  siteDescription: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setSettings(data);
    } catch {
      toast.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!settings) return;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationEnabled: settings.registrationEnabled,
          requireWhitelist: settings.requireWhitelist,
          defaultStorageQuota: settings.defaultStorageQuota,
          defaultFileQuota: settings.defaultFileQuota,
          siteName: settings.siteName,
          siteDescription: settings.siteDescription
        }),
      });

      if (!res.ok) throw new Error('Failed to save settings');
      
      toast.success('配置已保存');
    } catch {
      toast.error('保存设置失败');
    } finally {
      setSaving(false);
    }
  }

  const formatMB = (bytes: string) => {
    return (Number(bytes) / (1024 * 1024)).toFixed(0);
  };

  const parseMB = (mb: string) => {
    return (parseFloat(mb) * (1024 * 1024)).toString();
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper>
      <div className="space-y-8">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center min-h-[400px]"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-muted-foreground">加载中...</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-foreground to-foreground/70 w-fit">系统设置</h1>
                  <p className="text-muted-foreground">配置系统的全局参数和功能选项</p>
                </div>
                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="shadow-lg shadow-primary/20 w-full sm:w-auto"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin mr-2" />
                      保存中...
                    </>
                  ) : (
                    '保存配置'
                  )}
                </Button>
              </div>

              <div className="grid gap-8">
                {/* Basic Settings */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 hover:translate-y-0">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Settings2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle>基础设置</CardTitle>
                          <CardDescription>配置系统的基本显示和运行参数</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="siteName">站点名称</Label>
                          <Input
                            id="siteName"
                            placeholder="MinPic"
                            value={settings.siteName}
                            onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                            className="bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 transition-all focus:border-primary/20 focus:ring-4 focus:ring-primary/10"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="siteDescription">站点描述 (支持换行与 **粗体高亮**)</Label>
                          <Textarea
                            id="siteDescription"
                            placeholder="简单好用的图床系统"
                            rows={3}
                            value={settings.siteDescription || ''}
                            onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
                            className="bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 transition-all focus:border-primary/20 focus:ring-4 focus:ring-primary/10 min-h-[100px] resize-none"
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10">
                        <div className="space-y-0.5">
                          <Label className="text-base">开放注册</Label>
                          <p className="text-sm text-muted-foreground">允许新用户自行注册账号</p>
                        </div>
                        <Switch
                          checked={settings.registrationEnabled}
                          onCheckedChange={(checked) => setSettings({ ...settings, registrationEnabled: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10">
                        <div className="space-y-0.5">
                          <Label className="text-base">需要白名单</Label>
                          <p className="text-sm text-muted-foreground">仅允许白名单中的用户注册</p>
                        </div>
                        <Switch
                          checked={settings.requireWhitelist}
                          onCheckedChange={(checked) => setSettings({ ...settings, requireWhitelist: checked })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Storage Quota */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 hover:translate-y-0">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                          <Shield className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                          <CardTitle>配额管理</CardTitle>
                          <CardDescription>设置新用户的默认资源限制</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-3">
                          <Label className="flex items-center gap-2">
                            <HardDrive className="w-4 h-4 text-orange-500" />
                            默认存储容量
                          </Label>
                          <div className="flex gap-4">
                            <Input
                              type="number"
                              value={formatMB(settings.defaultStorageQuota)}
                              onChange={(e) => setSettings({ ...settings, defaultStorageQuota: parseMB(e.target.value) })}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 transition-all focus:border-primary/20 focus:ring-4 focus:ring-primary/10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <div className="flex items-center justify-center px-4 bg-muted rounded-md font-mono text-sm shrink-0">
                              MB
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label className="flex items-center gap-2">
                            <FileStack className="w-4 h-4 text-blue-500" />
                            默认文件数量
                          </Label>
                          <div className="flex gap-4">
                            <Input
                              type="number"
                              value={settings.defaultFileQuota}
                              onChange={(e) => setSettings({ ...settings, defaultFileQuota: parseInt(e.target.value) })}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 transition-all focus:border-primary/20 focus:ring-4 focus:ring-primary/10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <div className="flex items-center justify-center px-4 bg-muted rounded-md font-mono text-sm shrink-0">
                              个
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
