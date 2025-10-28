
'use server';

import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';

/**
 * Updates or removes key-value pairs in the .env file.
 * Reads the existing .env file, applies the given updates, and writes it back.
 * If a value for a key is `undefined`, the key is removed from the file.
 * @param updates An object where keys are env variable names and values are their new content.
 */
async function updateEnvFile(updates: Record<string, string | undefined>) {
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
            // If the error is anything other than "file not found", re-throw it.
            throw e;
        }
        // If file doesn't exist, we'll create it.
    }

    // Apply updates and deletions
    for (const key in updates) {
        const value = updates[key];
        if (value === undefined) {
            delete envConfig[key];
        } else {
            envConfig[key] = value;
        }
    }
    
    const newContent = Object.entries(envConfig)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');

    await fs.writeFile(envPath, newContent);
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
    logger.error('Failed to update .env file', error);
    return {
      success: false,
      message: 'An unexpected error occurred while saving settings.',
    };
  }
}
