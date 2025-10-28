'use server';

import { getTemplates, getFolderItems, getFolderContents, getBoxFileContent, getBoxFileEmbedLink } from '@/services/box';
import { logger } from '@/lib/logger';
import type { BoxTemplate, BoxFile, BoxFolder } from '@/lib/types';

export async function getBoxTemplates(): Promise<BoxTemplate[]> {
    try {
        const templates = await getTemplates();
        return templates;
    } catch (error) {
        logger.error('Error in getBoxTemplates server action', error);
        throw error;
    }
}

export async function getBoxFilesInFolder(folderId: string): Promise<BoxFile[]> {
    try {
        const files = await getFolderItems(folderId);
        return files;
    } catch (error) {
        logger.error('Error in getBoxFilesInFolder server action', error);
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
        logger.error('Error in getBoxFolderContents server action', error);
        throw error;
    }
}

export async function getBoxFileContentAction(fileId: string): Promise<string> {
    try {
        const content = await getBoxFileContent(fileId);
        return content;
    } catch (error) {
        logger.error('Error in getBoxFileContentAction', { fileId, error });
        throw error;
    }
}

export async function getBoxFileEmbedLinkAction(fileId: string): Promise<string> {
    try {
        const url = await getBoxFileEmbedLink(fileId);
        return url;
    } catch (error) {
        logger.error('Error in getBoxFileEmbedLinkAction', { fileId, error });
        throw error;
    }
}
