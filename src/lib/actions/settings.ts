'use server';

import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';

const ALLOWED_ENV_KEYS = new Set([
  'BOX_CONFIG_JSON_BASE64',
  'BOX_DEVELOPER_TOKEN',
  'BOX_ENTERPRISE_ID',
  'BOX_CLIENT_ID',
  'BOX_CLIENT_SECRET',
  'GEMINI_API_KEY',
]);

const ENV_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

function sanitizeEnvValue(value: string): string {
  return value.replace(/[\r\n]/g, '').trim();
}

async function updateEnvFile(updates: Record<string, string | undefined>) {
    for (const key of Object.keys(updates)) {
      if (!ALLOWED_ENV_KEYS.has(key)) {
        throw new Error(`Env key not allowed: ${key}`);
      }
      if (!ENV_KEY_PATTERN.test(key)) {
        throw new Error(`Invalid env key format: ${key}`);
      }
    }

    const envPath = path.resolve(process.cwd(), '.env');
    let envConfig: Record<string, string> = {};

    try {
        const content = await fs.readFile(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const [lineKey, ...lineValParts] = trimmedLine.split('=');
                if (lineKey) {
                    envConfig[lineKey.trim()] = lineValParts.join('=').trim();
                }
            }
        });
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw e;
        }
    }

    for (const key in updates) {
        const value = updates[key];
        if (value === undefined) {
            delete envConfig[key];
        } else {
            envConfig[key] = sanitizeEnvValue(value);
        }
    }
    
    const newContent = Object.entries(envConfig)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');

    const tmpPath = `${envPath}.tmp`;
    await fs.writeFile(tmpPath, newContent);
    await fs.rename(tmpPath, envPath);
}


/**
 * A server action to securely update Box configuration settings.
 * It base64-encodes the JSON to safely store it in the .env file.
 */
export async function updateBoxSettings(settings: {
  authMethod: 'service-account' | 'developer-token';
  boxConfigJson?: string;
  boxDeveloperToken?: string;
  boxEnterpriseId?: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    if (settings.authMethod === 'service-account') {
        if (!settings.boxConfigJson || settings.boxConfigJson.trim().length === 0) {
            return { success: false, message: 'Configuration JSON cannot be empty for Service Account method.' };
        }
        try {
            JSON.parse(settings.boxConfigJson);
        } catch (e) {
            return { success: false, message: 'Invalid JSON. Please paste the entire content of your config.json file.' };
        }
        const base64Config = Buffer.from(settings.boxConfigJson).toString('base64');
        await updateEnvFile({
            'BOX_CONFIG_JSON_BASE64': base64Config,
            'BOX_DEVELOPER_TOKEN': undefined,
            'BOX_ENTERPRISE_ID': undefined,
        });

    } else if (settings.authMethod === 'developer-token') {
        if (!settings.boxDeveloperToken || !settings.boxEnterpriseId) {
            return { success: false, message: 'Developer Token and Enterprise ID are required.' };
        }
        await updateEnvFile({
            'BOX_DEVELOPER_TOKEN': settings.boxDeveloperToken,
            'BOX_ENTERPRISE_ID': settings.boxEnterpriseId,
            'BOX_CONFIG_JSON_BASE64': undefined,
        });
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Failed to update .env file', error instanceof Error ? error : { error });
    return {
      success: false,
      message: 'An unexpected error occurred while saving settings.',
    };
  }
}
