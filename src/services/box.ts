
'use server';

import { config } from 'dotenv';
config();

import type { BoxTemplate, BoxFile } from '@/lib/types';
import type { BoxAIField } from '@/lib/schemas';
import BoxSDK from 'box-node-sdk';
import { getOAuthAccessToken, isOAuthConnected } from './oauth';
import { boxLogger } from '@/lib/logger';

const BOX_API_BASE_URL = 'https://api.box.com/2.0';
const BOX_UPLOAD_BASE_URL = 'https://upload.box.com/api/2.0';
const BLANK_FILE_NAME = process.env.BOX_BLANK_FILE_NAME || '~BLANK_FILE_FOR_OPTIMIZER_AI.txt';
const BLANK_FILE_FOLDER_ID = process.env.BOX_BLANK_FILE_FOLDER_ID || '0';

// SECURITY NOTE: DO NOT cache tokens at the module level in serverless environments!
// Module-level variables persist across requests from DIFFERENT users on Vercel,
// which would cause User B to see User A's Box folders (cross-user data leakage).
// 
// Instead, we rely on:
// 1. OAuth tokens stored in HTTP-only cookies (per-user, handled by oauth.ts)
// 2. Service Account/Developer tokens from env vars (shared intentionally)
//
// The slight performance cost of not caching is worth the security guarantee.

type BoxTemplatesResponse = {
  entries: BoxTemplate[];
};

type BoxFolderItemsResponse = {
  entries: (BoxFile | BoxFolder)[];
};

type BoxSearchEntry = {
  id: string;
  name: string;
  type: 'file' | string;
  size?: number;
  item_status?: 'active' | 'trashed' | string;
};

type BoxSearchResponse = {
  entries: BoxSearchEntry[];
};

type BoxUploadResponse = {
  entries?: Array<{
    id: string;
    name: string;
    type: 'file';
    size?: number;
  }>;
};

type BoxFolder = {
  id: string;
  name: string;
  type: 'folder';
};

type BoxMetadataTemplateCreateRequest = {
  scope: 'enterprise';
  displayName: string;
  templateKey?: string;
  copyInstanceOnItemCopy?: boolean;
  fields: Array<{
    type: 'string' | 'float' | 'date' | 'enum' | 'multiSelect';
    key: string;
    displayName: string;
    description?: string;
    hidden?: boolean;
    options?: Array<{ key: string }>;
  }>;
};

type BoxMetadataTemplateResponse = {
  id: string;
  type: string;
  scope: string;
  templateKey: string;
  displayName: string;
  hidden: boolean;
  fields: Array<{
    id: string;
    type: string;
    key: string;
    displayName: string;
    description?: string;
    hidden: boolean;
    options?: Array<{ id: string; key: string }>;
  }>;
};

/**
 * Gets a valid access token for the Box API.
 * It checks for OAuth2.0 tokens first (per-user via cookies), then Service Account config, 
 * then falls back to Developer Token.
 * 
 * SECURITY: Tokens are NOT cached at module level to prevent cross-user data leakage
 * in serverless environments like Vercel where function instances are reused.
 */
async function getAccessToken(): Promise<string> {
    // Check OAuth2.0 first - this reads from per-user HTTP-only cookies
    if (await isOAuthConnected()) {
        const oauthToken = await getOAuthAccessToken();
        if (oauthToken) {
            boxLogger.debug('Using OAuth2.0 token from user cookies');
            return oauthToken;
        }
    }
    
    // Service Account and Developer Token are shared credentials from env vars
    // These are intentionally shared across all users (not user-specific)
    const boxConfigBase64 = process.env.BOX_CONFIG_JSON_BASE64;
    const developerToken = process.env.BOX_DEVELOPER_TOKEN;

    if (boxConfigBase64) {
        try {
            const configJson = Buffer.from(boxConfigBase64, 'base64').toString('utf-8');
            const boxConfig = JSON.parse(configJson);

            const sdk = new BoxSDK({ boxConfig });
            const tokenInfo = await sdk.getAppUserTokens(boxConfig.enterpriseID);
            
            boxLogger.debug('Using Service Account token');
            return tokenInfo.accessToken;
        } catch (error) {
             boxLogger.error("Failed to get access token using Service Account", error as Error);
             throw new Error('The stored Service Account configuration is invalid. Please save it again on the Settings page.');
        }
    }

    if (developerToken) {
        boxLogger.debug('Using Developer token');
        return developerToken;
    }
    
    throw new Error('No Box authentication method is configured. Please provide credentials on the Settings page or connect via OAuth2.0.');
}

