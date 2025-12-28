import { useState, useEffect, useCallback } from 'react';
import { MinioConfigItem, DEFAULT_MINIO_CONFIG } from '@/types/config';
import { configService } from '@/services/config.service';
import { toast } from 'sonner';

export function useMinioConfig() {
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

  const deleteConfig = (id: string) => {
    const newConfigs = configs.filter(c => c.id !== id);
    setConfigs(newConfigs);
    
    if (selectedId === id) {
      setSelectedId(newConfigs.length > 0 ? newConfigs[0].id : '');
    }
    
    if (activeId === id) {
      setActiveId('');
    }
  };

  const updateSelectedConfig = (updates: Partial<MinioConfigItem>) => {
    setConfigs(configs.map(c => c.id === selectedId ? { ...c, ...updates } : c));
  };

  const activateConfig = async (id: string) => {
    const newActiveId = activeId === id ? '' : id;
    const oldActiveId = activeId;
    setActiveId(newActiveId);
    
    setLoading(true);
    try {
      await configService.saveMinioConfigs(configs, newActiveId);
      setOriginalActiveId(newActiveId);
      setActiveIdChanged(false);
      
      if (newActiveId === '') {
        toast.success('已取消激活配置', {
          description: '当前无激活的 MinIO 配置'
        });
      } else {
        const configName = configs.find(c => c.id === id)?.name || '未命名配置';
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
  
  const testMinioConnection = async () => {
      const config = configs.find(c => c.id === selectedId);
      if (!config) return;

      setTesting(true);
      const loadingToast = toast.loading('正在测试连接，请稍候...', {
        description: '这可能需要一些时间，取决于网络状况'
      });
      
      try {
          const result = await configService.testConnection('minio', config);
          toast.dismiss(loadingToast);
          
          if (result.success) {
            const durationText = result.duration 
              ? `耗时 ${(result.duration / 1000).toFixed(1)} 秒`
              : '';
            toast.success(`${config.name} 连接测试成功`, {
              description: `已验证存储桶 ${config.bucket}${durationText ? ` · ${durationText}` : ''}`
            });
            
            // 更新配置状态为成功
            setConfigs(prev => prev.map(c => 
              c.id === selectedId ? { ...c, status: 'success' as const } : c
            ));
          } else {
            toast.error(`${config.name} 连接测试失败`, {
              description: result.error || '建议检查 Endpoint、Access Key、Secret Key 和 Bucket 名称'
            });
            
            // 更新配置状态为失败
            setConfigs(prev => prev.map(c => 
              c.id === selectedId ? { ...c, status: 'error' as const } : c
            ));
          }
      } catch {
          toast.dismiss(loadingToast);
          toast.error('连接测试发生错误', {
            description: '请检查网络连接后重试'
          });
          
          // 更新配置状态为失败
          setConfigs(prev => prev.map(c => 
            c.id === selectedId ? { ...c, status: 'error' as const } : c
          ));
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
