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
import { Settings2, Shield, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Settings {
  id: string;
  registrationEnabled: boolean;
  requireWhitelist: boolean;
  siteName: string;
  siteDescription: string;
  uploadRateLimit: number;
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
          siteName: settings.siteName,
          siteDescription: settings.siteDescription,
          uploadRateLimit: settings.uploadRateLimit
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
                <div className="grid gap-6">
                  {/* Site Configuration */}
                  <div>
                    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 hover:translate-y-0">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Settings2 className="w-5 h-5 text-blue-500" />
                          </div>
                          <div>
                            <CardTitle>站点配置</CardTitle>
                            <CardDescription>设置站点的基本显示信息</CardDescription>
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
                              className="bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 transition-all focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/10"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="siteDescription">站点描述 (支持换行与 **粗体高亮**)</Label>
                            <Textarea
                              id="siteDescription"
                              placeholder="简单好用的图床系统"
                              rows={2}
                              value={settings.siteDescription || ''}
                              onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
                              className="bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 transition-all focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/10 min-h-[80px] resize-none"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Access Control */}
                  <div>
                    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 hover:translate-y-0">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Users className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div>
                            <CardTitle>访问控制</CardTitle>
                            <CardDescription>管理用户注册和访问权限</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-zinc-100/50 dark:hover:bg-white/10 transition-colors">
                          <div className="space-y-0.5">
                            <Label className="text-base font-medium">开放注册</Label>
                            <p className="text-xs text-muted-foreground">允许新用户自行注册账号</p>
                          </div>
                          <Switch
                            checked={settings.registrationEnabled}
                            onCheckedChange={(checked) => setSettings({ ...settings, registrationEnabled: checked })}
                          />
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-zinc-100/50 dark:hover:bg-white/10 transition-colors">
                          <div className="space-y-0.5">
                            <Label className="text-base font-medium">需要白名单</Label>
                            <p className="text-xs text-muted-foreground">仅允许白名单中的用户注册</p>
                          </div>
                          <Switch
                            checked={settings.requireWhitelist}
                            onCheckedChange={(checked) => setSettings({ ...settings, requireWhitelist: checked })}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Security Limits */}
                  <div>
                    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 hover:translate-y-0">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-500/10 rounded-lg">
                            <Shield className="w-5 h-5 text-red-500" />
                          </div>
                          <div>
                            <CardTitle>安全策略</CardTitle>
                            <CardDescription>配置系统的安全限制参数</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-6 sm:grid-cols-2">
                           <div className="space-y-2">
                            <Label htmlFor="uploadRateLimit">上传频率限制 (次/分钟)</Label>
                            <div className="relative">
                              <Input
                                id="uploadRateLimit"
                                type="number"
                                min="1"
                                placeholder="100"
                                value={settings.uploadRateLimit || ''}
                                onChange={(e) => setSettings({ ...settings, uploadRateLimit: parseInt(e.target.value) || 0 })}
                                className="bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 transition-all focus:border-red-500/20 focus:ring-4 focus:ring-red-500/10 no-spinner pr-12"
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                RPM
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">针对每个IP地址的每分钟上传请求限制</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>


              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
