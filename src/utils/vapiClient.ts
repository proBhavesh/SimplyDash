import { fetchWithAuth } from './api';

export interface VapiAssistant {
  id: string;
  name: string;
  description?: string;
  model: {
    provider: string;
    model: string;
    messages: Array<{ role: string; content: string }>;
  };
  voice: {
    provider: string;
    voiceId: string;
  };
  transcriber: {
    provider: string;
    model: string;
    language: string;
  };
  isSubscribed: boolean;
}

const VAPI_BASE_URL = process.env.VAPI_BASE_URL;

export async function fetchWithVapiAuth(url: string, options: RequestInit = {}) {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    console.error('VAPI_API_KEY is not set');
    throw new Error('VAPI_API_KEY is not set');
  }

  console.log(`Fetching from Vapi API: ${url}`);
  console.log('Request options:', JSON.stringify(options, null, 2));

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Vapi API response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Vapi API error response: ${errorText}`);
      throw new Error(`Vapi API error: ${response.status} ${response.statusText}. Details: ${errorText}`);
    }

    return response;
  } catch (error) {
    console.error('Error in fetchWithVapiAuth:', error);
    throw error;
  }
}

export async function fetchWithPublicAuth(url: string, options: RequestInit = {}) {
  const apiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_VAPI_API_KEY is not set');
  }

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
}

export async function getAssistant(id: string): Promise<VapiAssistant> {
  const apiUrl = `${VAPI_BASE_URL}/assistant/${id}`;
  console.log(`Fetching assistant from Vapi API: ${apiUrl}`);
  
  try {
    const response = await fetchWithVapiAuth(apiUrl);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Vapi API error: ${response.status} ${response.statusText}. Details: ${JSON.stringify(errorData)}`);
    }
    const assistant = await response.json();
    console.log(`Successfully fetched assistant ${id}`);
    return assistant;
  } catch (error) {
    console.error(`Error fetching assistant ${id}:`, error);
    throw error;
  }
}

export async function updateAssistant(id: string, updateData: Partial<VapiAssistant>): Promise<VapiAssistant> {
  const apiUrl = `${VAPI_BASE_URL}/assistant/${id}`;
  console.log(`Updating assistant in Vapi API: ${apiUrl}`);
  console.log('Update data:', JSON.stringify(updateData, null, 2));
  
  try {
    const response = await fetchWithVapiAuth(apiUrl, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Vapi API error: ${response.status} ${response.statusText}. Details: ${JSON.stringify(errorData)}`);
    }
    const updatedAssistant = await response.json();
    console.log(`Successfully updated assistant ${id}`);
    return updatedAssistant;
  } catch (error) {
    console.error(`Error updating assistant ${id}:`, error);
    throw error;
  }
}

export async function getAnalytics(queries: any[]): Promise<any[]> {
  const apiUrl = `${VAPI_BASE_URL}/analytics`;
  console.log(`Fetching analytics from Vapi API: ${apiUrl}`);
  console.log('Analytics queries:', JSON.stringify(queries, null, 2));
  
  try {
    const response = await fetchWithVapiAuth(apiUrl, {
      method: 'POST',
      body: JSON.stringify({ queries }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Vapi API error: ${response.status} ${response.statusText}. Details: ${JSON.stringify(errorData)}`);
    }
    const analytics = await response.json();
    console.log(`Successfully fetched analytics:`, JSON.stringify(analytics, null, 2));
    return analytics;
  } catch (error) {
    console.error(`Error fetching analytics:`, error);
    throw error;
  }
}

export const vapiClient = {
  getAssistant,
  updateAssistant,
  getAnalytics,
};

// Add other vapi.ai related functions here