/**
 * Clears the cached token - NO-OP since we no longer cache tokens at module level.
 * Kept for backwards compatibility with any code that calls this.
 */
export async function clearTokenCache(): Promise<void> {
    // No-op: tokens are no longer cached at module level for security reasons
    boxLogger.debug('clearTokenCache called (no-op - tokens not cached at module level)');
}

/**
 * Clears the cached blank placeholder file ID - NO-OP since we no longer cache.
 * Kept for backwards compatibility.
 */
export async function clearBlankPlaceholderFileCache(): Promise<void> {
    // No-op: placeholder file ID is no longer cached at module level for security reasons
    boxLogger.debug('clearBlankPlaceholderFileCache called (no-op)');
}

/**
 * Ensures a blank placeholder file exists in Box and returns its ID.
 * 
 * NOTE: This now searches for the file on every call instead of caching.
 * This is intentional to prevent cross-user issues in serverless environments.
 * The search is fast and the file is rarely needed.
 */
export async function getBlankPlaceholderFileId(options: { refresh?: boolean } = {}): Promise<string> {
    // Always search for the file - no caching to prevent cross-user issues
    return await ensureBlankPlaceholderFileExists();
}

async function ensureBlankPlaceholderFileExists(): Promise<string> {
    const existing = await findExistingBlankPlaceholderFile();
    if (existing) {
        boxLogger.debug(`Using existing blank placeholder file ${existing.id}`);
        return existing.id;
    }

    const created = await createBlankPlaceholderFile();
    boxLogger.info(`Created new blank placeholder file ${created.id}`);
    return created.id;
}

async function findExistingBlankPlaceholderFile(): Promise<BoxFile | null> {
    try {
        const response: BoxSearchResponse = await boxApiFetch(`/search?query=${encodeURIComponent(BLANK_FILE_NAME)}&type=file&content_types=name&fields=id,name,size,item_status&limit=10`, { method: 'GET' });
        const entries = response?.entries ?? [];
        const match = entries.find(entry =>
            entry.type === 'file' &&
            entry.name === BLANK_FILE_NAME &&
            entry.item_status !== 'trashed'
        );

        if (!match) {
            return null;
        }

        const isEmpty = await verifyFileIsZeroBytes(match.id);
        if (!isEmpty) {
            boxLogger.warn(`Blank placeholder file ${match.id} is not empty (size=${match.size}). It will be recreated.`);
            return null;
        }

        return { id: match.id, name: match.name, type: 'file' };
    } catch (error) {
        boxLogger.error('Failed to search for blank placeholder file', error instanceof Error ? error : { error });
        throw error;
    }
}

async function verifyFileIsZeroBytes(fileId: string): Promise<boolean> {
    try {
        const fileInfo = await boxApiFetch(`/files/${fileId}?fields=id,name,size`, { method: 'GET' });
        const size = typeof fileInfo?.size === 'number' ? fileInfo.size : null;
        const isEmpty = size === 0;
        if (!isEmpty) {
            boxLogger.warn(`Placeholder file ${fileId} has unexpected size (${size}).`);
        }
        return isEmpty;
    } catch (error) {
        boxLogger.warn('Unable to verify placeholder file size. It will be recreated.', error instanceof Error ? error : { error });
        return false;
    }
}

