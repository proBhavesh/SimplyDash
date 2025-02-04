// src/components/dashboard-page.tsx

import { auth } from '../app/firebaseConfig';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from './ui/card';
import { Button } from './ui/button';
import { getAuth, signOut } from 'firebase/auth';
import { useRouter } from 'next/router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { loadStripe } from '@stripe/stripe-js';
import { useAssistants } from '../hooks/useAssistants';
import { useRealtimeAssistants } from '../hooks/useRealtimeAssistants';
import { fetchWithAuth } from '../utils/api';
import { Assistant, DailyUsage } from '../types/assistant';
import ErrorBoundary from './ErrorBoundary';
import ErrorMessage from './ErrorMessage';
import SystemStatusIndicator from './SystemStatusIndicator';
import { Header } from './Header';
import toastUtils from '../utils/toast';
import { Toaster } from 'react-hot-toast';
import { handleError } from '../utils/errorHandler';
import {
  CreditCardIcon,
  MountainIcon,
  PlusIcon,
  SettingsIcon,
  UsersIcon,
  MenuIcon,
  XIcon,
  TrashIcon,
  LoaderIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from './Icons';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function DashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  const {
    assistants: vapiAssistants,
    loading: vapiLoading,
    error: vapiError,
    fetchAssistantsAndAnalytics,
    deleteAssistant,
    totalUsage,
  } = useAssistants();

  const {
    assistants: realtimeAssistants,
    loading: realtimeLoading,
    error: realtimeError,
    fetchAssistants: fetchRealtimeAssistants,
    deleteAssistant: deleteRealtimeAssistant,
  } = useRealtimeAssistants(isAdmin);

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [subscribingAssistantId, setSubscribingAssistantId] = useState<string | null>(null);
  const [deletingAssistantId, setDeletingAssistantId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDailyUsage, setShowDailyUsage] = useState(false);
  const router = useRouter();
  const { session_id } = router.query;

  useEffect(() => {
    const authInstance = getAuth();
    const unsubscribe = authInstance.onAuthStateChanged((user) => {
      if (user) {
        const userIsAdmin = user.email === 'vincent@getinference.com';
        setIsAdmin(userIsAdmin);
        fetchAssistantsAndAnalytics(userIsAdmin);
        fetchRealtimeAssistants();
        if (session_id) {
          verifySubscriptionSession(session_id as string);
        }
      } else {
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router, session_id, fetchAssistantsAndAnalytics, fetchRealtimeAssistants]);

  const verifySubscriptionSession = async (sessionId: string) => {
    try {
      const response = await fetchWithAuth(
        `/api/verify-subscription?session_id=${sessionId}`
      );
      if (response.ok) {
        const data = await response.json();
        console.log('Subscription verified:', data);
        fetchAssistantsAndAnalytics(isAdmin);
        fetchRealtimeAssistants();
        toastUtils.success('Subscription verified successfully');
      } else {
        throw new Error('Failed to verify subscription');
      }
    } catch (error) {
      handleError(error as Error);
      toastUtils.error('Failed to verify subscription');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAssistantsAndAnalytics(isAdmin);
      await fetchRealtimeAssistants();
      toastUtils.success('Data refreshed successfully');
    } catch (error) {
      handleError(error as Error);
      toastUtils.error('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    const authInstance = getAuth();
    try {
      await signOut(authInstance);
      router.push('/');
      toastUtils.info('Logged out successfully');
    } catch (error) {
      handleError(error as Error);
      toastUtils.error('Failed to log out');
    }
  };

  const handleSubscribe = async (assistantId: string, assistantType: string) => {
    setSubscribingAssistantId(assistantId);
    try {
      const response = await fetchWithAuth('/api/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assistantId, assistantType }),
      });

      if (response.ok) {
        const { sessionId } = await response.json();
        const stripe = await stripePromise;
        if (stripe) {
          const { error } = await stripe.redirectToCheckout({ sessionId });
          if (error) {
            throw new Error(`Payment failed: ${error.message}`);
          }
        } else {
          throw new Error('Failed to load Stripe');
        }
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to create subscription: ${errorData.message}`);
      }
    } catch (error) {
      handleError(error as Error);
      toastUtils.error('Failed to create subscription');
    } finally {
      setSubscribingAssistantId(null);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      const response = await fetchWithAuth('/api/create-customer-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to access customer portal: ${errorData.message}`);
      }
    } catch (error) {
      handleError(error as Error);
      toastUtils.error('Failed to access customer portal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAssistant = async (assistantId: string, assistantType: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this assistant? This action cannot be undone.'
      )
    ) {
      return;
    }
    setDeletingAssistantId(assistantId);
    try {
      if (assistantType === 'vapi') {
        await deleteAssistant(assistantId);
      } else if (assistantType === 'openai-realtime') {
        await deleteRealtimeAssistant(assistantId);
      }
      // Refresh the data after deletion
      await fetchAssistantsAndAnalytics(isAdmin);
      await fetchRealtimeAssistants();
      toastUtils.success('Assistant deleted successfully');
    } catch (error) {
      handleError(error as Error);
      toastUtils.error('Failed to delete assistant');
    } finally {
      setDeletingAssistantId(null);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleDailyUsage = () => {
    setShowDailyUsage(!showDailyUsage);
  };

  // Modify assistants to include the type property
  const assistants: Assistant[] = [
    ...(vapiAssistants
      ? vapiAssistants.map((assistant) => ({ ...assistant, type: 'vapi' }))
      : []),
    ...(realtimeAssistants
      ? realtimeAssistants.map((assistant) => ({ ...assistant, type: 'openai-realtime' }))
      : []),
  ];

  const renderDailyUsage = (dailyData: DailyUsage[]) => {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">Date</th>
            <th className="text-right">Minutes</th>
            <th className="text-right">Cost</th>
          </tr>
        </thead>
        <tbody>
          {dailyData.map((day) => (
            <tr key={day.date}>
              <td>{day.date}</td>
              <td className="text-right">{day.minutes.toFixed(2)}</td>
              <td className="text-right">${day.cost.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderDashboardContent = () => (
    <div className="flex flex-col min-h-screen w-full">
      <Header />
      <main className="flex-1 p-4 sm:p-6">
        <SystemStatusIndicator />
        {isAdmin && (
          <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded">
            Admin View: Displaying all assistants
          </div>
        )}
        <section className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
            <h2 className="text-2xl font-bold mb-2 sm:mb-0">
              Usage Summary (Last 30 Days)
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleRefresh}
                disabled={refreshing || vapiLoading || realtimeLoading}
                className="inline-flex items-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow transition-colors hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {refreshing ? (
                  <>
                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  'Refresh Data'
                )}
              </Button>
              <Button className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <PlusIcon className="h-4 w-4 mr-2" />
                <span>Top Up</span>
              </Button>
              {isAdmin && (
                <Link href="/openai-realtime-prototype">
                  <Button className="inline-flex items-center rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    OpenAI Realtime Prototype
                  </Button>
                </Link>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Minutes Consumed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl sm:text-4xl font-bold">
                  {totalUsage.totalMinutes.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Total Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl sm:text-4xl font-bold">
                  ${totalUsage.totalCost.toFixed(2)}
                </p>
                <Button onClick={toggleDailyUsage} variant="link" className="mt-2">
                  {showDailyUsage ? (
                    <>
                      <ChevronUpIcon className="h-4 w-4 mr-2" />
                      Hide Usage Breakdown
                    </>
                  ) : (
                    <>
                      <ChevronDownIcon className="h-4 w-4 mr-2" />
                      Show Usage Breakdown
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
          {showDailyUsage && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Usage Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {renderDailyUsage(totalUsage.dailyData)}
              </CardContent>
            </Card>
          )}
        </section>
        <section>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
            <h2 className="text-2xl font-bold mb-2 sm:mb-0">Assistants</h2>
            <Link
              href="/create-assistant"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Create New Assistant
            </Link>
          </div>
          {vapiLoading && realtimeLoading ? (
            <div className="col-span-full flex justify-center items-center">
              <LoaderIcon className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading assistants...</span>
            </div>
          ) : (
            <>
              {vapiError && (
                <ErrorMessage
                  message={`Error fetching VAPI assistants: ${vapiError.message}`}
                />
              )}
              {realtimeError && (
                <ErrorMessage
                  message={`Error fetching OpenAI assistants: ${realtimeError.message}`}
                />
              )}
              {assistants.length === 0 ? (
                <div className="col-span-full text-center">
                  <p className="text-lg mb-4">
                    You don&apos;t have any assistants yet.
                  </p>
                  <Link
                    href="/create-assistant"
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Create Your First Assistant
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {assistants.map((assistant) => (
                    <Card key={assistant.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{assistant.name}</CardTitle>
                            <CardDescription>
                              Type:{' '}
                              {assistant.type === 'openai-realtime'
                                ? 'OpenAI Realtime'
                                : assistant.type === 'vapi'
                                ? 'Custom'
                                : assistant.type}
                            </CardDescription>
                          </div>
                          <img
                            src={
                              assistant.waitingGifUrl && assistant.waitingGifUrl !== '/static/cloud.gif'
                                ? assistant.waitingGifUrl
                                : '/static/yuboto.gif'
                            }
                            alt={`${assistant.name} avatar`}
                            className="w-16 h-16 rounded-full"
                          />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col gap-2">
                          <p className="text-sm text-muted-foreground">
                            Model: {assistant.model?.provider || 'Unknown provider'}
                          </p>
                          {assistant.usage ? (
                            <>
                              <p className="text-sm">
                                Minutes used (30 days):{' '}
                                {assistant.usage.totalMinutes.toFixed(2)}
                              </p>
                              <p className="text-sm">
                                Cost incurred (30 days): $
                                {assistant.usage.totalCost.toFixed(2)}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm">Usage data not available</p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/assistant/${assistant.id}`)}
                            >
                              <span>Manage</span>
                            </Button>
                            {!assistant.isSubscribed ? (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() =>
                                  handleSubscribe(assistant.id, assistant.type || 'vapi')
                                }
                                disabled={subscribingAssistantId === assistant.id}
                              >
                                {subscribingAssistantId === assistant.id ? (
                                  <>
                                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                                    Subscribing...
                                  </>
                                ) : (
                                  'Subscribe'
                                )}
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleManageSubscription}
                                disabled={isLoading}
                              >
                                {isLoading ? (
                                  <>
                                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                                    Loading...
                                  </>
                                ) : (
                                  'Manage Subscription'
                                )}
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                handleDeleteAssistant(
                                  assistant.id,
                                  assistant.type || 'vapi'
                                )
                              }
                              disabled={deletingAssistantId === assistant.id}
                            >
                              {deletingAssistantId === assistant.id ? (
                                <>
                                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  Delete
                                  <TrashIcon className="h-4 w-4 ml-2" />
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
      <Toaster />
    </div>
  );

  return (
    <ErrorBoundary
      fallback={
        <ErrorMessage message="Something went wrong. Please try again later." />
      }
    >
      {renderDashboardContent()}
    </ErrorBoundary>
  );
}
