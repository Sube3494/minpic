import { useState, useEffect } from 'react';
import { ShortlinkConfig } from '@/types/config';
import { configService } from '@/services/config.service';
import { toast } from 'sonner';

export function useShortlinkConfig() {
  const [shortlinkConfig, setShortlinkConfig] = useState<ShortlinkConfig>({
    apiUrl: '',
    apiKey: '',
    enabled: true,
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

  const saveShortlinkConfig = async (silent = false) => {
    // 验证: 如果启用了短链服务,必须填写必填字段
    if (shortlinkConfig.enabled) {
      if (!shortlinkConfig.apiUrl || !shortlinkConfig.apiKey) {
        toast.error('请填写完整配置信息', {
          description: '启用短链服务需要提供 API 地址和 API 密钥'
        });
        return;
      }
    }
    
    setLoading(true);
    try {
      await configService.saveShortlinkConfig(shortlinkConfig);
      if (!silent) {
        toast.success('短链配置已保存', {
          description: shortlinkConfig.enabled ? '短链服务已启用' : '短链服务已禁用'
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

  const testShortlinkConnection = async () => {
      setTesting(true);
      try {
          const success = await configService.testConnection('shortlink', shortlinkConfig);
          if (success) {
            toast.success('短链服务连接成功', {
              description: `API ${shortlinkConfig.apiUrl}`
            });
          } else {
            toast.error('短链服务连接失败', {
              description: '建议检查 API 地址、API 密钥和网络连接'
            });
          }
      } catch {
          toast.error('连接测试发生错误', {
            description: '请检查网络连接后重试'
          });
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