async function createBlankPlaceholderFile(): Promise<BoxFile> {
    const accessToken = await getAccessToken();
    const formData = new FormData();
    formData.append('attributes', JSON.stringify({
        name: BLANK_FILE_NAME,
        parent: { id: BLANK_FILE_FOLDER_ID }
    }));
    const emptyBlob = new Blob([''], { type: 'text/plain' });
    formData.append('file', emptyBlob, BLANK_FILE_NAME);

    const response = await fetch(`${BOX_UPLOAD_BASE_URL}/files/content`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
    });

    const responseText = await response.text();

    if (response.ok) {
        const uploadData: BoxUploadResponse = parseUploadResponse(responseText);
        const createdEntry = uploadData.entries?.[0];
        if (createdEntry?.id) {
            return { id: createdEntry.id, name: createdEntry.name, type: 'file' };
        }
        throw new Error('Box upload response missing file entry');
    }

    if (response.status === 409) {
        const conflictEntry = extractConflictEntry(responseText);
        if (conflictEntry?.id) {
            const verified = await verifyFileIsZeroBytes(conflictEntry.id);
            if (verified) {
                boxLogger.warn(`Encountered name conflict while creating placeholder, reusing existing file ${conflictEntry.id}`);
                return { id: conflictEntry.id, name: conflictEntry.name, type: 'file' };
            }
        }
    }

    throw new Error(`Failed to create blank placeholder file: ${response.status} ${response.statusText}. Details: ${responseText}`);
}

function parseUploadResponse(responseText: string): BoxUploadResponse {
    try {
        return JSON.parse(responseText);
    } catch (error) {
        boxLogger.error('Failed to parse Box upload response', error as Error);
        throw new Error('Invalid Box upload response');
    }
}

function extractConflictEntry(responseText: string): BoxSearchEntry | null {
    try {
        const parsed = JSON.parse(responseText);
        let conflicts = parsed?.context_info?.conflicts;
        if (!conflicts) {
            return null;
        }

        if (!Array.isArray(conflicts)) {
            conflicts = [conflicts];
        }

        const conflict = conflicts.find(
            (entry: BoxSearchEntry) =>
                entry?.type === 'file' &&
                entry?.name === BLANK_FILE_NAME
        );

        return conflict ?? null;
    } catch (error) {
        boxLogger.warn('Failed to parse conflict response for placeholder upload', error as Error);
        return null;
    }
}

// Export function to get access token for external use
export async function getBoxAccessToken(): Promise<string> {
    return await getAccessToken();
}

// Retry configuration for Box API calls
const RETRY_CONFIG = {
    maxRetries: 5,           // Increased from 3 for rate limit recovery
    initialDelayMs: 2000,    // Increased from 1000 for better recovery
    maxDelayMs: 30000,       // Increased from 10000 (30 sec max wait)
    backoffMultiplier: 2,
    // Status codes that should trigger a retry
    retryableStatusCodes: [
        429, // Rate limit exceeded
        500, // Internal server error
        502, // Bad gateway
        503, // Service unavailable
        504, // Gateway timeout
    ],
};

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable based on status code
 */
function isRetryableError(status: number): boolean {
    return RETRY_CONFIG.retryableStatusCodes.includes(status);
}

/**
 * Calculate delay for exponential backoff with jitter
 */
function calculateBackoffDelay(attempt: number): number {
    const baseDelay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
    const jitter = Math.random() * 0.3 * baseDelay; // Add up to 30% jitter
    return Math.min(baseDelay + jitter, RETRY_CONFIG.maxDelayMs);
}

