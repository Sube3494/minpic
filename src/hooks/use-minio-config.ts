import { useState, useEffect, useCallback } from 'react';
import { MinioConfigItem, DEFAULT_MINIO_CONFIG } from '@/types/config';
import { configService } from '@/services/config.service';
import { toast } from 'sonner';

export function useMinioConfig() {
  const [configs, setConfigs] = useState<MinioConfigItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadConfigs = useCallback(async () => {
    const startTime = Date.now();
    setLoading(true);
    try {
      const data = await configService.getMinioConfigs();
      
      // Defer rendering until page transition is mostly complete
      const elapsed = Date.now() - startTime;
      const minLoadTime = 300;
      if (elapsed < minLoadTime) {
         await new Promise(resolve => setTimeout(resolve, minLoadTime - elapsed));
      }

      setConfigs(data.configs || []);
      setActiveId(data.activeId || '');
      // Only set selectedId if it's not already set
      setSelectedId(prev => {
        if (prev) return prev; // Keep existing selection
        return data.activeId || (data.configs?.[0]?.id ?? '');
      });
    } catch (error) {
      console.error('Error loading MinIO configs:', error);
      toast.error('无法加载配置信息');
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
    if (configs.length <= 1) {
      toast.error('无法删除最后一个配置');
      return;
    }
    if (id === activeId) {
      toast.error('无法删除当前激活的配置');
      return;
    }
    
    const newConfigs = configs.filter(c => c.id !== id);
    setConfigs(newConfigs);
    if (selectedId === id) {
      setSelectedId(newConfigs[0].id);
    }
  };

  const updateSelectedConfig = (updates: Partial<MinioConfigItem>) => {
    setConfigs(configs.map(c => c.id === selectedId ? { ...c, ...updates } : c));
  };

  const activateConfig = (id: string) => {
    setActiveId(id);
    toast.info('已设为激活状态，由于尚未保存，请点击右上角"保存所有更改"以生效。');
  };

  const saveConfigs = async () => {
    setLoading(true);
    try {
      await configService.saveMinioConfigs(configs, activeId);
      toast.success('MinIO 配置已保存');
    } catch (error) {
       console.error(error);
       toast.error('保存 MinIO 配置失败');
    } finally {
      setLoading(false);
    }
  };
  
  const testMinioConnection = async () => {
      const config = configs.find(c => c.id === selectedId);
      if (!config) return;

      setTesting(true);
      try {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, name, ...rest } = config; 
          const success = await configService.testConnection('minio', rest);
          if (success) toast.success('连接测试成功！');
          else toast.error('连接测试失败，请检查配置信息。');
      } catch {
          toast.error('连接测试发生错误');
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
