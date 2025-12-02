
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

// Centralized fetch function for Box API calls
export async function boxApiFetch(path: string, options: RequestInit = {}) {
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
        boxLogger.error(`Box API Error on path ${path}`, { status: response.status, data: errorData, options });
        
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
        
        throw new Error(errorMessage);
    }
    
    if (!responseText) {
        return null;
    }
    
    return JSON.parse(responseText);
}


export async function getTemplates(): Promise<BoxTemplate[]> {
  try {
    const data: BoxTemplatesResponse = await boxApiFetch(`/metadata_templates/enterprise`, { method: 'GET' });
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

export async function extractStructuredMetadataWithBoxAI(
  { fileId, fields, model, templateKey }: BoxAIExtractParams
): Promise<Record<string, any>> {
  
  try {
    const requestBody: BoxAIExtractRequestBody = {
      items: [{ id: fileId, type: 'file' as const }],
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

    boxLogger.debug('Box AI extraction request prepared', { model, fileId, hasTemplate: !!templateKey });

    // Call Box AI API and capture RAW response
    const accessToken = await getAccessToken();
    const response = await fetch(`${BOX_API_BASE_URL}/ai/extract_structured`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        cache: 'no-store',
    });
    
    const rawResponseText = await response.text();
    
    boxLogger.debug('Box AI response received', { model, fileId, status: response.status, responseLength: rawResponseText.length });
    
    // Check for HTTP errors
    if (!response.ok) {
        boxLogger.error(`Box AI HTTP error ${response.status} for model "${model}"`, new Error(rawResponseText.substring(0, 500)));
        throw new Error(`Box AI API returned ${response.status}: ${response.statusText}. Response: ${rawResponseText}`);
    }
    
    // Parse the response
    let result;
    try {
        result = JSON.parse(rawResponseText);
    } catch (parseError) {
        boxLogger.error(`Box AI JSON parse error for model "${model}"`, parseError as Error);
        throw new Error(`Failed to parse Box AI response: ${parseError}`);
    }
    
    boxLogger.debug('Box AI response parsed successfully', { model, fileId, hasAnswer: !!result?.answer, hasEntries: !!result?.entries });

    // Handle Box AI response formats - simplified based on actual API behavior
    let extractedData: Record<string, any> = {};
    
    // Check for the most common response format first (what we see in logs)
    if (result?.answer && typeof result.answer === 'object') {
        extractedData = result.answer;
        boxLogger.info(`Successfully extracted data using model "${model}"`, { 
          fileId, 
          fieldCount: Object.keys(extractedData).length,
          extractionPath: 'answer field'
        });
        return extractedData;
    }
    
    // Handle array response format
    if (Array.isArray(result)) {
        const firstResult = result[0];
        if (firstResult?.success) {
            extractedData = firstResult.extractedMetadata || firstResult.answer || {};
        } else {
            throw new Error(`Box AI extraction failed: ${firstResult?.error || 'Unknown error'}`);
        }
        boxLogger.info(`Successfully extracted data using model "${model}"`, { 
          fileId, 
          fieldCount: Object.keys(extractedData).length,
          extractionPath: 'array format'
        });
        return extractedData;
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
        boxLogger.info(`Successfully extracted data using model "${model}"`, { 
          fileId, 
          fieldCount: Object.keys(extractedData).length,
          extractionPath: 'entries format'
        });
        return extractedData;
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
      extractionPath: 'fallback format'
    });
    
    return extractedData;

  } catch (error) {
    boxLogger.error(`Error using model "${model}" for file ${fileId}`, error instanceof Error ? error : { error });
    throw error;
  }
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