// Centralized fetch function for Box API calls with retry logic
export async function boxApiFetch(path: string, options: RequestInit = {}) {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            const accessToken = await getAccessToken();

            const defaultHeaders: Record<string, string> = {
                'Authorization': `Bearer ${accessToken}`,
            };

            if (options.body) {
                defaultHeaders['Content-Type'] = 'application/json';
            }

            const response = await fetch(`${BOX_API_BASE_URL}${path}`, {
                ...options,
                headers: {
                    ...defaultHeaders,
                    ...options.headers,
                },
                cache: 'no-store',
            });

            const responseText = await response.text();

            if (!response.ok) {
                const errorData = responseText;
                
                // Check if this is a retryable error
                if (isRetryableError(response.status) && attempt < RETRY_CONFIG.maxRetries) {
                    const delayMs = calculateBackoffDelay(attempt);
                    boxLogger.warn(`Box API Error (retryable) on path ${path}`, { 
                        status: response.status, 
                        attempt: attempt + 1, 
                        maxRetries: RETRY_CONFIG.maxRetries,
                        retryingIn: `${delayMs}ms`
                    });
                    await sleep(delayMs);
                    continue; // Retry
                }
                
                // Non-retryable error or max retries exceeded
                boxLogger.error(`Box API Error on path ${path}`, { 
                    status: response.status, 
                    data: errorData, 
                    options,
                    attempt: attempt + 1,
                    retriesExhausted: attempt >= RETRY_CONFIG.maxRetries
                });
                
                let errorMessage = `Failed to call Box API on path ${path}: ${response.status} ${response.statusText}`;
                try {
                    const parsedError = JSON.parse(errorData);
                    if (parsedError && parsedError.message) {
                        errorMessage += `. Details: ${parsedError.message}`;
                    } else {
                        errorMessage += `. Details: ${errorData}`;
                    }
                } catch (e) {
                    errorMessage += `. Details: ${errorData}`;
                }
                
                if (attempt > 0) {
                    errorMessage += ` (after ${attempt + 1} attempts)`;
                }
                
                throw new Error(errorMessage);
            }
            
            // Success - log if we had to retry
            if (attempt > 0) {
                boxLogger.info(`Box API call succeeded after ${attempt + 1} attempts`, { path });
            }
            
            if (!responseText) {
                return null;
            }
            
            return JSON.parse(responseText);
            
        } catch (error) {
            // Handle network errors (fetch failures, timeouts, etc.)
            if (error instanceof TypeError || (error as Error).message?.includes('fetch')) {
                if (attempt < RETRY_CONFIG.maxRetries) {
                    const delayMs = calculateBackoffDelay(attempt);
                    boxLogger.warn(`Network error on Box API call (retrying)`, { 
                        path, 
                        error: (error as Error).message,
                        attempt: attempt + 1,
                        retryingIn: `${delayMs}ms`
                    });
                    await sleep(delayMs);
                    lastError = error as Error;
                    continue; // Retry
                }
            }
            
            // Non-retryable error or already a processed Box API error
            throw error;
        }
    }
    
    // Should not reach here, but just in case
    throw lastError || new Error(`Box API call failed after ${RETRY_CONFIG.maxRetries + 1} attempts`);
}


export async function getTemplates(): Promise<BoxTemplate[]> {
  try {
    const data: BoxTemplatesResponse = await boxApiFetch(`/metadata_templates/enterprise`, { method: 'GET' });
    
    // Log enum field options for debugging
    data.entries.forEach(template => {
      const enumFields = template.fields?.filter(f => f.type === 'enum' || f.type === 'multiSelect');
      if (enumFields && enumFields.length > 0) {
        enumFields.forEach(field => {
          boxLogger.debug('Enum/MultiSelect field loaded from Box', {
            template: template.displayName,
            field: field.displayName,
            type: field.type,
            optionCount: field.options?.length || 0,
            options: field.options?.map(o => o.key).join(', ') || 'none'
          });
        });
      }
    });
    
    return data.entries
        .filter(t => t.displayName)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

  } catch (error) {
    boxLogger.error('Error fetching templates from Box', error instanceof Error ? error : { error });
    throw error;
  }
}

/**
 * Create a new metadata template in Box
 */
export async function createMetadataTemplate(templateData: BoxMetadataTemplateCreateRequest): Promise<BoxMetadataTemplateResponse> {
  try {
    boxLogger.info('Creating Box metadata template', { displayName: templateData.displayName });
    
    const response = await boxApiFetch('/metadata_templates/schema', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(templateData),
    });

    boxLogger.info('Successfully created Box metadata template', { templateKey: response.templateKey });
    return response;
  } catch (error) {
    boxLogger.error('Error creating metadata template in Box', error instanceof Error ? error : { error });
    throw error;
  }
}

/**
 * Check if a metadata template with the given name already exists in Box
 */
export async function checkTemplateExists(templateName: string): Promise<boolean> {
  try {
    const templates = await getTemplates();
    return templates.some(template => 
      template.displayName.toLowerCase() === templateName.toLowerCase()
    );
  } catch (error) {
    boxLogger.error('Error checking if template exists', error instanceof Error ? error : { error });
    throw error;
  }
}

