
'use server';

import { config } from 'dotenv';
config();

import type { BoxTemplate, BoxFile } from '@/lib/types';
import type { BoxAIField } from '@/lib/schemas';
import BoxSDK from 'box-node-sdk';
import { getOAuthAccessToken, isOAuthConnected } from './oauth';

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
            
            console.log('🔑 OAuth2.0 token cached for 55 minutes');
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
            
            console.log('🔑 Service Account token cached for 55 minutes');
            return tokenInfo.accessToken;
        } catch (error) {
             console.error("Failed to get access token using Service Account:", error);
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
        
        console.log('🔑 Developer token cached for 1 hour');
        return developerToken;
    }
    
    throw new Error('No Box authentication method is configured. Please provide credentials on the Settings page or connect via OAuth2.0.');
}

/**
 * Clears the cached token (useful for testing or when credentials change)
 */
export async function clearTokenCache(): Promise<void> {
    cachedToken = null;
    console.log('🔑 Token cache cleared');
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
        console.error(`Box API Error on path ${path}:`, { status: response.status, data: errorData, options });
        
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
    console.error('Error fetching templates from Box:', error);
    throw error;
  }
}

/**
 * Create a new metadata template in Box
 */
export async function createMetadataTemplate(templateData: BoxMetadataTemplateCreateRequest): Promise<BoxMetadataTemplateResponse> {
  try {
    console.log('🔧 Creating Box metadata template:', templateData.displayName);
    
    const response = await boxApiFetch('/metadata_templates/schema', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(templateData),
    });

    console.log('✅ Successfully created Box metadata template:', response.templateKey);
    return response;
  } catch (error) {
    console.error('❌ Error creating metadata template in Box:', error);
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
    console.error('Error checking if template exists:', error);
    throw error;
  }
}

export async function getFolderItems(folderId: string): Promise<BoxFile[]> {
  try {
    const data: BoxFolderItemsResponse = await boxApiFetch(`/folders/${folderId}/items?fields=id,name,type`, { method: 'GET' });
    
    // Log what we're getting from Box API to see folders
    console.log(`=== Box API Response for folder ${folderId} ===`);
    console.log('All items:', data.entries);
    console.log('Files:', data.entries.filter(item => item.type === 'file'));
    console.log('Folders:', data.entries.filter(item => item.type === 'folder'));
    
    return data.entries
        .filter((item): item is BoxFile => item.type === 'file')
        .sort((a, b) => a.name.localeCompare(b.name));

  } catch (error) {
    console.error('Error fetching folder items from Box:', error);
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
    
    console.log(`Folder ${folderId} contents:`, { files: files.length, folders: folders.length });
    
    return { files, folders };

  } catch (error) {
    console.error('Error fetching folder contents from Box:', error);
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
            console.log(`File ${fileId} representations:`, fileInfo.representations);
            
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
                    console.log(`File ${fileId} extracted text length:`, content.length);
                    console.log(`File ${fileId} extracted text preview:`, content.substring(0, 500));
                    return content;
                }
            }
        }
        
        // Fallback: Use Box AI to extract text
        console.log(`Using Box AI fallback for text extraction for file ${fileId}`);
        const aiResponse = await boxApiFetch(`/ai/text_gen`, {
            method: 'POST',
            body: JSON.stringify({
                items: [{ id: fileId, type: 'file' }],
                dialogue_history: [],
                prompt: 'Please extract and return the complete text content of this document exactly as it appears, maintaining all formatting and structure. Do not summarize or modify the text in any way.'
            }),
        });
        
        if (aiResponse?.answer) {
            console.log(`File ${fileId} AI extracted text length:`, aiResponse.answer.length);
            console.log(`File ${fileId} AI extracted text preview:`, aiResponse.answer.substring(0, 500));
            return aiResponse.answer;
        }
        
        throw new Error('Could not extract text content from document');

    } catch (error) {
        console.error(`Error fetching content for file ${fileId} from Box:`, error);
        throw error;
    }
}

