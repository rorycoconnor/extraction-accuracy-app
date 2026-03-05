'use server'

import fs from 'fs/promises';
import path from 'path';
import type { BoxTemplate, FileMetadataStore, AccuracyData } from '@/lib/types';

const DATA_DIR = path.join(process.cwd(), 'data');

// In-process mutex locks for read-modify-write operations
const fileLocks = new Map<string, Promise<void>>();

async function withFileLock<T>(filename: string, fn: () => Promise<T>): Promise<T> {
  const currentLock = fileLocks.get(filename) ?? Promise.resolve();
  let releaseLock: () => void;
  const newLock = new Promise<void>((resolve) => { releaseLock = resolve; });
  fileLocks.set(filename, newLock);

  await currentLock;
  try {
    return await fn();
  } finally {
    releaseLock!();
    if (fileLocks.get(filename) === newLock) {
      fileLocks.delete(filename);
    }
  }
}

const ALLOWED_FILENAMES = new Set([
  'fileMetadataStore',
  'promptsStore',
  'systemPromptsStore',
  'configuredTemplates',
  'accuracyData',
]);

function validateFilename(filename: string): void {
  if (!ALLOWED_FILENAMES.has(filename)) {
    throw new Error(`Invalid storage filename: ${filename}`);
  }
}

function getSafeFilePath(filename: string): string {
  validateFilename(filename);
  const filePath = path.resolve(DATA_DIR, `${filename}.json`);
  const resolvedDataDir = path.resolve(DATA_DIR);
  if (!filePath.startsWith(resolvedDataDir + path.sep)) {
    throw new Error('Path traversal detected');
  }
  return filePath;
}

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function saveData(filename: string, data: unknown) {
  await ensureDataDir();
  const filePath = getSafeFilePath(filename);
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
  await fs.rename(tmpPath, filePath);
}

async function loadData<T>(filename: string, defaultValue: T): Promise<T> {
  try {
    await ensureDataDir();
    const filePath = getSafeFilePath(filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return defaultValue;
  }
}

async function deleteData(filename: string) {
  try {
    const filePath = getSafeFilePath(filename);
    await fs.unlink(filePath);
  } catch {
    // File doesn't exist, that's fine
  }
}

export async function saveGroundTruthAction(fileId: string, templateKey: string, data: Record<string, string>) {
  await withFileLock('fileMetadataStore', async () => {
    const store: FileMetadataStore = await loadData('fileMetadataStore', {});

    const existingGroundTruth = store[fileId]?.groundTruth || {};
    const mergedGroundTruth = {
      ...existingGroundTruth,
      ...data
    };

    const cleanedGroundTruth: Record<string, string> = {};
    Object.entries(mergedGroundTruth).forEach(([key, value]) => {
      const trimmedValue = String(value).trim();
      if (value !== undefined && 
          value !== null && 
          trimmedValue !== '') {
        cleanedGroundTruth[key] = trimmedValue;
      }
    });

    store[fileId] = {
      templateKey: templateKey,
      groundTruth: cleanedGroundTruth,
    };
    await saveData('fileMetadataStore', store);
  });
}

export async function getGroundTruthAction(fileId: string): Promise<Record<string, string>> {
  const store: FileMetadataStore = await loadData('fileMetadataStore', {});
  return store[fileId]?.groundTruth || {};
}

export async function getGroundTruthDataAction(): Promise<FileMetadataStore> {
  return await loadData('fileMetadataStore', {});
}

export async function saveConfiguredTemplatesAction(templates: BoxTemplate[]) {
  await saveData('configuredTemplates', templates);
}

export async function getConfiguredTemplatesAction(): Promise<BoxTemplate[]> {
  return await loadData('configuredTemplates', []);
}

export async function saveAccuracyDataAction(data: AccuracyData | null) {
  if (data === null) {
    await deleteData('accuracyData');
  } else {
    await saveData('accuracyData', data);
  }
}

export async function getAccuracyDataAction(): Promise<AccuracyData | null> {
  return await loadData('accuracyData', null);
}

export async function clearAllGroundTruthDataAction() {
  await deleteData('fileMetadataStore');
  await deleteData('accuracyData');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- serialized JSON data from prompt/system-prompt stores
export async function savePromptDataAction(promptData: any) {
  await saveData('promptsStore', promptData);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPromptDataAction(): Promise<any> {
  return await loadData('promptsStore', {});
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveSystemPromptsAction(systemPromptsData: any) {
  await saveData('systemPromptsStore', systemPromptsData);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSystemPromptsAction(): Promise<any> {
  return await loadData('systemPromptsStore', null);
} 