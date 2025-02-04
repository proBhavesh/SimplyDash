import React, { useEffect, useState } from 'react';
import { NextPage } from 'next';
import { Header } from '@/components/Header';
import { fetchWithAuth } from '@/utils/api';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface ApiStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  message?: string;
}

interface SystemStatus {
  isOperational: boolean;
  message: string;
  services: ApiStatus[];
}

const StatusPage: NextPage = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetchWithAuth('/api/status');
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error('Error fetching status:', error);
        setStatus({
          isOperational: false,
          message: 'Failed to load status information',
          services: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  const renderServiceStatus = (service: ApiStatus) => {
    const statusColor = service.status === 'operational' ? 'bg-green-500' : 'bg-red-500';
    const textColor = service.status === 'operational' ? 'text-green-700' : 'text-red-700';
    
    return (
      <div key={service.name} className="mb-4 p-4 border rounded-md">
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${statusColor}`}></div>
          <span className={`font-semibold ${textColor}`}>{service.name}</span>
        </div>
        <p className={`mt-1 ${textColor}`}>Status: {service.status}</p>
        {service.message && <p className={`mt-1 ${textColor}`}>Message: {service.message}</p>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">System Status</h1>
        {loading ? (
          <p>Loading status information...</p>
        ) : status ? (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Overall Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`p-4 rounded-md ${status.isOperational ? 'bg-green-100' : 'bg-red-100'}`}>
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${status.isOperational ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className={status.isOperational ? 'text-green-700' : 'text-red-700'}>
                      {status.isOperational ? 'All systems operational' : 'Some systems are experiencing issues'}
                    </span>
                  </div>
                  {!status.isOperational && (
                    <p className="mt-2 text-sm text-red-600">{status.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <div>
              <h2 className="text-2xl font-bold mb-4">API Status</h2>
              {status.services.map(renderServiceStatus)}
            </div>
          </>
        ) : (
          <p>Failed to load status information</p>
        )}
      </main>
    </div>
  );
};

export default StatusPage;