'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { BoxTemplate } from '@/lib/types';
import type { CompareTypeConfig, CompareType, CompareParameters } from '@/lib/compare-types';
import {
  getOrCreateCompareTypeConfig,
  setCompareType as setCompareTypeStorage,
  setCompareParameters as setCompareParametersStorage,
  exportCompareTypeConfig,
  importAndSaveCompareTypeConfig,
  resetToDefaults,
} from '@/lib/compare-type-storage';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

// Types
interface CompareTypeContextType {
  compareTypeConfig: CompareTypeConfig | null;
  setCompareType: (fieldKey: string, compareType: CompareType) => Promise<void>;
  setCompareParameters: (fieldKey: string, parameters: CompareParameters) => Promise<void>;
  importConfig: (jsonString: string) => Promise<void>;
  exportConfig: () => string;
  resetToDefaultConfig: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

const CompareTypeContext = createContext<CompareTypeContextType | undefined>(undefined);

// Provider component
export function CompareTypeProvider({
  children,
  template,
}: {
  children: React.ReactNode;
  template: BoxTemplate | null;
}) {
  const [compareTypeConfig, setCompareTypeConfigState] = useState<CompareTypeConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load compare type config when template changes
  const loadConfig = useCallback(async () => {
    if (!template) {
      setCompareTypeConfigState(null);
      return;
    }

    logger.debug('useCompareTypes: Loading config for template', {
      templateKey: template.templateKey,
    });

    try {
      setIsLoading(true);

      const config = getOrCreateCompareTypeConfig(template);

      logger.info('useCompareTypes: Config loaded', {
        templateKey: template.templateKey,
        fieldCount: config.fields.length,
      });

      setCompareTypeConfigState(config);
      setError(null);
    } catch (err) {
      logger.error('useCompareTypes: Failed to load config', err as Error);
      setError('Failed to load compare type configuration');
    } finally {
      setIsLoading(false);
    }
  }, [template]);

  // Set compare type for a field
  const setCompareType = useCallback(
    async (fieldKey: string, compareType: CompareType) => {
      if (!template) {
        logger.error('useCompareTypes: Cannot set compare type without template');
        return;
      }

      logger.debug('useCompareTypes: Setting compare type', {
        fieldKey,
        compareType,
      });

      try {
        setIsLoading(true);

        // Update storage
        setCompareTypeStorage(template.templateKey, fieldKey, compareType);

        // Reload config
        await loadConfig();

        toast({
          title: 'Compare Type Updated',
          description: `Compare type set to "${compareType}" for field "${fieldKey}"`,
        });
      } catch (err) {
        logger.error('useCompareTypes: Failed to set compare type', err as Error);
        setError('Failed to update compare type');

        toast({
          title: 'Update Failed',
          description: 'Failed to update compare type. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [template, loadConfig]
  );

  // Set compare parameters for a field
  const setCompareParameters = useCallback(
    async (fieldKey: string, parameters: CompareParameters) => {
      if (!template) {
        logger.error('useCompareTypes: Cannot set parameters without template');
        return;
      }

      logger.debug('useCompareTypes: Setting compare parameters', {
        fieldKey,
        parameters,
      });

      try {
        setIsLoading(true);

        // Update storage
        setCompareParametersStorage(template.templateKey, fieldKey, parameters);

        // Reload config
        await loadConfig();

        toast({
          title: 'Parameters Updated',
          description: `Comparison parameters updated for field "${fieldKey}"`,
        });
      } catch (err) {
        logger.error('useCompareTypes: Failed to set parameters', err as Error);
        setError('Failed to update parameters');

        toast({
          title: 'Update Failed',
          description: 'Failed to update parameters. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [template, loadConfig]
  );

  // Import configuration from JSON
  const importConfig = useCallback(
    async (jsonString: string) => {
      logger.debug('useCompareTypes: Importing config');

      try {
        setIsLoading(true);

        const importedConfig = importAndSaveCompareTypeConfig(jsonString);

        // Check if template keys match
        if (template && importedConfig.templateKey !== template.templateKey) {
          logger.warn('useCompareTypes: Template key mismatch', {
            currentTemplate: template.templateKey,
            importedTemplate: importedConfig.templateKey,
          });

          toast({
            title: 'Template Mismatch',
            description: `Imported config is for template "${importedConfig.templateKey}", but current template is "${template.templateKey}". Configuration imported anyway.`,
            variant: 'destructive',
          });
        }

        // Reload config
        await loadConfig();

        toast({
          title: 'Configuration Imported',
          description: `Successfully imported configuration with ${importedConfig.fields.length} fields.`,
        });
      } catch (err) {
        logger.error('useCompareTypes: Failed to import config', err as Error);
        setError('Failed to import configuration');

        toast({
          title: 'Import Failed',
          description:
            err instanceof Error ? err.message : 'Failed to import configuration. Please check the file format.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [template, loadConfig]
  );

  // Export configuration as JSON string
  const exportConfig = useCallback((): string => {
    if (!template) {
      throw new Error('Cannot export without a template');
    }

    logger.debug('useCompareTypes: Exporting config', {
      templateKey: template.templateKey,
    });

    try {
      const jsonString = exportCompareTypeConfig(template.templateKey);

      toast({
        title: 'Configuration Exported',
        description: 'Configuration exported successfully.',
      });

      return jsonString;
    } catch (err) {
      logger.error('useCompareTypes: Failed to export config', err as Error);

      toast({
        title: 'Export Failed',
        description: 'Failed to export configuration.',
        variant: 'destructive',
      });

      throw err;
    }
  }, [template]);

  // Reset to default configuration
  const resetToDefaultConfig = useCallback(async () => {
    if (!template) {
      logger.error('useCompareTypes: Cannot reset without template');
      return;
    }

    logger.debug('useCompareTypes: Resetting to defaults');

    try {
      setIsLoading(true);

      resetToDefaults(template);

      // Reload config
      await loadConfig();

      toast({
        title: 'Reset to Defaults',
        description: 'Compare type configuration reset to default values.',
      });
    } catch (err) {
      logger.error('useCompareTypes: Failed to reset config', err as Error);
      setError('Failed to reset configuration');

      toast({
        title: 'Reset Failed',
        description: 'Failed to reset configuration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [template, loadConfig]);

  // Refresh configuration
  const refreshConfig = useCallback(() => {
    logger.debug('useCompareTypes: Refreshing config');
    return loadConfig();
  }, [loadConfig]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load config when template changes
  useEffect(() => {
    if (typeof window !== 'undefined' && template) {
      logger.debug('useCompareTypes: Template changed, loading config');
      loadConfig().catch((err) => logger.error('useCompareTypes: Initial load failed', err));
    }
  }, [template, loadConfig]);

  const value: CompareTypeContextType = {
    compareTypeConfig,
    setCompareType,
    setCompareParameters,
    importConfig,
    exportConfig,
    resetToDefaultConfig,
    refreshConfig,
    isLoading,
    error,
    clearError,
  };

  return <CompareTypeContext.Provider value={value}>{children}</CompareTypeContext.Provider>;
}

// Hook to use compare type context
export function useCompareTypes() {
  const context = useContext(CompareTypeContext);
  if (context === undefined) {
    throw new Error('useCompareTypes must be used within a CompareTypeProvider');
  }
  return context;
}

// Export types
export type { CompareTypeContextType };
