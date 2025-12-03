'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { debugFileContent, extractStructuredMetadataWithBoxAI } from '@/services/box';
import type { BoxAIField } from '@/lib/schemas';
import GroundTruthTest from './ground-truth-test';

export default function DebugPage() {
  const [fileId, setFileId] = useState('1920031763042');
  const [debugOutput, setDebugOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const testFields: BoxAIField[] = [
    {
      key: 'contractType',
      type: 'enum',
      displayName: 'Contract Type',
      prompt: 'What is the value for the metadata field Contract Type?'
    },
    {
      key: 'effectiveDate',
      type: 'date',
      displayName: 'Effective Date',
      prompt: 'What is the value for the metadata field Effective Date?'
    }
  ];

  const runDebug = async () => {
    setIsLoading(true);
    setDebugOutput('Starting debug...\n');
    
    try {
      // Test file content
      setDebugOutput(prev => prev + 'Testing file content extraction...\n');
      await debugFileContent(fileId);
      
      // Test AI extraction
      setDebugOutput(prev => prev + 'Testing AI extraction...\n');
      const { extractedData, confidenceScores } = await extractStructuredMetadataWithBoxAI({
        fileId,
        fields: testFields,
        model: 'box_ai_default'
      });
      
      setDebugOutput(prev => prev + `AI Extraction Result: ${JSON.stringify(extractedData, null, 2)}\n`);
      if (confidenceScores) {
        setDebugOutput(prev => prev + `Confidence Scores: ${JSON.stringify(confidenceScores, null, 2)}\n`);
      }
      
    } catch (error) {
      setDebugOutput(prev => prev + `Error: ${error}\n`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <GroundTruthTest />
      
      <Card>
        <CardHeader>
          <CardTitle>Box AI Debug Tool</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fileId">File ID</Label>
            <Input
              id="fileId"
              value={fileId}
              onChange={(e) => setFileId(e.target.value)}
              placeholder="Enter Box file ID"
            />
          </div>
          
          <Button onClick={runDebug} disabled={isLoading}>
            {isLoading ? 'Running Debug...' : 'Run Debug'}
          </Button>
          
          <div className="space-y-2">
            <Label>Debug Output</Label>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
              {debugOutput || 'Click "Run Debug" to start...'}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 