export async function getFolderItems(folderId: string): Promise<BoxFile[]> {
  try {
    const data: BoxFolderItemsResponse = await boxApiFetch(`/folders/${folderId}/items?fields=id,name,type`, { method: 'GET' });
    
    // Log what we're getting from Box API to see folders
    boxLogger.debug(`Box API Response for folder ${folderId}`);
    boxLogger.debug('All items', { count: data.entries.length });
    boxLogger.debug('Files', { count: data.entries.filter(item => item.type === 'file').length });
    boxLogger.debug('Folders', { count: data.entries.filter(item => item.type === 'folder').length });
    
    return data.entries
        .filter((item): item is BoxFile => item.type === 'file')
        .sort((a, b) => a.name.localeCompare(b.name));

  } catch (error) {
    boxLogger.error('Error fetching folder items from Box', error instanceof Error ? error : { error });
    throw error;
  }
}

export async function getFolderContents(folderId: string): Promise<{
  files: BoxFile[];
  folders: BoxFolder[];
}> {
  try {
    const data: BoxFolderItemsResponse = await boxApiFetch(`/folders/${folderId}/items?fields=id,name,type`, { method: 'GET' });
    
    const files = data.entries
        .filter((item): item is BoxFile => item.type === 'file')
        .sort((a, b) => a.name.localeCompare(b.name));
        
    const folders = data.entries
        .filter((item): item is BoxFolder => item.type === 'folder')
        .sort((a, b) => a.name.localeCompare(b.name));
    
    boxLogger.debug(`Folder ${folderId} contents`, { files: files.length, folders: folders.length });
    
    return { files, folders };

  } catch (error) {
    boxLogger.error('Error fetching folder contents from Box', error instanceof Error ? error : { error });
    throw error;
  }
}

export async function getBoxFileContent(fileId: string): Promise<string> {
    try {
        // First, try to get the text representation of the file using cached token
        const fileInfo = await boxApiFetch(`/files/${fileId}?fields=representations`, {
            method: 'GET',
            headers: {
                'x-rep-hints': '[extracted_text]'
            },
        });

        if (fileInfo) {
            boxLogger.debug(`File ${fileId} representations available`);
            
            // Look for extracted text representation
            const textRep = fileInfo.representations?.entries?.find(
                (rep: any) => rep.representation === 'extracted_text'
            );
            
            if (textRep && textRep.content && textRep.content.url_template) {
                // Get the actual text content (this URL is external to Box API, so we need a direct fetch)
                const accessToken = await getAccessToken();
                const textContentUrl = textRep.content.url_template.replace('{+asset_path}', '');
                const contentResponse = await fetch(textContentUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                });
                
                if (contentResponse.ok) {
                    const content = await contentResponse.text();
                    boxLogger.debug(`File ${fileId} extracted text`, { length: content.length });
                    boxLogger.debug(`File ${fileId} text preview`, { preview: content.substring(0, 100) + '...' });
                    return content;
                }
            }
        }
        
        // Fallback: Use Box AI to extract text
        boxLogger.info(`Using Box AI fallback for text extraction`, { fileId });
        const aiResponse = await boxApiFetch(`/ai/text_gen`, {
            method: 'POST',
            body: JSON.stringify({
                items: [{ id: fileId, type: 'file' }],
                dialogue_history: [],
                prompt: 'Please extract and return the complete text content of this document exactly as it appears, maintaining all formatting and structure. Do not summarize or modify the text in any way.'
            }),
        });
        
        if (aiResponse?.answer) {
            boxLogger.debug(`File ${fileId} AI extracted text`, { length: aiResponse.answer.length });
            boxLogger.debug(`File ${fileId} AI text preview`, { preview: aiResponse.answer.substring(0, 100) + '...' });
            return aiResponse.answer;
        }
        
        throw new Error('Could not extract text content from document');

    } catch (error) {
        boxLogger.error(`Error fetching content for file ${fileId} from Box`, error instanceof Error ? error : { error });
        throw error;
    }
}

