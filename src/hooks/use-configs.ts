import { useState, useEffect } from 'react';
import { MinioConfigItem } from '@/types/config';
import { fileService } from '@/services/file.service';

export function useConfigs() {
  const [configs, setConfigs] = useState<MinioConfigItem[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const data = await fileService.getConfigs();
        setConfigs(data.configs || []);
        if (data.activeId) {
          setSelectedConfigId(data.activeId);
        }
      } catch (error) {
        console.error('Failed to load configs', error);
        
        // 检测401错误，重定向到登录页面
        if (error instanceof Error && error.message.includes('401')) {
          window.location.href = '/auth/signin';
          return;
        }
      } finally {
        setConfigLoading(false);
      }
    };
    loadConfigs();
  }, []);

  return {
    configs,
    selectedConfigId,
    setSelectedConfigId,
    configLoading
  };
}
