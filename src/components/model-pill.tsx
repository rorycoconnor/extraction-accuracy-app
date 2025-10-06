import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Crown, FileImage } from 'lucide-react';
import { isPremiumModel, isMultiModalModel } from '@/lib/main-page-constants';

interface ModelIconProps {
  modelId: string;
  size?: 'sm' | 'md';
  className?: string;
}

interface ModelPillProps {
  modelId: string;
  size?: 'sm' | 'md';
  className?: string;
}

// Small icons for dropdowns - just the icons without text but with same background as pills
export function ModelIcon({ modelId, size = 'sm', className = '' }: ModelIconProps) {
  const isPremium = isPremiumModel(modelId);
  const isMultiModal = isMultiModalModel(modelId);

  if (!isPremium && !isMultiModal) {
    return null;
  }

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const iconPadding = size === 'sm' ? 'p-0.5' : 'p-1';

  return (
    <div className={`flex gap-1 ${className}`}>
      {isPremium && (
        <div className={`${iconPadding} bg-amber-100 border border-amber-200 rounded-full`} title="Premium Model">
          <Crown className={`${iconSize} text-amber-800`} />
        </div>
      )}
      {isMultiModal && (
        <div className={`${iconPadding} bg-blue-100 border border-blue-200 rounded-full`} title="Multimodal Model">
          <FileImage className={`${iconSize} text-blue-800`} />
        </div>
      )}
    </div>
  );
}

// Full pills with text for table headers
export function ModelPill({ modelId, size = 'sm', className = '' }: ModelPillProps) {
  const isPremium = isPremiumModel(modelId);
  const isMultiModal = isMultiModalModel(modelId);

  if (!isPremium && !isMultiModal) {
    return null;
  }

  const pillSize = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <div className={`flex gap-1 ${className}`}>
      {isPremium && (
        <Badge 
          variant="secondary" 
          className={`${pillSize} bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 rounded-full`}
        >
          <Crown className={`${iconSize} mr-1`} />
          Premium
        </Badge>
      )}
      {isMultiModal && (
        <Badge 
          variant="secondary" 
          className={`${pillSize} bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200 rounded-full`}
        >
          <FileImage className={`${iconSize} mr-1`} />
          Multimodal
        </Badge>
      )}
    </div>
  );
}
