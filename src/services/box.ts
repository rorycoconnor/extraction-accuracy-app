
'use server';

import { config } from 'dotenv';
config();

import type { BoxTemplate, BoxFile } from '@/lib/types';
import type { BoxAIField } from '@/lib/schemas';
import BoxSDK from 'box-node-sdk';
import { getOAuthAccessToken, isOAuthConnected } from './oauth';
import { boxLogger } from '@/lib/logger';

const BOX_API_BASE_URL = 'https://api.box.com/2.0';

// Token cache to avoid expensive JWT operations on every request
interface TokenCache {
  token: string;
  expiresAt: number;
  tokenType: 'service_account' | 'developer' | 'oauth';
}

let cachedToken: TokenCache | null = null;

type BoxTemplatesResponse = {
  entries: BoxTemplate[];
};

type BoxFolderItemsResponse = {
  entries: (BoxFile | BoxFolder)[];
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
 * Gets a valid access token for the Box API with caching.
 * It checks for OAuth2.0 tokens first, then Service Account config, then falls back to Developer Token.
 * Caches tokens to avoid expensive JWT operations on every request.
 */
async function getAccessToken(): Promise<string> {
    const now = Date.now();
    
    // Return cached token if it's still valid (with 5-minute buffer for safety)
    if (cachedToken && now < cachedToken.expiresAt - (5 * 60 * 1000)) {
        return cachedToken.token;
    }
    
    // Check OAuth2.0 first
    if (await isOAuthConnected()) {
        const oauthToken = await getOAuthAccessToken();
        if (oauthToken) {
            // Cache the OAuth token (typically expires in 60 minutes)
            cachedToken = {
                token: oauthToken,
                expiresAt: now + (55 * 60 * 1000), // Cache for 55 minutes (5-minute safety buffer)
                tokenType: 'oauth'
            };
            
            boxLogger.info('OAuth2.0 token cached for 55 minutes');
            return oauthToken;
        }
    }
    
    const boxConfigBase64 = process.env.BOX_CONFIG_JSON_BASE64;
    const developerToken = process.env.BOX_DEVELOPER_TOKEN;

    if (boxConfigBase64) {
        try {
            const configJson = Buffer.from(boxConfigBase64, 'base64').toString('utf-8');
            const boxConfig = JSON.parse(configJson);

            const sdk = new BoxSDK({ boxConfig });
            const tokenInfo = await sdk.getAppUserTokens(boxConfig.enterpriseID);
            
            // Cache the Service Account token (typically expires in 60 minutes)
            cachedToken = {
                token: tokenInfo.accessToken,
                expiresAt: now + (55 * 60 * 1000), // Cache for 55 minutes (5-minute safety buffer)
                tokenType: 'service_account'
            };
            
            boxLogger.info('Service Account token cached for 55 minutes');
            return tokenInfo.accessToken;
        } catch (error) {
             boxLogger.error("Failed to get access token using Service Account", error as Error);
             throw new Error('The stored Service Account configuration is invalid. Please save it again on the Settings page.');
        }
    }

    if (developerToken) {
        // Cache Developer Token (no expiration, but cache for consistency)
        // Developer tokens don't expire but can be revoked, so cache for 1 hour
        cachedToken = {
            token: developerToken,
            expiresAt: now + (60 * 60 * 1000), // Cache for 1 hour
            tokenType: 'developer'
        };
        
        boxLogger.info('Developer token cached for 1 hour');
        return developerToken;
    }
    
    throw new Error('No Box authentication method is configured. Please provide credentials on the Settings page or connect via OAuth2.0.');
}

/**
 * Clears the cached token (useful for testing or when credentials change)
 */
export async function clearTokenCache(): Promise<void> {
    cachedToken = null;
    boxLogger.info('Token cache cleared');
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
