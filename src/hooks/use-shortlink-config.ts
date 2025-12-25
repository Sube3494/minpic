import { useState, useEffect } from 'react';
import { ShortlinkConfig } from '@/types/config';
import { configService } from '@/services/config.service';
import { toast } from 'sonner';

export function useShortlinkConfig() {
  const [shortlinkConfig, setShortlinkConfig] = useState<ShortlinkConfig>({
    apiUrl: '',
    apiKey: '',
    autoGenerate: true,
    expiresIn: 0,
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await configService.getShortlinkConfig();
      if (data) setShortlinkConfig(data);
    } catch (error) {
       console.error('Error loading shortlink config:', error);
    }
  };

  const updateShortlinkConfig = (updates: Partial<ShortlinkConfig>) => {
    setShortlinkConfig(prev => ({ ...prev, ...updates }));
  };

  const saveShortlinkConfig = async () => {
    setLoading(true);
    try {
      await configService.saveShortlinkConfig(shortlinkConfig);
      toast.success('短链配置已保存');
    } catch {
      toast.error('保存短链配置失败');
    } finally {
      setLoading(false);
    }
  };

  const testShortlinkConnection = async () => {
      setTesting(true);
      try {
          const success = await configService.testConnection('shortlink', shortlinkConfig);
          if (success) toast.success('连接测试成功！');
          else toast.error('连接测试失败，请检查配置信息。');
      } catch {
          toast.error('连接测试发生错误');
      } finally {
          setTesting(false);
      }
  }

  return {
    shortlinkConfig,
    updateShortlinkConfig,
    saveShortlinkConfig,
    testShortlinkConnection,
    loading,
    testing
  };
}
