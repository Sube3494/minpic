import { useState, useEffect, useCallback } from 'react';
import { MinioConfigItem, DEFAULT_MINIO_CONFIG, UseMinioConfigReturn } from '@/types/config';
import { configService } from '@/services/config.service';
import { toast } from 'sonner';

export function useMinioConfig(): UseMinioConfigReturn {
  const [configs, setConfigs] = useState<MinioConfigItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [activeIdChanged, setActiveIdChanged] = useState(false);
  const [originalActiveId, setOriginalActiveId] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadConfigs = useCallback(async () => {
    const startTime = Date.now();
    setLoading(true);
    try {
      const data = await configService.getMinioConfigs();
      
      const elapsed = Date.now() - startTime;
      const minLoadTime = 300;
      if (elapsed < minLoadTime) {
         await new Promise(resolve => setTimeout(resolve, minLoadTime - elapsed));
      }

      let configsToSet = data.configs || [];
      
      if (configsToSet.length === 0) {
        const defaultId = `default-${Date.now()}`;
        const defaultConfig: MinioConfigItem = {
          ...DEFAULT_MINIO_CONFIG,
          id: defaultId,
          name: '默认配置',
        };
        configsToSet = [defaultConfig];
      }

      setConfigs(configsToSet);
      setActiveId(data.activeId || '');
      setOriginalActiveId(data.activeId || '');
      setActiveIdChanged(false);
      setSelectedId(prev => {
        if (prev) return prev;
        return data.activeId || (configsToSet[0]?.id ?? '');
      });
    } catch (error) {
      console.error('Error loading MinIO configs:', error);
      
      // 检测401错误，重定向到登录页面
      if (error instanceof Error && error.message.includes('401')) {
        window.location.href = '/auth/signin';
        return;
      }
      
      toast.error('无法加载配置信息', {
        description: '请检查网络连接或刷新页面'
      });
    } finally {
      setLoading(false);
    }
  }, []); 

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const createConfig = () => {
    const newId = `config-${Date.now()}`;
    const newConfig: MinioConfigItem = {
      ...DEFAULT_MINIO_CONFIG,
      id: newId,
      name: '新配置',
    };
    setConfigs(prev => [...prev, newConfig]);
    setSelectedId(newId);
  };

  const deleteConfig = async (id: string) => {
    const newConfigs = configs.filter(c => c.id !== id);
    setConfigs(newConfigs);
    
    // Auto save the new config list
    setLoading(true);
    try {
        // If the deleted config was active, we should probably deactivate it or let the user decide.
        // For simplicity, if we delete the active one, we unset activeId locally, and save that state.
        const newActiveId = activeId === id ? '' : activeId;
        
        await configService.saveMinioConfigs(newConfigs, newActiveId);
        
        if (activeId === id) {
             setActiveId('');
             setOriginalActiveId('');
        }

        // UI navigation
        if (selectedId === id) {
           const nextId = newActiveId || (newConfigs.length > 0 ? newConfigs[0].id : '');
           setSelectedId(nextId);
        }
        
    } catch (error) {
        console.error('Failed to save config deletion:', error);
        toast.error('保存删除操作失败', {
            description: '请重试'
        });
        // Revert local change if needed, but for now we just show error
    } finally {
        setLoading(false);
    }
  };

  const updateSelectedConfig = (updates: Partial<MinioConfigItem>) => {
    setConfigs(configs.map(c => c.id === selectedId ? { ...c, ...updates } : c));
  };

  const activateConfig = async (id: string) => {
    // If we're deactivating, just go ahead
    if (activeId === id) {
      await performActivation('');
      return;
    }

    const config = configs.find(c => c.id === id);
    if (!config) return;

    // Run connection test for activation (silently so we can custom toast)
    const result = await testMinioConnection(id, true);
    
    if (result.success) {
      // 关键修复：使用测试成功后返回的最新配置列表进行激活，避免状态覆盖
      await performActivation(id, result.updatedConfigs);
    } else {
      toast.error('激活失败', {
        description: `连接测试未通过 ${result.error || '无法建立连接'}`
      });
    }
  };

  const performActivation = async (id: string, currentConfigs?: MinioConfigItem[]) => {
    const oldActiveId = activeId;
    const configsToSave = currentConfigs || configs;
    setActiveId(id);
    
    setLoading(true);
    try {
      await configService.saveMinioConfigs(configsToSave, id);
      setOriginalActiveId(id);
      setActiveIdChanged(false);
      
      if (id === '') {
        toast.success('已取消激活配置', {
          description: '当前无激活的 MinIO 配置'
        });
      } else {
        const configName = configsToSave.find(c => c.id === id)?.name || '未命名配置';
        toast.success(`已激活: ${configName}`, {
          description: '配置已立即生效'
        });
      }
    } catch (error) {
      console.error(error);
      setActiveId(oldActiveId);
      toast.error('激活配置失败', {
        description: '请检查网络连接后重试'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfigs = async (feedbackName?: string, silent = false) => {
    // 必填项校验逻辑
    const configToValidate = configs.find(c => c.id === selectedId);
    if (configToValidate) {
        const requiredFields = [
            { key: 'name', label: '配置名称' },
            { key: 'endpoint', label: '服务器地址 (Endpoint)' },
            { key: 'accessKey', label: 'Access Key' },
            { key: 'secretKey', label: 'Secret Key' },
            { key: 'bucket', label: 'Bucket 名称' }
        ];

        const missingFields = requiredFields
            .filter(f => !configToValidate[f.key as keyof MinioConfigItem])
            .map(f => f.label);

        if (missingFields.length > 0) {
            toast.error('保存失败', {
                description: `请填写必填项: ${missingFields.join(', ')}`
            });
            return;
        }
    }

    setLoading(true);
    try {
      const finalActiveId = activeIdChanged ? activeId : originalActiveId;
      
      await configService.saveMinioConfigs(configs, finalActiveId);
      
      setOriginalActiveId(finalActiveId);
      setActiveIdChanged(false);
      
      if (!silent) {
        toast.success(`MinIO 配置已保存`, {
          description: feedbackName 
            ? `已更新配置：${feedbackName}` 
            : '所有更改已保存'
        });
      }
    } catch (error) {
       console.error('Save error:', error);
       toast.error('保存 MinIO 配置失败', {
         description: '请检查网络连接后重试'
       });
    } finally {
      setLoading(false);
    }
  };
  
  const testMinioConnection = async (id?: string | unknown, silent = false) => {
      const targetId = typeof id === 'string' ? id : selectedId;
      const config = configs.find(c => c.id === targetId);
      if (!config) return { success: false, error: '配置项不存在' };

      setTesting(true);
      let loadingToast = null;
      if (!silent) {
        loadingToast = toast.loading(`正在测试 ${config.name} 连接...`);
      }
      
      try {
          const result = await configService.testConnection('minio', config);
          if (!silent && loadingToast) toast.dismiss(loadingToast);
          
          if (result.success) {
            if (!silent) toast.success(`${config.name} 连接测试成功`);
            
            // 使用函数式更新确保存态一致性，并返回最新列表给调用者
            let updatedConfigs: MinioConfigItem[] = [];
            setConfigs(prev => {
              updatedConfigs = prev.map(c => 
                c.id === targetId ? { ...c, status: 'success' as const } : c
              );
              return updatedConfigs;
            });
            
            // 这里我们需要确保拿到的是最新的 updatedConfigs，由于 setConfigs 是异步的
            // 我们手动计算一次用于同步保存
            const latestConfigs = configs.map(c => 
              c.id === targetId ? { ...c, status: 'success' as const } : c
            );

            await configService.saveMinioConfigs(latestConfigs, activeId);
            return { success: true, updatedConfigs: latestConfigs };
          } else {
            if (!silent) {
              toast.error(`${config.name} 测试失败`, {
                description: result.error || '请检查配置参数'
              });
            }
            const updatedConfigs = configs.map(c => 
              c.id === targetId ? { ...c, status: 'error' as const } : c
            );
            setConfigs(updatedConfigs);
            await configService.saveMinioConfigs(updatedConfigs, activeId);
            return { success: false, error: result.error, updatedConfigs };
          }
      } catch {
          if (!silent && loadingToast) toast.dismiss(loadingToast);
          if (!silent) toast.error('连接测试发生异常');
          return { success: false, error: '连接测试请求失败' };
      } finally {
          setTesting(false);
      }
  }

  return {
    configs,
    activeId,
    selectedId,
    setSelectedId,
    loading,
    testing,
    createConfig,
    deleteConfig,
    updateSelectedConfig,
    activateConfig,
    saveConfigs,
    testMinioConnection
  };
}
