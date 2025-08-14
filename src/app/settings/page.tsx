'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { updateBoxSettings } from '@/lib/actions/settings';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

const settingsSchema = z.discriminatedUnion('authMethod', [
  z.object({
    authMethod: z.literal('oauth2'),
  }),
  z.object({
    authMethod: z.literal('service-account'),
    boxConfigJson: z.string().min(1, 'The configuration JSON cannot be empty.'),
  }),
  z.object({
    authMethod: z.literal('developer-token'),
    boxDeveloperToken: z.string().min(1, 'The developer token cannot be empty.'),
    boxEnterpriseId: z.string().min(1, 'The enterprise ID cannot be empty.'),
  }),
]);

type SettingsFormValues = z.infer<typeof settingsSchema>;

// Separate component that uses useSearchParams
function SettingsContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isConnectingOAuth, setIsConnectingOAuth] = React.useState(false);
  const [oauthStatus, setOauthStatus] = React.useState<'connected' | 'disconnected' | 'checking'>('checking');
  console.log('Environment variables', process.env)
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      authMethod: 'oauth2',
    },
  });

  const authMethod = form.watch('authMethod');

  // Handle OAuth callback results
  React.useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const message = searchParams.get('message');

    if (success === 'oauth_connected') {
      setOauthStatus('connected');
      toast({
        title: 'OAuth Connection Successful',
        description: 'Your Box account has been connected successfully!',
      });
      // Clear URL parameters
      router.replace('/settings');
    } else if (error === 'oauth_failed') {
      setOauthStatus('disconnected');
      toast({
        variant: 'destructive',
        title: 'OAuth Connection Failed',
        description: message || 'Failed to connect your Box account. Please try again.',
      });
      // Clear URL parameters
      router.replace('/settings');
    }
  }, [searchParams, toast, router]);

  // Check OAuth status on mount
  React.useEffect(() => {
    const checkOAuthStatus = async () => {
      try {
        const response = await fetch('/api/auth/box/status');
        const data = await response.json();
        
        if (data.success) {
          setOauthStatus(data.status.isConnected ? 'connected' : 'disconnected');
        } else {
          setOauthStatus('disconnected');
        }
      } catch (error) {
        console.error('Failed to check OAuth status:', error);
        setOauthStatus('disconnected');
      }
    };
    
    checkOAuthStatus();
  }, []);

  async function onSubmit(values: SettingsFormValues) {
    setIsSaving(true);
    
    let result;
    if (values.authMethod === 'oauth2') {
      // OAuth2.0 doesn't require form submission
      result = { success: true };
    } else if (values.authMethod === 'service-account') {
        result = await updateBoxSettings({
            authMethod: 'service-account',
            boxConfigJson: values.boxConfigJson,
        });
    } else {
        result = await updateBoxSettings({
            authMethod: 'developer-token',
            boxDeveloperToken: values.boxDeveloperToken,
            boxEnterpriseId: values.boxEnterpriseId
        });
    }

    if (result.success) {
      toast({
        title: 'Settings Saved',
        description: values.authMethod === 'oauth2' 
          ? 'OAuth2.0 authentication is now active.' 
          : 'Your Box configuration has been updated successfully.',
      });
      if (values.authMethod === 'service-account') {
        form.reset({ authMethod: 'service-account', boxConfigJson: '' });
      } else if (values.authMethod === 'developer-token') {
        form.reset({ authMethod: 'developer-token', boxDeveloperToken: '', boxEnterpriseId: '' });
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Error Saving Settings',
        description:
          result.message || 'An unknown error occurred. Please try again.',
      });
    }
    setIsSaving(false);
  }

  const handleOAuthConnect = async () => {
    setIsConnectingOAuth(true);
    try {
      // Redirect to Box OAuth2.0 authorization URL
      const clientId = process.env.NEXT_PUBLIC_BOX_CLIENT_ID || 'your_box_client_id';
      const redirectUri = `${window.location.origin}/api/auth/box/callback`;
      const authUrl = `https://account.box.com/api/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${Math.random().toString(36).substring(7)}`;
      
      window.location.href = authUrl;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'OAuth Connection Failed',
        description: 'Failed to initiate OAuth2.0 connection. Please try again.',
      });
      setIsConnectingOAuth(false);
    }
  };

  const handleOAuthDisconnect = async () => {
    try {
      // Call API to clear OAuth cookies
      const response = await fetch('/api/auth/box/disconnect', { method: 'POST' });
      
      if (response.ok) {
        setOauthStatus('disconnected');
        toast({
          title: 'OAuth Disconnected',
          description: 'Your Box account has been disconnected successfully.',
        });
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Disconnect Failed',
        description: 'Failed to disconnect your Box account. Please try again.',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your application settings and integrations.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        <Card>
          <CardHeader>
            <CardTitle>Box Authentication</CardTitle>
            <CardDescription>
              Choose a method to authenticate with the Box API. OAuth2.0 is recommended for demo accounts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="authMethod"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="oauth2" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          OAuth2.0 (Demo Account)
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="service-account" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Service Account (using `config.json`)
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="developer-token" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Developer Token
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {authMethod === 'oauth2' && (
          <Card>
            <CardHeader>
              <CardTitle>OAuth2.0 Authentication</CardTitle>
              <CardDescription>
                Connect your Box Demo Account using OAuth2.0. This is the recommended method for demo and testing purposes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {oauthStatus === 'connected' ? (
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Connected to Box</span>
                  </div>
                ) : oauthStatus === 'disconnected' ? (
                  <div className="flex items-center space-x-2 text-red-600">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">Not connected to Box</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Checking connection status...</span>
                  </div>
                )}
                
                {/* Warning if environment variables are not set */}
                {!process.env.NEXT_PUBLIC_BOX_CLIENT_ID && (
                  <div className="p-3 bg-yellow-100 border border-yellow-300 rounded-md text-sm text-yellow-800">
                    <div className="font-semibold mb-1">⚠️ Configuration Required</div>
                    <div>OAuth2.0 is not properly configured. Please set the following environment variables in your <code>.env.local</code> file:</div>
                    <div className="mt-2 font-mono text-xs">
                      <div>NEXT_PUBLIC_BOX_CLIENT_ID=your_box_client_id</div>
                      <div>NEXT_PUBLIC_APP_URL=http://localhost:9002</div>
                    </div>
                    <div className="mt-2 text-xs">After adding these variables, restart your development server.</div>
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  {oauthStatus === 'connected' ? (
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        onClick={handleOAuthConnect}
                        disabled={isConnectingOAuth}
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        {isConnectingOAuth && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Reconnect Box Account
                      </Button>
                      <Button
                        type="button"
                        onClick={handleOAuthDisconnect}
                        variant="destructive"
                        className="w-full sm:w-auto"
                      >
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleOAuthConnect}
                      disabled={isConnectingOAuth || !process.env.NEXT_PUBLIC_BOX_CLIENT_ID}
                      className="w-full sm:w-auto"
                    >
                      {isConnectingOAuth && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Connect your Box Demo Account
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {oauthStatus === 'connected' 
                    ? 'Your Box account is connected. You can reconnect or disconnect as needed.'
                    : 'Click the button above to securely connect your Box account. You\'ll be redirected to Box to authorize this application.'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {authMethod === 'service-account' && (
            <Card>
                <CardHeader>
                    <CardTitle>Service Account Configuration</CardTitle>
                    <CardDescription>
                    Provide your Box application's `config.json` file content. This is generated from the Box Developer Console.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <FormField
                    control={form.control}
                    name="boxConfigJson"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Box `config.json` Content</FormLabel>
                        <FormControl>
                            <Textarea
                            placeholder="Paste the entire content of your downloaded config.json file here..."
                            className="min-h-[250px] font-mono text-xs"
                            {...field}
                            />
                        </FormControl>
                        <FormDescription>
                            This information is sensitive and is required to authenticate with the Box API.
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </CardContent>
            </Card>
        )}

        {authMethod === 'developer-token' && (
            <Card>
                <CardHeader>
                    <CardTitle>Developer Token Configuration</CardTitle>
                    <CardDescription>
                    Provide your Developer Token and Enterprise ID from the Box Developer Console. This token is temporary.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <FormField
                        control={form.control}
                        name="boxDeveloperToken"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Developer Token</FormLabel>
                            <FormControl>
                                <Input placeholder="Enter your developer token" {...field} />
                            </FormControl>
                             <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="boxEnterpriseId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Enterprise ID</FormLabel>
                            <FormControl>
                                <Input placeholder="Enter your enterprise ID" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
            </Card>
        )}

          <div className="flex">
            <Button type="submit" disabled={isSaving || authMethod === 'oauth2'}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {authMethod === 'oauth2' ? 'OAuth2.0 Active' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// Main component with Suspense boundary
export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your application settings and integrations.
          </p>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
