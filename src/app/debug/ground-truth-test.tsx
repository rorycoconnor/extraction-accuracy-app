'use client'
import { logger } from '@/lib/logger';

import { useState } from 'react';
import { useGroundTruth } from '@/hooks/use-ground-truth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function GroundTruthTest() {
  const { groundTruthData, getGroundTruth, saveGroundTruth, refreshGroundTruth, isLoading, error } = useGroundTruth();
  const [fileId, setFileId] = useState('test-file-123');
  const [templateKey, setTemplateKey] = useState('test-template');
  const [fieldKey, setFieldKey] = useState('test-field');
  const [value, setValue] = useState('test-value');
  const [lastResult, setLastResult] = useState<boolean | null>(null);

  const handleSave = async () => {
    logger.debug('Testing ground truth save');
    const result = await saveGroundTruth(fileId, templateKey, fieldKey, value);
    setLastResult(result);
    logger.debug('Save result', { result });
  };

  const handleGet = () => {
    logger.debug('Testing ground truth get');
    const result = getGroundTruth(fileId);
    logger.debug('Get result', { result });
  };

  const handleRefresh = () => {
    logger.debug('Testing ground truth refresh');
    refreshGroundTruth();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ground Truth Test</CardTitle>
          <CardDescription>Test the ground truth save/load functionality</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fileId">File ID</Label>
              <Input
                id="fileId"
                value={fileId}
                onChange={(e) => setFileId(e.target.value)}
                placeholder="Enter file ID"
              />
            </div>
            <div>
              <Label htmlFor="templateKey">Template Key</Label>
              <Input
                id="templateKey"
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value)}
                placeholder="Enter template key"
              />
            </div>
            <div>
              <Label htmlFor="fieldKey">Field Key</Label>
              <Input
                id="fieldKey"
                value={fieldKey}
                onChange={(e) => setFieldKey(e.target.value)}
                placeholder="Enter field key"
              />
            </div>
            <div>
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter value"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Ground Truth'}
            </Button>
            <Button onClick={handleGet} variant="outline">
              Get Ground Truth
            </Button>
            <Button onClick={handleRefresh} variant="outline">
              Refresh Data
            </Button>
          </div>
          
          {lastResult !== null && (
            <div className={`p-3 rounded-md ${lastResult ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              Last save result: {lastResult ? 'Success' : 'Failed'}
            </div>
          )}
          
          {error && (
            <div className="p-3 rounded-md bg-red-100 text-red-800">
              Error: {error}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Separator />
      
      <Card>
        <CardHeader>
          <CardTitle>Current Ground Truth Data</CardTitle>
          <CardDescription>Raw data from the context</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-sm">
            {JSON.stringify(groundTruthData, null, 2)}
          </pre>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Test File Data</CardTitle>
          <CardDescription>Data for the current test file</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-sm">
            {JSON.stringify(getGroundTruth(fileId), null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
} 