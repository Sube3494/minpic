export interface ShortlinkConfig {
  apiUrl: string;
  apiKey: string;
  expiresIn?: number; // 过期时间(小时)
}

export interface ShortlinkResponse {
  short_code: string;
  short_url: string;
  original_url: string;
  created_at: string;
  click_count: number;
  last_accessed: string | null;
}

interface ShortlinkRequestBody {
  url: string;
  custom_code?: string;
  expires_in_minutes?: number;
  expires_in_hours?: number;
  expires_in_days?: number;
}

export class ShortlinkService {
  private config: ShortlinkConfig | null = null;

  setConfig(config: ShortlinkConfig): void {
    this.config = config;
  }



  async createShortlink(
    url: string, 
    customCode?: string, 
    expiresIn?: number,
    unit: 'minutes' | 'hours' | 'days' = 'hours'
  ): Promise<ShortlinkResponse> {
    if (!this.config) {
      throw new Error('Shortlink config not initialized');
    }

    const body: ShortlinkRequestBody = { url };

    if (customCode) {
      body.custom_code = customCode;
    }

    if (expiresIn !== undefined && expiresIn > 0) {
      if (unit === 'minutes') {
        body.expires_in_minutes = expiresIn;
      } else if (unit === 'days') {
        body.expires_in_days = expiresIn;
      } else {
        body.expires_in_hours = expiresIn;
      }
    }

    const response = await fetch(`${this.config.apiUrl}/api/shorten`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create shortlink: ${error}`);
    }

    return response.json();
  }

  async getShortlinkInfo(code: string): Promise<ShortlinkResponse> {
    if (!this.config) {
      throw new Error('Shortlink config not initialized');
    }

    const response = await fetch(`${this.config.apiUrl}/api/info/${code}`, {
      headers: {
        'X-API-Key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get shortlink info');
    }

    return response.json();
  }

  async deleteShortlink(code: string): Promise<void> {
    if (!this.config) {
      throw new Error('Shortlink config not initialized');
    }

    const response = await fetch(`${this.config.apiUrl}/api/${code}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete shortlink');
    }
  }

  async updateShortlink(code: string, expiresInHours?: number): Promise<ShortlinkResponse> {
    if (!this.config) {
      throw new Error('Shortlink config not initialized');
    }

    const body: { expires_in_hours?: number } = {};
    if (expiresInHours !== undefined && expiresInHours > 0) {
      body.expires_in_hours = expiresInHours;
    }
    // 如果 expiresInHours 为 undefined 或 0，发送空对象表示永不过期

    const response = await fetch(`${this.config.apiUrl}/api/${code}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update shortlink: ${error}`);
    }

    return response.json();
  }

  async listShortlinks(): Promise<ShortlinkResponse[]> {
    if (!this.config) {
      throw new Error('Shortlink config not initialized');
    }

    const response = await fetch(`${this.config.apiUrl}/api/list`, {
      headers: {
        'X-API-Key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to list shortlinks');
    }

    return response.json();
  }

  async testConnection(): Promise<{ success: boolean; duration?: number; error?: string }> {
    if (!this.config) {
      return { success: false, error: 'Shortlink config not initialized' };
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 秒超时

    try {
      const response = await fetch(`${this.config.apiUrl}/api/list`, {
        headers: {
          'X-API-Key': this.config.apiKey,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      if (!response.ok) {
          let errorMsg = `HTTP Error ${response.status}`;
          try {
             const text = await response.text();
             if (text) {
                 try {
                     const json = JSON.parse(text);
                     errorMsg = json.detail || json.error || json.message || text;
                 } catch {
                     errorMsg = text.slice(0, 100);
                 }
             }
          } catch {
              // Ignore body read error
          }
          return { success: false, duration, error: translateShortlinkError(errorMsg, response.status) };
      }
      
      return { success: true, duration };
    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      let errorMsg = String(error);
      if (error instanceof Error) {
          if (error.name === 'AbortError') {
            return { success: false, duration: 30000, error: '连接超时（30秒），请检查网络状况' };
          }
          errorMsg = error.message;
      }
      return { success: false, duration, error: translateShortlinkError(errorMsg) };
    }
  }
}

function translateShortlinkError(error: string, statusCode?: number): string {
  if (statusCode === 401 || error.includes('Unauthorized') || error.includes('invalid api key')) {
    return '认证失败：API 密钥无效或过期';
  }
  if (statusCode === 403 || error.includes('Forbidden')) {
    return '访问被拒绝：没有权限访问该接口';
  }
  if (statusCode === 404 || error.includes('Not Found')) {
    return '接口不存在：请检查 API 地址是否正确';
  }
  if (statusCode === 500) {
    return '短链服务内部错误 (500)';
  }
  if (error.includes('Failed to fetch') || error.includes('Network request failed') || error.includes('ENOTFOUND')) {
    return '网络连接失败：无法访问 API 地址，请检查域名和网络';
  }
  if (error.includes('timeout') || error.includes('ETIMEDOUT')) {
    return '连接超时：服务器响应过慢';
  }
  if (error.includes('Valid URL must be provided') || error.includes('Failed to parse URL')) {
      return 'API 地址格式错误，请检查是否包含 http:// 或 https://';
  }
  
  // 如果是未知错误，尝试保留原文但加个前缀或直接返回
  // 如果原文很短且全英文，可以加个通用前缀
  return error; // 这里直接返回，让用户看到具体英文可能更好，或者前面加 "错误: "
}

let shortlinkService: ShortlinkService | null = null;

export function getShortlinkService(): ShortlinkService {
  if (!shortlinkService) {
    shortlinkService = new ShortlinkService();
  }
  return shortlinkService;
}
