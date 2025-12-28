import { useState, useEffect } from 'react';
import { ShortlinkConfig } from '@/types/config';
import { configService } from '@/services/config.service';
import { toast } from 'sonner';

export function useShortlinkConfig() {
  const [shortlinkConfig, setShortlinkConfig] = useState<ShortlinkConfig>({
    apiUrl: '',
    apiKey: '',
    enabled: true,
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

  const saveShortlinkConfig = async (updates?: Partial<ShortlinkConfig>, silent = false) => {
    const newConfig = { ...shortlinkConfig, ...updates };
    // 如果有更新，同时也更新本地状态
    if (updates) {
        setShortlinkConfig(newConfig);
    }

    setLoading(true);
    try {
      await configService.saveShortlinkConfig(newConfig);
      if (!silent) {
        toast.success('短链配置已保存', {
          description: newConfig.enabled ? '短链服务已启用' : '短链服务已禁用'
        });
      }
    } catch (error) {
      console.error('保存短链配置失败:', error);
      toast.error('保存短链配置失败', {
        description: '请检查网络连接后重试'
      });
    } finally {
      setLoading(false);
    }
  };

  const testShortlinkConnection = async (configToTest?: ShortlinkConfig): Promise<boolean> => {
      setTesting(true);
      const config = configToTest || shortlinkConfig;
      
      const loadingToast = toast.loading('正在测试连接，请稍候...', {
        description: '这可能需要一些时间，取决于网络状况'
      });
      
      try {
          const result = await configService.testConnection('shortlink', config);
          toast.dismiss(loadingToast);
          
          if (result.success) {
            const durationText = result.duration 
              ? `耗时 ${(result.duration / 1000).toFixed(1)} 秒`
              : '';
            toast.success('短链服务连接成功', {
              description: `API ${config.apiUrl}${durationText ? ` · ${durationText}` : ''}`
            });
            return true;
          } else {
            const timeoutHint = result.duration && result.duration >= 30000 
              ? '连接超时（30秒）' 
              : (result.error || '建议检查 API 地址、API 密钥和网络连接');
            toast.error('短链服务连接失败', {
              description: timeoutHint
            });
            return false;
          }
      } catch {
          toast.dismiss(loadingToast);
          toast.error('连接测试发生错误', {
            description: '请检查网络连接后重试'
          });
          return false;
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
