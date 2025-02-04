// src/lib/vapi.ts

import axios, { AxiosError } from 'axios';

const VAPI_BASE_URL = process.env.NEXT_PUBLIC_VAPI_BASE_URL;
const VAPI_API_KEY = process.env.NEXT_PUBLIC_VAPI_API_KEY;

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

export async function createAssistant(userId: string): Promise<Assistant> {
  try {
    const response = await axios.post(
      `${VAPI_BASE_URL}/assistant`,
      {
        // Add required parameters for creating an assistant
        // This may vary based on your specific requirements
      },
      {
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    console.error('Error creating assistant in VAPI:', err.response?.data || err.message);
    throw error;
  }
}

export async function getAssistant(assistantId: string): Promise<Assistant> {
  try {
    const response = await axios.get(`${VAPI_BASE_URL}/assistant/${assistantId}`, {
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    console.error('Error getting assistant from VAPI:', err.response?.data || err.message);
    throw error;
  }
}

export async function updateAssistant(
  assistantId: string,
  updateData: Partial<Assistant>
): Promise<Assistant> {
  try {
    const response = await axios.patch(
      `${VAPI_BASE_URL}/assistant/${assistantId}`,
      updateData,
      {
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    console.error('Error updating assistant in VAPI:', err.response?.data || err.message);
    throw error;
  }
}
