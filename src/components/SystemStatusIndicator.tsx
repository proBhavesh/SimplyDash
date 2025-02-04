import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchWithAuth } from '../utils/api';
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

const SystemStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchStatus();
    // Fetch status every 5 minutes
    const intervalId = setInterval(fetchStatus, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  if (loading) {
    return <div>Loading status...</div>;
  }

  if (!status) {
    return null;
  }

  const nonOperationalServices = status.services.filter(service => service.status !== 'operational');

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>System Status</CardTitle>
      </CardHeader>
      <CardContent>
        <Link href="/status" className="block">
          <div className={`p-4 rounded-md ${status.isOperational ? 'bg-green-100' : 'bg-red-100'}`}>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${status.isOperational ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={status.isOperational ? 'text-green-700' : 'text-red-700'}>
                {status.isOperational ? 'All systems operational' : 'Some systems are experiencing issues'}
              </span>
            </div>
            {!status.isOperational && (
              <div className="mt-2">
                <p className="text-sm font-semibold text-red-600">Non-operational services:</p>
                <ul className="list-disc list-inside text-sm text-red-600">
                  {nonOperationalServices.map(service => (
                    <li key={service.name}>{service.name} - {service.status}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-2 text-sm text-gray-600">Click for more details</p>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
};

export default SystemStatusIndicator;