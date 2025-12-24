export interface ShortlinkConfig {
  apiUrl: string;
  apiKey: string;
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

  async createShortlink(url: string, customCode?: string): Promise<ShortlinkResponse> {
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
        ...(customCode && { short_code: customCode }),
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

  async testConnection(): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/api/list`, {
        headers: {
          'X-API-Key': this.config.apiKey,
        },
      });
      return response.ok;
    } catch {
      return false;
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