// Debug function to test file content extraction
export async function debugFileContent(fileId: string): Promise<void> {
    try {
        boxLogger.debug('Debugging file content', { fileId });
        
        // Test file info
        const fileInfo = await boxApiFetch(`/files/${fileId}?fields=name,size,type,extension`, { method: 'GET' });
        boxLogger.debug('File info retrieved', fileInfo);
        
        // Test content extraction
        const content = await getBoxFileContent(fileId);
        boxLogger.debug('Content extracted', { 
            contentLength: content.length,
            contentPreview: content.substring(0, 1000)
        });
        
        boxLogger.debug('Debug complete', { fileId });
    } catch (error) {
        boxLogger.error('Debug failed', error instanceof Error ? error : { error });
    }
}


type BoxAIExtractParams = {
  fileId: string;
  fields?: BoxAIField[];
  model: string;
  templateKey?: string;
};

type BoxAIExtractRequestBody = {
    items: {id: string, type: 'file'}[];
    fields?: BoxAIField[];
    metadata_template?: {
        template_key: string;
        scope: 'enterprise';
    };
    include_confidence_score?: boolean;
    ai_agent?: {
        id: string;
        type: 'ai_agent_id';
    } | {
        type: 'ai_agent_extract_structured';
        basic_text: {
            model: string;
        };
        basic_image: {
            model: string;
        };
        long_text: {
            model: string;
        };
    };
}

// Return type for extraction with confidence scores
export type BoxAIExtractionResult = {
    extractedData: Record<string, any>;
    confidenceScores?: Record<string, number>;
}

// Configuration for Box AI extraction with retry and timeout
// OPTIMIZED: Reduced timeouts and retries to fail faster and not block UI
const BOX_AI_EXTRACTION_CONFIG = {
  maxRetries: 2, // Reduced from 3 - fail faster if Box is struggling with a file
  initialDelayMs: 2000, // Reduced from 3000 - faster retry cycles
  maxDelayMs: 10000, // Reduced from 60000 - don't wait too long between retries
  backoffMultiplier: 2,
  timeoutMs: 180000, // Reduced from 900000 (15 min) to 180000 (3 min) - faster timeout per file
  retryableStatusCodes: [502, 503, 504], // Removed 500 - Box 500 errors on specific files won't recover with retries
};

