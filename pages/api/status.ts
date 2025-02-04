import { NextApiRequest, NextApiResponse } from 'next';
import axios, { AxiosError } from 'axios';
import { vapiClient } from '../../src/utils/vapiClient';
import { db } from '../../src/lib/firebase-admin';

interface ApiStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  message?: string;
}

const vapiBaseUrl = process.env.VAPI_BASE_URL;
const vapiApiKey = process.env.VAPI_API_KEY;

async function checkApiStatus(): Promise<ApiStatus[]> {
  const statuses: ApiStatus[] = [];
  let testAssistantId: string | undefined;

  try {
    // Create Assistant
    const createAssistantResponse = await axios.post(
      `${vapiBaseUrl}/assistant`,
      {
        name: 'Test Assistant',
        model: { provider: 'openai', model: 'gpt-3.5-turbo' },
      },
      {
        headers: { Authorization: `Bearer ${vapiApiKey}` },
      }
    );
    testAssistantId = createAssistantResponse.data.id;
    statuses.push({ name: 'Create Assistant', status: 'operational' });

    // Get Assistant
    await axios.get(`${vapiBaseUrl}/assistant/${testAssistantId}`, {
      headers: { Authorization: `Bearer ${vapiApiKey}` },
    });
    statuses.push({ name: 'Get Assistant', status: 'operational' });

    // Update Assistant
    await axios.patch(
      `${vapiBaseUrl}/assistant/${testAssistantId}`,
      {
        name: 'Updated Test Assistant',
      },
      {
        headers: { Authorization: `Bearer ${vapiApiKey}` },
      }
    );
    statuses.push({ name: 'Update Assistant', status: 'operational' });

    // List Assistants
    await axios.get(`${vapiBaseUrl}/assistant`, {
      headers: { Authorization: `Bearer ${vapiApiKey}` },
    });
    statuses.push({ name: 'List Assistants', status: 'operational' });

    // Note: Skipping tests for the following endpoints as per the user's request:
    // - Upload File
    // - Get File
    // - Create Analytics Queries
    // - Delete File
    // - Delete Assistant
    // - Subscription Status Update

    // Clean up: Delete the test assistant
    await axios.delete(`${vapiBaseUrl}/assistant/${testAssistantId}`, {
      headers: { Authorization: `Bearer ${vapiApiKey}` },
    });
    testAssistantId = undefined;
    // Not adding 'Delete Assistant' to statuses as we're excluding it from the status check

  } catch (error) {
    console.error('Error during API status check:', error);

    // If an error occurred, mark the remaining endpoints as down
    const checkedEndpoints = statuses.map((s) => s.name);
    const allEndpoints = [
      'Create Assistant',
      'Get Assistant',
      'Update Assistant',
      'List Assistants',
    ];

    allEndpoints.forEach((endpoint) => {
      if (!checkedEndpoints.includes(endpoint)) {
        let errorMessage = 'Failed to check endpoint';
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          if (
            axiosError.response?.data &&
            typeof axiosError.response.data === 'object' &&
            'message' in axiosError.response.data
          ) {
            errorMessage = (axiosError.response.data as { message: string })
              .message;
          } else if (axiosError.message) {
            errorMessage = axiosError.message;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        statuses.push({
          name: endpoint,
          status: 'down',
          message: errorMessage,
        });
      }
    });
  } finally {
    // Ensure cleanup in case of errors
    if (testAssistantId) {
      try {
        await axios.delete(`${vapiBaseUrl}/assistant/${testAssistantId}`, {
          headers: { Authorization: `Bearer ${vapiApiKey}` },
        });
      } catch (error) {
        console.error('Error deleting test assistant:', error);
      }
    }
  }

  return statuses;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const apiStatuses = await checkApiStatus();
    const isAllOperational = apiStatuses.every(
      (status) => status.status === 'operational'
    );

    res.status(200).json({
      isOperational: isAllOperational,
      message: isAllOperational
        ? 'All systems operational'
        : 'Some systems are experiencing issues',
      services: apiStatuses,
    });
  } catch (error) {
    console.error('Error checking API statuses:', error);
    res.status(500).json({
      isOperational: false,
      message: 'Failed to check API statuses',
      services: [],
    });
  }
}
