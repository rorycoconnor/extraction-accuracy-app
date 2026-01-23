'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number | string;
  variant?: 'default' | 'success' | 'error';
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, variant = 'default' }) => {
  const variantClass =
    variant === 'error'
      ? 'bg-red-50 border-red-200 text-red-700'
      : variant === 'success'
      ? 'bg-green-50 border-green-200 text-green-700'
      : 'bg-muted border-transparent text-foreground';

  return (
    <div className={cn('rounded-lg border p-4 flex flex-col gap-1', variantClass)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  );
};
