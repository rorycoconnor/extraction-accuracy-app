'use server'

import fs from 'fs/promises';
import path from 'path';
import type { BoxTemplate, FileMetadataStore, AccuracyData } from '@/lib/types';

// Data directory in your project
const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Generic functions for reading/writing JSON files
async function saveData(filename: string, data: any) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function loadData<T>(filename: string, defaultValue: T): Promise<T> {
  try {
    await ensureDataDir();
    const filePath = path.join(DATA_DIR, `${filename}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return defaultValue;
  }
}

async function deleteData(filename: string) {
  try {
    const filePath = path.join(DATA_DIR, `${filename}.json`);
    await fs.unlink(filePath);
  } catch {
    // File doesn't exist, that's fine
  }
}

// Server actions for your data types
export async function saveGroundTruthAction(fileId: string, templateKey: string, data: Record<string, string>) {
  const store: FileMetadataStore = await loadData('fileMetadataStore', {});
  
  // ✅ FIXED: Merge with existing ground truth data instead of overwriting
  const existingGroundTruth = store[fileId]?.groundTruth || {};
  const mergedGroundTruth = {
    ...existingGroundTruth,
    ...data
  };
  
  store[fileId] = {
    templateKey: templateKey,
    groundTruth: mergedGroundTruth,
  };
  await saveData('fileMetadataStore', store);
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

// Prompt data storage actions
export async function savePromptDataAction(promptData: any) {
  await saveData('promptsStore', promptData);
}

export async function getPromptDataAction(): Promise<any> {
  return await loadData('promptsStore', {});
} 