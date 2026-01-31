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
import { Settings2, Shield, Users, Database, Download, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Progress } from '@/components/ui/progress';

interface Settings {
  id: string;
  registrationEnabled: boolean;
  requireWhitelist: boolean;
  githubLoginEnabled: boolean;
  siteName: string;
  siteDescription: string;
  uploadRateLimit: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [exportPassword, setExportPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [progress, setProgress] = useState(0);
  const [restoreStep, setRestoreStep] = useState('');

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
          githubLoginEnabled: settings.githubLoginEnabled,
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

  const handleExport = () => {
    if (!exportPassword) {
      toast.error('请先设置加密密码。系统不再支持明文备份以确保您的数据安全。');
      return;
    }
    toast.info('正在准备备份文件...');
    const url = `/api/admin/backup/export?pwd=${encodeURIComponent(exportPassword)}`;
    window.location.href = url;
  };

  const handleImportClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setShowImportConfirm(true);
    setShowImportConfirm(true);
    setShowPasswordDialog(true);
    setImportPassword('');
    // 重置 input 方便下次触发
    e.target.value = '';
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    
    setImporting(true);
    setShowImportConfirm(false);
    setProgress(5);
    setRestoreStep('初始化导入组件...');
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          setProgress(15);
          setRestoreStep('正在预处理备份文件...');
          const content = JSON.parse(event.target?.result as string);
          // 只要是有效的 JSON 即可，加密识别交由后端处理
          if (typeof content !== 'object' || content === null) {
            throw new Error('无效的备份文件格式');
          }

          if (importPassword) {
            setProgress(15);
            setRestoreStep('正在校验密码并解密数据...');
            // 模拟一个短暂的校验延迟，让用户感知到正在验证
            await new Promise(resolve => setTimeout(resolve, 800));
          }
          
          setProgress(30);
          setRestoreStep('密码校验通过，开始还原...');
          const progressInterval = setInterval(() => {
            setProgress(prev => {
              if (prev >= 92) {
                clearInterval(progressInterval);
                return 92;
              }
              return prev + (prev < 60 ? 1.5 : 0.3);
            });
          }, 400);

          const res = await fetch('/api/admin/backup/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              backup: content.backup || content, 
              password: importPassword 
            }),
          });

          const result = await res.json();
          setRestoreStep('正在完成收尾工作...');

          if (!res.ok) {
            clearInterval(progressInterval);
            if (result.error === 'THIS_IS_ENCRYPTED') {
              setShowPasswordDialog(true);
              setShowImportConfirm(true);
              toast.info('该备份已加密，请输入解析密码');
            } else {
              throw new Error(result.error || '还原过程中发生错误');
            }
            setImporting(false);
            setProgress(0);
            return;
          }

          clearInterval(progressInterval);
          setProgress(100);
          setRestoreStep('系统还原完成！正在重载...');
          toast.success('系统还原成功！正在重新载入...');
          setTimeout(() => window.location.href = '/auth/signin', 2000);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : '还原过程中发生错误';
          toast.error(message);
          setImporting(false);
          setProgress(0);
        }
      };
      reader.readAsText(pendingFile);
    } catch {
      toast.error('无法读取备份文件');
      setImporting(false);
      setProgress(0);
    }
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
                      <CardContent className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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

                        <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-zinc-100/50 dark:hover:bg-white/10 transition-colors">
                          <div className="space-y-0.5">
                            <Label className="text-base font-medium">GitHub 登录</Label>
                            <p className="text-xs text-muted-foreground">允许用户通过 GitHub OAuth 登录</p>
                          </div>
                          <Switch
                            checked={settings.githubLoginEnabled}
                            onCheckedChange={(checked) => setSettings({ ...settings, githubLoginEnabled: checked })}
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

                  {/* Data Management (Backup/Restore) */}
                  <div>
                    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 hover:translate-y-0">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-500/10 rounded-lg">
                            <Database className="w-5 h-5 text-amber-500" />
                          </div>
                          <div>
                            <CardTitle>数据管理</CardTitle>
                            <CardDescription>导出系统备份或从可用备份中还原</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-white/5 border border-zinc-200/50 dark:border-white/10 space-y-4">
                            <div className="flex items-center gap-3">
                              <Download className="w-4 h-4 text-blue-500" />
                              <span className="font-medium">导出全量备份</span>
                            </div>
                            <p className="text-xs text-muted-foreground">导出包含所有记录的 JSON。系统将强制使用加密以确保数据安全。</p>
                            <div className="space-y-2">
                              <Label className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">加密密码 (必填)</Label>
                              <Input
                                type="password"
                                placeholder="设置导出密码，必须牢记"
                                value={exportPassword}
                                onChange={(e) => setExportPassword(e.target.value)}
                                className="h-8 text-xs bg-zinc-100/50 dark:bg-white/5 border-blue-100 dark:border-blue-900/30"
                              />
                            </div>
                            <Button variant="default" size="sm" onClick={handleExport} className="w-full shadow-md shadow-blue-500/10">
                              开始加密导出
                            </Button>
                          </div>

                          <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-white/5 border border-zinc-200/50 dark:border-white/10 space-y-4">
                            <div className="flex items-center gap-3">
                              <Upload className="w-4 h-4 text-amber-500" />
                              <span className="font-medium">从备份还原</span>
                            </div>
                            <p className="text-xs text-muted-foreground">上传备份文件以恢复系统状态。注意：这会覆盖当前所有数据！</p>
                            <div className="relative">
                              <Input
                                type="file"
                                accept=".backup"
                                onChange={handleImportClick}
                                disabled={importing}
                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                              />
                              <Button variant="outline" size="sm" disabled={importing} className="w-full">
                                {importing ? '还原中...' : '选择 .backup 文件并还原'}
                              </Button>
                            </div>
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

        <ConfirmDialog
            open={showImportConfirm}
            onOpenChange={setShowImportConfirm}
            title="危险操作：确认还原备份？"
            description={
                <div className="flex flex-col items-center gap-6 py-4">
                    <div className="relative flex items-center justify-center w-20 h-20">
                        <div className="absolute inset-0 bg-red-500/10 dark:bg-red-400/10 rounded-full animate-ping opacity-20 duration-3000" />
                        <div className="relative flex items-center justify-center w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full border border-red-100 dark:border-red-800/30">
                            <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
                        </div>
                    </div>

                    <div className="space-y-4 w-full text-center">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">此操作将清空所有现有数据</h3>
                            <p className="text-sm text-muted-foreground">
                                正在操作的文件：<span className="font-mono text-zinc-700 dark:text-zinc-300">{pendingFile?.name}</span>
                            </p>
                        </div>

                        {showPasswordDialog && (
                            <div className="w-full space-y-2 animate-in fade-in slide-in-from-top-2">
                                <Label className="text-xs font-bold uppercase tracking-wider opacity-70">解密密码</Label>
                                <Input
                                    type="password"
                                    placeholder="请输入备份加密密码"
                                    value={importPassword}
                                    onChange={(e) => setImportPassword(e.target.value)}
                                    className="bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                    autoFocus
                                />
                            </div>
                        )}

                        <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-xl border border-red-100 dark:border-red-900/20 text-xs text-red-600 dark:text-red-400 leading-relaxed">
                            还原备份将永久删除当前数据库中的所有用户、文件、短链、团队和设置，并用备份文件中的内容完全替换。此操作无法撤销。
                        </div>
                    </div>
            }
            confirmText="我已知晓风险，执行还原"
            cancelText="取消"
            onConfirm={confirmImport}
            confirmDisabled={showPasswordDialog && !importPassword}
            variant="destructive"
        />

        <AnimatePresence>
            {importing && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex items-center justify-center bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl"
            >
                <div className="max-w-md w-full p-8 space-y-8 text-center text-zinc-900 dark:text-zinc-100">
                <motion.div
                    animate={{ 
                    scale: [1, 1.05, 1],
                    rotate: [0, 5, -5, 0] 
                    }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="flex justify-center"
                >
                    <div className="p-5 bg-primary/10 rounded-3xl">
                    <Database className="w-12 h-12 text-primary animate-pulse" />
                    </div>
                </motion.div>
                
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold tracking-tight">核心数据正在极速还原</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed h-5 italic">
                    {restoreStep}
                    </p>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-60">
                    <span>Restoring System Records</span>
                    <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2 bg-zinc-200 dark:bg-zinc-800 overflow-hidden relative border-none">
                        <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                    </Progress>
                </div>

                <div className="pt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    <span>引擎正在全速运作，请耐心等待...</span>
                </div>
                </div>
            </motion.div>
            )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
