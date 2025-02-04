import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getAssistant } from '@/lib/vapi';

interface Assistant {
  id: string;
  name: string;
  model: {
    provider: string;
    model: string;
  };
  voice: {
    provider: string;
    voiceId: string;
  };
  // Add other properties as needed
}

export default function AssistantDetailPage() {
  const router = useRouter();
  const { id, session_id } = router.query;
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session_id) {
      setShowSuccess(true);
    }
  }, [session_id]);

  useEffect(() => {
    async function fetchAssistant() {
      if (typeof id === 'string') {
        try {
          const assistantData = await getAssistant(id);
          setAssistant(assistantData);
        } catch (err) {
          setError('Failed to fetch assistant details');
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    }

    if (id) {
      fetchAssistant();
    }
  }, [id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error || !assistant) {
    return <div>Error: {error || 'Assistant not found'}</div>;
  }

  return (
    <div>
      {showSuccess && (
        <div className="my-4 p-4 bg-green-100 text-green-700 rounded">
          <p>Subscription successful! You can now manage your assistant.</p>
          {/* Add a success animation or component here if desired */}
        </div>
      )}
      <h1>Assistant Details</h1>
      <p>ID: {assistant.id}</p>
      <p>Name: {assistant.name}</p>
      <p>Model Provider: {assistant.model.provider}</p>
      <p>Model: {assistant.model.model}</p>
      <p>Voice Provider: {assistant.voice.provider}</p>
      <p>Voice ID: {assistant.voice.voiceId}</p>
      {/* Add more assistant details here */}
    </div>
  );
}


