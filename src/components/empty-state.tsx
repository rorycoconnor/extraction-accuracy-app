import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

const EmptyState: React.FC = () => {
  return (
    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/20 p-12 text-center">
          <Sparkles className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="font-headline text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Hello! Let's get started
          </h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Click{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              "Select Documents"
            </span>{' '}
            and choose your{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              template
            </span>{' '}
            &amp;{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              files
            </span>
            .{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              "Compare Models"
            </span>
            . Then select{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              "Run Comparison"
            </span>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmptyState; 