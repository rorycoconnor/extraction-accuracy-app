'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from './theme-toggle';

export function ThemeCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Theme</CardTitle>
          <ThemeToggle />
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm text-muted-foreground">
          Customize how the app looks and feels. Toggle between light and dark mode.
        </CardDescription>
      </CardContent>
    </Card>
  );
}

