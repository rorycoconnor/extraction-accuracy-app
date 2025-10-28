/**
import { logger } from '@/lib/logger';
 * localStorage Polyfill for Server-Side Rendering
 * 
 * This ensures localStorage exists in Node.js environment with proper function signatures.
 * Without this, Next.js may crash when code tries to access localStorage during SSR.
 */

if (typeof window === 'undefined' && typeof global !== 'undefined') {
  // Only polyfill on server-side
  if (!global.localStorage || typeof global.localStorage.getItem !== 'function') {
    logger.debug('Installing localStorage polyfill for SSR');
    
    class LocalStoragePolyfill implements Storage {
      private store: Map<string, string> = new Map();
      
      get length(): number {
        return this.store.size;
      }
      
      getItem(key: string): string | null {
        return this.store.get(key) ?? null;
      }
      
      setItem(key: string, value: string): void {
        this.store.set(key, value);
      }
      
      removeItem(key: string): void {
        this.store.delete(key);
      }
      
      clear(): void {
        this.store.clear();
      }
      
      key(index: number): string | null {
        const keys = Array.from(this.store.keys());
        return keys[index] ?? null;
      }
    }
    
    // Install the polyfill
    (global as any).localStorage = new LocalStoragePolyfill();
    logger.debug('localStorage polyfill installed');
  }
}

export {};

