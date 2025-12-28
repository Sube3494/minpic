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

export class ShortlinkService {
  private config: ShortlinkConfig | null = null;

  setConfig(config: ShortlinkConfig): void {
    this.config = config;
  }

  async createShortlink(url: string, customCode?: string, expiresInHours?: number): Promise<ShortlinkResponse> {
    if (!this.config) {
      throw new Error('Shortlink config not initialized');
    }

    const response = await fetch(`${this.config.apiUrl}/api/shorten`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
      body: JSON.stringify({
        url,
        ...(customCode && { custom_code: customCode }),
        ...(expiresInHours && { expires_in_hours: expiresInHours }),
      }),
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

  async testConnection(): Promise<{ success: boolean; duration?: number }> {
    if (!this.config) {
      return { success: false };
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
      return { success: response.ok, duration };
    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      // 区分超时和其他错误
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, duration: 30000 };
      }
      return { success: false, duration };
    }
  }
}

let shortlinkService: ShortlinkService | null = null;

export function getShortlinkService(): ShortlinkService {
  if (!shortlinkService) {
    shortlinkService = new ShortlinkService();
  }
  return shortlinkService;
}
