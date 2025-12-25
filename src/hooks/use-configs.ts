import { useState, useEffect } from 'react';
import { MinioConfig } from '@/types/file';
import { fileService } from '@/services/file.service';

export function useConfigs() {
  const [configs, setConfigs] = useState<MinioConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const data = await fileService.getConfigs();
        setConfigs(data.configs || []);
        if (data.activeId) {
          setSelectedConfigId(data.activeId);
        } else if (data.configs && data.configs.length > 0) {
          setSelectedConfigId(data.configs[0].id);
        }
      } catch (error) {
        console.error('Failed to load configs', error);
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
