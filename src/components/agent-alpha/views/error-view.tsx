'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import type { ErrorViewProps } from '../types';

export const ErrorView: React.FC<ErrorViewProps> = ({ errorMessage, onClose }) => {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 text-red-600">
        <span className="text-lg font-semibold">❌ Agent-Alpha Failed</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {errorMessage || 'An unknown error occurred.'}
      </p>
      <Button onClick={onClose} variant="outline">
        Close
      </Button>
    </div>
  );
};
