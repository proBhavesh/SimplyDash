import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../utils/api';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import toastUtils from '../utils/toast';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  message?: string;
}

interface SystemStatus {
  isOperational: boolean;
  message: string;
  services: ServiceStatus[];
}

const StatusPage: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetchWithAuth('/api/status');
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }
        const data = await response.json();
        setStatus(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching status:', err);
        setError('Failed to load status information. Please try again later.');
        toastUtils.error('Failed to load status information. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  if (loading) {
    return <div>Loading status...</div>;
  }

  if (error) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>System Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`p-4 rounded-md ${status.isOperational ? 'bg-green-100' : 'bg-red-100'} mb-4`}>
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
        {status.services.map((service) => (
          <div key={service.name} className={`mb-2 p-2 rounded ${
            service.status === 'operational' ? 'bg-green-100 text-green-800' :
            service.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            <h3 className="font-semibold">{service.name}</h3>
            <p>Status: {service.status}</p>
            {service.message && <p>{service.message}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default StatusPage;