// Debug function to test file content extraction
export async function debugFileContent(fileId: string): Promise<void> {
    try {
        console.log(`\n=== Debugging File Content for ${fileId} ===`);
        
        // Test file info
        const fileInfo = await boxApiFetch(`/files/${fileId}?fields=name,size,type,extension`, { method: 'GET' });
        console.log('File Info:', fileInfo);
        
        // Test content extraction
        const content = await getBoxFileContent(fileId);
        console.log('Content Length:', content.length);
        console.log('Content Preview:', content.substring(0, 1000));
        
        console.log(`=== End Debug ===\n`);
    } catch (error) {
        console.error('Debug failed:', error);
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
      console.log(`🔧 Using Box metadata template: ${templateKey}`);
      requestBody.metadata_template = {
        template_key: templateKey,
        scope: 'enterprise'
      };
    } else if (fields) {
      console.log('🔧 Using inline field definitions (fallback)');
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
      console.log(`🤖 BOX_AI_MODEL: Using Enhanced Extract Agent for file ${fileId}`);
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
      console.log(`🤖 BOX_AI_MODEL: Using custom AI agent with model "${model}" for file ${fileId}`);
    }

    console.log(`🤖 BOX_AI_MODEL: Full request body:`, JSON.stringify(requestBody, null, 2));
    
    // Extended JSON dump for debugging session
    console.log(`🤖 BOX_AI_MODEL: 📤 COMPLETE REQUEST DUMP:`, {
      endpoint: '/ai/extract_structured',
      method: 'POST',
      requestedModel: model,
      fileId: fileId,
      requestBody: requestBody,
      timestamp: new Date().toISOString()
    });

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
    
    // Log the TRULY RAW JSON response from Box AI
    console.log(`🤖 BOX_AI_MODEL: 🔍 RAW JSON RESPONSE TEXT for model "${model}":`, rawResponseText);
    
    // Check for HTTP errors
    if (!response.ok) {
        console.error(`🤖 BOX_AI_MODEL: ❌ HTTP Error ${response.status} for model "${model}":`, rawResponseText);
        throw new Error(`Box AI API returned ${response.status}: ${response.statusText}. Response: ${rawResponseText}`);
    }
    
    // Parse the response
    let result;
    try {
        result = JSON.parse(rawResponseText);
    } catch (parseError) {
        console.error(`🤖 BOX_AI_MODEL: ❌ JSON Parse Error for model "${model}":`, parseError);
        console.error(`🤖 BOX_AI_MODEL: ❌ Raw text that failed to parse:`, rawResponseText);
        throw new Error(`Failed to parse Box AI response: ${parseError}`);
    }
    
    console.log(`🤖 BOX_AI_MODEL: Parsed response for model "${model}":`, JSON.stringify(result, null, 2));
    
    // Extended JSON dump for debugging session
    console.log(`🤖 BOX_AI_MODEL: 📥 COMPLETE RESPONSE DUMP:`, {
      requestedModel: model,
      fileId: fileId,
      httpStatus: response.status,
      httpStatusText: response.statusText,
      rawResponseText: rawResponseText,
      responseData: result,
      responseType: typeof result,
      isArray: Array.isArray(result),
      hasAnswer: result?.answer ? true : false,
      hasEntries: result?.entries ? true : false,
      responseKeys: result && typeof result === 'object' ? Object.keys(result) : [],
      timestamp: new Date().toISOString()
    });

    // Handle Box AI response formats - simplified based on actual API behavior
    let extractedData: Record<string, any> = {};
    
    // Check for the most common response format first (what we see in logs)
    if (result?.answer && typeof result.answer === 'object') {
        extractedData = result.answer;
        console.log('Extracted Data (answer field):', extractedData);
        console.log(`🤖 BOX_AI_MODEL: ✅ Successfully extracted data using model "${model}" for file ${fileId}. Fields extracted: ${Object.keys(extractedData).length}`);
        
        // Extended success dump for debugging session
        console.log(`🤖 BOX_AI_MODEL: 🎯 EXTRACTION SUCCESS DUMP:`, {
          requestedModel: model,
          fileId: fileId,
          fieldsExtracted: Object.keys(extractedData),
          fieldCount: Object.keys(extractedData).length,
          extractedData: extractedData,
          extractionPath: 'answer field',
          timestamp: new Date().toISOString()
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
        console.log('Extracted Data (array format):', extractedData);
        console.log(`🤖 BOX_AI_MODEL: ✅ Successfully extracted data using model "${model}" for file ${fileId}. Fields extracted: ${Object.keys(extractedData).length}`);
        
        // Extended success dump for debugging session
        console.log(`🤖 BOX_AI_MODEL: 🎯 EXTRACTION SUCCESS DUMP:`, {
          requestedModel: model,
          fileId: fileId,
          fieldsExtracted: Object.keys(extractedData),
          fieldCount: Object.keys(extractedData).length,
          extractedData: extractedData,
          extractionPath: 'array format',
          timestamp: new Date().toISOString()
        });
        
        return extractedData;
    }
    
    // Handle entries array format (legacy)
    if (result?.entries?.[0]) {
        const firstResult = result.entries[0];
        if (firstResult?.status === 'error') {
            const errorMessage = `Box AI failed to extract metadata: ${firstResult.message || 'An unknown error occurred.'}`;
            console.error(errorMessage, { requestBody, result });
            throw new Error(errorMessage);
        }
        extractedData = firstResult?.answer || {};
        console.log('Extracted Data (entries format):', extractedData);
        console.log(`🤖 BOX_AI_MODEL: ✅ Successfully extracted data using model "${model}" for file ${fileId}. Fields extracted: ${Object.keys(extractedData).length}`);
        
        // Extended success dump for debugging session
        console.log(`🤖 BOX_AI_MODEL: 🎯 EXTRACTION SUCCESS DUMP:`, {
          requestedModel: model,
          fileId: fileId,
          fieldsExtracted: Object.keys(extractedData),
          fieldCount: Object.keys(extractedData).length,
          extractedData: extractedData,
          extractionPath: 'entries format',
          timestamp: new Date().toISOString()
        });
        
        return extractedData;
    }
    
    // Fallback: try other possible response formats
    extractedData = result?.extractedMetadata || result?.data || {};
    
    if (Object.keys(extractedData).length === 0) {
        console.warn('No extractable data found in response:', result);
        throw new Error('Box AI returned an unexpected response format. No extractable data found.');
    }

    console.log('Extracted Data (fallback):', extractedData);
    
    // Final summary log
    console.log(`🤖 BOX_AI_MODEL: ✅ Successfully extracted data using model "${model}" for file ${fileId}. Fields extracted: ${Object.keys(extractedData).length}`);
    
    // Extended success dump for debugging session
    console.log(`🤖 BOX_AI_MODEL: 🎯 EXTRACTION SUCCESS DUMP:`, {
      requestedModel: model,
      fileId: fileId,
      fieldsExtracted: Object.keys(extractedData),
      fieldCount: Object.keys(extractedData).length,
      extractedData: extractedData,
      extractionPath: 'fallback format',
      timestamp: new Date().toISOString()
    });
    
    return extractedData;

  } catch (error) {
    console.error(`🤖 BOX_AI_MODEL: ❌ Error using model "${model}" for file ${fileId}:`, error);
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
        console.error(`Error fetching embed link for file ${fileId} from Box:`, error);
        throw error;
    }
}
