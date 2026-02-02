'use server';

import { getTemplates, getTemplatesWithTaxonomyOptions, getFolderItems, getFolderContents, getBoxFileContent, getBoxFileEmbedLink } from '@/services/box';
import { logger } from '@/lib/logger';
import type { BoxTemplate, BoxFile, BoxFolder } from '@/lib/types';

export async function getBoxTemplates(): Promise<BoxTemplate[]> {
    try {
        const templates = await getTemplates();
        return templates;
    } catch (error) {
        logger.error('Error in getBoxTemplates server action', error instanceof Error ? error : { error });
        throw error;
    }
}

/**
 * Get templates with taxonomy options populated.
 * This fetches taxonomy field options from Box for fields that don't have options.
 */
export async function getBoxTemplatesWithTaxonomyOptions(): Promise<BoxTemplate[]> {
    try {
        const templates = await getTemplatesWithTaxonomyOptions();
        return templates;
    } catch (error) {
        logger.error('Error in getBoxTemplatesWithTaxonomyOptions server action', error instanceof Error ? error : { error });
        throw error;
    }
}

export async function getBoxFilesInFolder(folderId: string): Promise<BoxFile[]> {
    try {
        const files = await getFolderItems(folderId);
        return files;
    } catch (error) {
        logger.error('Error in getBoxFilesInFolder server action', error instanceof Error ? error : { error });
        throw error;
    }
}

export async function getBoxFolderContents(folderId: string): Promise<{
    files: BoxFile[];
    folders: BoxFolder[];
}> {
    try {
        const contents = await getFolderContents(folderId);
        return contents;
    } catch (error) {
        logger.error('Error in getBoxFolderContents server action', error instanceof Error ? error : { error });
        throw error;
    }
}

export async function getBoxFileContentAction(fileId: string): Promise<string> {
    try {
        const content = await getBoxFileContent(fileId);
        return content;
    } catch (error) {
        logger.error('Error in getBoxFileContentAction', { fileId, error: error instanceof Error ? error : String(error) });
        throw error;
    }
}

export async function getBoxFileEmbedLinkAction(fileId: string): Promise<string> {
    try {
        const url = await getBoxFileEmbedLink(fileId);
        return url;
    } catch (error) {
        logger.error('Error in getBoxFileEmbedLinkAction', { fileId, error: error instanceof Error ? error : String(error) });
        throw error;
    }
}