export async function extractStructuredMetadataWithBoxAI(
  { fileId, fields, model, templateKey }: BoxAIExtractParams
): Promise<BoxAIExtractionResult> {
  
  let lastError: Error | null = null;
  
  // Retry loop for Box AI extraction
  for (let attempt = 0; attempt <= BOX_AI_EXTRACTION_CONFIG.maxRetries; attempt++) {
    try {
      const requestBody: BoxAIExtractRequestBody = {
        items: [{ id: fileId, type: 'file' as const }],
        include_confidence_score: true,
      };
      
      // CRITICAL FIX: Use Box metadata template when available
      if (templateKey) {
        boxLogger.debug('Using Box metadata template', { templateKey });
        requestBody.metadata_template = {
          template_key: templateKey,
          scope: 'enterprise'
        };
      } else if (fields) {
        boxLogger.debug('Using inline field definitions (fallback)');
        requestBody.fields = fields;
      } else {
        throw new Error('Either templateKey or fields must be provided');
      }
      
      // Use correct AI agent format for model specification
      if (model === 'enhanced_extract_agent') {
        // Use predefined enhanced extract agent
        requestBody.ai_agent = {
          id: 'enhanced_extract_agent',
          type: 'ai_agent_id' as const
        };
        boxLogger.debug(`Using Enhanced Extract Agent`, { fileId });
      } else {
        // Use AI agent configuration with specific model override
        requestBody.ai_agent = {
          type: 'ai_agent_extract_structured',
          basic_text: {
            model: model
          },
          basic_image: {
            model: model
          },
          long_text: {
            model: model
          }
        };
        boxLogger.debug(`Using custom AI agent with model`, { model, fileId });
      }

      // Calculate and log request size for diagnostics
      const requestBodyStr = JSON.stringify(requestBody);
      const requestSizeKB = Math.round(new Blob([requestBodyStr]).size / 1024);
      const fieldCount = fields?.length || 0;
      const totalPromptChars = fields?.reduce((sum, f) => sum + (f.prompt?.length || 0), 0) || 0;

      boxLogger.info('Box AI extraction request prepared', { 
        model, 
        fileId, 
        hasTemplate: !!templateKey,
        fieldCount,
        requestSizeKB,
        totalPromptChars,
        attempt: attempt + 1,
        maxRetries: BOX_AI_EXTRACTION_CONFIG.maxRetries + 1
      });

      // Call Box AI API with timeout handling
      const accessToken = await getAccessToken();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BOX_AI_EXTRACTION_CONFIG.timeoutMs);
      
      const startTime = Date.now();
      
      try {
        const response = await fetch(`${BOX_API_BASE_URL}/ai/extract_structured`, {
          method: 'POST',
          body: requestBodyStr,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        
        const rawResponseText = await response.text();
        
        boxLogger.debug('Box AI response received', { 
          model, 
          fileId, 
          status: response.status, 
          responseLength: rawResponseText.length,
          durationMs: duration,
          attempt: attempt + 1
        });
        
        // Check for HTTP errors
        if (!response.ok) {
          const isRetryable = BOX_AI_EXTRACTION_CONFIG.retryableStatusCodes.includes(response.status);
          
          boxLogger.error(`Box AI HTTP error ${response.status} for model "${model}"`, new Error(rawResponseText.substring(0, 500)));
          
          // If this is a retryable error and we have retries left, continue to retry logic
          if (isRetryable && attempt < BOX_AI_EXTRACTION_CONFIG.maxRetries) {
            const delayMs = Math.min(
              BOX_AI_EXTRACTION_CONFIG.initialDelayMs * Math.pow(BOX_AI_EXTRACTION_CONFIG.backoffMultiplier, attempt),
              BOX_AI_EXTRACTION_CONFIG.maxDelayMs
            );
            
            boxLogger.warn(`Box AI extraction failed with ${response.status}, retrying in ${delayMs}ms`, {
              fileId,
              model,
              attempt: attempt + 1,
              maxRetries: BOX_AI_EXTRACTION_CONFIG.maxRetries + 1,
              nextRetryIn: `${delayMs}ms`
            });
            
            await sleep(delayMs);
            lastError = new Error(`Box AI API returned ${response.status}: ${response.statusText}. Response: ${rawResponseText}`);
            continue; // Retry
          }
          
          // Non-retryable or max retries exceeded
          throw new Error(`Box AI API returned ${response.status}: ${response.statusText}. Response: ${rawResponseText}`);
        }
        
        // Success - log if we had to retry
        if (attempt > 0) {
          boxLogger.info(`Box AI extraction succeeded after ${attempt + 1} attempts`, { 
            fileId, 
            model,
            totalDuration: duration 
          });
        }
        
        // Parse the response
        let result;
        try {
          result = JSON.parse(rawResponseText);
        } catch (parseError) {
          boxLogger.error(`Box AI JSON parse error for model "${model}"`, parseError as Error);
          throw new Error(`Failed to parse Box AI response: ${parseError}`);
        }
        
        boxLogger.debug('Box AI response parsed successfully', { 
          model, 
          fileId, 
          hasAnswer: !!result?.answer, 
          hasEntries: !!result?.entries, 
          hasConfidenceScore: !!result?.confidence_score 
        });

        // Handle Box AI response formats - simplified based on actual API behavior
        let extractedData: Record<string, any> = {};
        let confidenceScores: Record<string, number> | undefined = result?.confidence_score;
        
        // Log confidence scores if present
        if (confidenceScores) {
          boxLogger.debug('Confidence scores received', { fileId, model, scores: confidenceScores });
        }
        
        // Check for the most common response format first (what we see in logs)
        if (result?.answer && typeof result.answer === 'object') {
          extractedData = result.answer;
          boxLogger.info(`Successfully extracted data using model "${model}"`, { 
            fileId, 
            fieldCount: Object.keys(extractedData).length,
            extractionPath: 'answer field',
            hasConfidenceScores: !!confidenceScores,
            attemptNumber: attempt + 1
          });
          return { extractedData, confidenceScores };
        }
        
        // Handle array response format
        if (Array.isArray(result)) {
          const firstResult = result[0];
          if (firstResult?.success) {
            extractedData = firstResult.extractedMetadata || firstResult.answer || {};
            confidenceScores = firstResult.confidence_score || confidenceScores;
          } else {
            throw new Error(`Box AI extraction failed: ${firstResult?.error || 'Unknown error'}`);
          }
          boxLogger.info(`Successfully extracted data using model "${model}"`, { 
            fileId, 
            fieldCount: Object.keys(extractedData).length,
            extractionPath: 'array format',
            hasConfidenceScores: !!confidenceScores,
            attemptNumber: attempt + 1
          });
          return { extractedData, confidenceScores };
        }
        
        // Handle entries array format (legacy)
        if (result?.entries?.[0]) {
          const firstResult = result.entries[0];
          if (firstResult?.status === 'error') {
            const errorMessage = `Box AI failed to extract metadata: ${firstResult.message || 'An unknown error occurred.'}`;
            boxLogger.error(errorMessage, new Error(JSON.stringify({ requestBody, result })));
            throw new Error(errorMessage);
          }
          extractedData = firstResult?.answer || {};
          confidenceScores = firstResult.confidence_score || confidenceScores;
          boxLogger.info(`Successfully extracted data using model "${model}"`, { 
            fileId, 
            fieldCount: Object.keys(extractedData).length,
            extractionPath: 'entries format',
            hasConfidenceScores: !!confidenceScores,
            attemptNumber: attempt + 1
          });
          return { extractedData, confidenceScores };
        }
        
        // Fallback: try other possible response formats
        extractedData = result?.extractedMetadata || result?.data || {};
        
        if (Object.keys(extractedData).length === 0) {
          boxLogger.warn('No extractable data found in Box AI response', { model, fileId, result });
          throw new Error('Box AI returned an unexpected response format. No extractable data found.');
        }

        boxLogger.info(`Successfully extracted data using model "${model}"`, { 
          fileId, 
          fieldCount: Object.keys(extractedData).length,
          extractionPath: 'fallback format',
          hasConfidenceScores: !!confidenceScores,
          attemptNumber: attempt + 1
        });
        
        return { extractedData, confidenceScores };
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        // Handle timeout errors
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          const timeoutMinutes = Math.round(BOX_AI_EXTRACTION_CONFIG.timeoutMs / 60000);
          boxLogger.error(`Box AI extraction timeout after ${timeoutMinutes} minutes`, fetchError);
          throw new Error(`Box AI extraction timed out after ${timeoutMinutes} minutes. The document may be too complex or Box AI is experiencing issues.`);
        }
        
        // Re-throw other fetch errors
        throw fetchError;
      }
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // If this is the last attempt, throw the error
      if (attempt >= BOX_AI_EXTRACTION_CONFIG.maxRetries) {
        boxLogger.error(`Box AI extraction failed after ${attempt + 1} attempts for model "${model}"`, lastError);
        throw lastError;
      }
      
      // Otherwise, log and continue to next retry
      boxLogger.warn(`Box AI extraction attempt ${attempt + 1} failed, will retry`, {
        fileId,
        model,
        error: lastError.message,
        attemptsRemaining: BOX_AI_EXTRACTION_CONFIG.maxRetries - attempt
      });
    }
  }
  
  // Should not reach here, but throw last error if we do
  throw lastError || new Error('Box AI extraction failed for unknown reason');
}

export async function getBoxFileEmbedLink(fileId: string): Promise<string> {
    try {
        const fileInfo = await boxApiFetch(`/files/${fileId}?fields=expiring_embed_link`, { method: 'GET' });
        if (!fileInfo?.expiring_embed_link?.url) {
            throw new Error('Expiring embed link not found in Box API response.');
        }
        return fileInfo.expiring_embed_link.url;
    } catch (error) {
        boxLogger.error(`Error fetching embed link for file ${fileId}`, error instanceof Error ? error : { error });
        throw error;
    }
}
