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
import { logger } from '@/lib/logger';
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
  const [userInfo, setUserInfo] = React.useState<{
    id: string;
    name: string;
    login: string;
    enterprise?: {
      id: string;
      name: string;
    } | null;
  } | null>(null);
  const [userLoading, setUserLoading] = React.useState(true);
  
  // Debug: Log environment variable availability (only in dev)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[Settings] NEXT_PUBLIC_BOX_CLIENT_ID available:', !!process.env.NEXT_PUBLIC_BOX_CLIENT_ID);
      console.log('[Settings] Client ID value:', process.env.NEXT_PUBLIC_BOX_CLIENT_ID ? 'SET' : 'NOT SET');
      logger.debug('Environment variables check', { 
        hasPublicClientId: !!process.env.NEXT_PUBLIC_BOX_CLIENT_ID,
        clientIdPreview: process.env.NEXT_PUBLIC_BOX_CLIENT_ID?.substring(0, 10) + '...' || 'N/A'
      });
    }
  }, []);
  
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
      
      // Explicitly refetch user info after OAuth success
      // Add a small delay to ensure cookies are available
      setTimeout(async () => {
        try {
          setUserLoading(true);
          const response = await fetch('/api/auth/box/user');
          const data = await response.json();
          
          logger.debug('OAuth callback - user info fetch', {
            success: data.success,
            hasUser: !!data.user,
            authenticated: data.authenticated,
            error: data.error
          });
          
          if (data.success && data.user) {
            setUserInfo(data.user);
            logger.info('User info fetched successfully after OAuth connection');
          } else {
            logger.warn('User info not available after OAuth connection', { 
              error: data.error,
              authenticated: data.authenticated 
            });
            setUserInfo(null);
          }
        } catch (error) {
          logger.error('Failed to fetch user info after OAuth connection', error instanceof Error ? error : { error });
          setUserInfo(null);
        } finally {
          setUserLoading(false);
        }
      }, 500); // Small delay to ensure cookies are set
      
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
        logger.error('Failed to check OAuth status', error instanceof Error ? error : { error });
        setOauthStatus('disconnected');
      }
    };
    
    checkOAuthStatus();
  }, []);

  // Fetch user information
  React.useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setUserLoading(true);
        const response = await fetch('/api/auth/box/user');
        const data = await response.json();
        
        if (data.success && data.user) {
          setUserInfo(data.user);
        } else {
          logger.warn('No user info available', { error: data.error });
          setUserInfo(null);
        }
      } catch (error) {
        logger.error('Failed to fetch user info', error instanceof Error ? error : { error });
        setUserInfo(null);
      } finally {
        setUserLoading(false);
      }
    };
    
    fetchUserInfo();
  }, [oauthStatus]); // Refetch when OAuth status changes

  React.useEffect(() => {
    const logAccessToken = async () => {
      try {
        const response = await fetch('/api/auth/box/status');
        const data = await response.json();
        
        if (data.success && data.status.accessToken) {
          logger.debug('OAuth token info', {
            tokenType: data.status.tokenType
          });
        } else {
          logger.warn('No access token found');
        }
      } catch (error) {
        logger.error('Failed to fetch token', error instanceof Error ? error : { error });
      }
    };
    
    logAccessToken();
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
      
      // Refresh user information after saving settings
      setTimeout(() => {
        const fetchUserInfo = async () => {
          try {
            setUserLoading(true);
            const response = await fetch('/api/auth/box/user');
            const data = await response.json();
            
            if (data.success && data.user) {
              setUserInfo(data.user);
            } else {
              setUserInfo(null);
            }
          } catch (error) {
            logger.error('Failed to refresh user info', error instanceof Error ? error : { error });
          } finally {
            setUserLoading(false);
          }
        };
        fetchUserInfo();
      }, 500); // Small delay to allow settings to be saved
      
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
      const clientId = process.env.NEXT_PUBLIC_BOX_CLIENT_ID;
      
      if (!clientId || clientId === 'your_box_client_id') {
        toast({
          variant: 'destructive',
          title: 'Configuration Error',
          description: 'NEXT_PUBLIC_BOX_CLIENT_ID is not set. Please check your .env.local file and restart the server.',
        });
        setIsConnectingOAuth(false);
        logger.error('OAuth connect failed: Missing NEXT_PUBLIC_BOX_CLIENT_ID');
        return;
      }
      
      const redirectUri = `${window.location.origin}/api/auth/box/callback`;
      const state = Math.random().toString(36).substring(7);
      
      // Build authorization URL - Box will use scopes configured in Developer Console
      const authUrlObj = new URL('https://account.box.com/api/oauth2/authorize');
      authUrlObj.searchParams.set('client_id', clientId);
      authUrlObj.searchParams.set('response_type', 'code');
      authUrlObj.searchParams.set('redirect_uri', redirectUri);
      authUrlObj.searchParams.set('state', state);
      const authUrl = authUrlObj.toString();
      
      logger.debug('Initiating OAuth redirect', {
        clientId: clientId.substring(0, 10) + '...', // Log partial ID for debugging
        redirectUri,
        origin: window.location.origin,
        authUrlLength: authUrl.length
      });
      
      // Use window.location.replace for immediate redirect
      window.location.href = authUrl;
      
      // If redirect doesn't happen within 1 second, show error
      setTimeout(() => {
        if (document.hasFocus()) {
          setIsConnectingOAuth(false);
          toast({
            variant: 'destructive',
            title: 'Redirect Failed',
            description: 'Unable to redirect to Box. Please check your browser settings or try again.',
          });
          logger.error('OAuth redirect did not occur');
        }
      }, 1000);
    } catch (error) {
      logger.error('OAuth connection error', error instanceof Error ? error : { error });
      toast({
        variant: 'destructive',
        title: 'OAuth Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to initiate OAuth2.0 connection. Please try again.',
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
        setUserInfo(null); // Clear user info when disconnected
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

      {/* User Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent>
          {userLoading ? (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading user information...</span>
            </div>
          ) : userInfo ? (
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Login:</span> 
                <span className="font-mono ml-2">{userInfo.login}</span>
              </div>
              <div>
                <span className="font-medium">Name:</span> 
                <span className="ml-2">{userInfo.name}</span>
              </div>
              <div>
                <span className="font-medium">User ID:</span> 
                <span className="font-mono ml-2">{userInfo.id}</span>
              </div>
              {userInfo.enterprise && (
                <div>
                  <span className="font-medium">Enterprise ID:</span> 
                  <span className="font-mono ml-2">{userInfo.enterprise.id}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              <div className="flex items-center space-x-2 text-orange-600">
                <XCircle className="h-4 w-4" />
                <span>No user information available</span>
              </div>
              <p className="mt-1 text-xs">
                Please configure Box authentication to view user details.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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
                {oauthStatus === 'connected' && (
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Connected to Box</span>
                  </div>
                )}
                
                {/* Warning if environment variables are not set */}
                {!process.env.NEXT_PUBLIC_BOX_CLIENT_ID && (
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-md text-sm text-yellow-800 dark:text-yellow-200">
                    <div className="font-semibold mb-1">Configuration Required</div>
                    <div>OAuth2.0 is not properly configured. Please set the following environment variables in your <code className="px-1 py-0.5 bg-yellow-200 dark:bg-yellow-900/40 rounded text-xs">.env.local</code> file:</div>
                    <div className="mt-2 font-mono text-xs bg-yellow-50 dark:bg-yellow-950/30 p-2 rounded border border-yellow-200 dark:border-yellow-800/20">
                      <div>NEXT_PUBLIC_BOX_CLIENT_ID=your_box_client_id</div>
                      <div>NEXT_PUBLIC_APP_URL=http://localhost:9002</div>
                    </div>
                    <div className="mt-2 text-xs opacity-90">After adding these variables, restart your development server.</div>
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
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('[Settings] Connect button clicked');
                        console.log('[Settings] Client ID available:', !!process.env.NEXT_PUBLIC_BOX_CLIENT_ID);
                        console.log('[Settings] Client ID value:', process.env.NEXT_PUBLIC_BOX_CLIENT_ID);
                        console.log('[Settings] Button disabled?', isConnectingOAuth || !process.env.NEXT_PUBLIC_BOX_CLIENT_ID);
                        handleOAuthConnect();
                      }}
                      disabled={isConnectingOAuth}
                      className="w-full sm:w-auto"
                      aria-label="Connect Box Account"
                    >
                      {isConnectingOAuth && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Connect your Box Demo Account
                      {!process.env.NEXT_PUBLIC_BOX_CLIENT_ID && (
                        <span className="ml-2 text-xs opacity-75">⚠️ Config Required</span>
                      )}
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

          {authMethod !== 'oauth2' && (
            <div className="flex">
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          )}
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
