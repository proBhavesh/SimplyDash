import { getAuth } from 'firebase/auth';

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  console.log('fetchWithAuth: Starting fetch with auth');
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error('fetchWithAuth: User not authenticated');
    throw new Error('User not authenticated');
  }

  console.log('fetchWithAuth: User authenticated, getting ID token');
  let token;
  try {
    token = await user.getIdToken();
    console.log('fetchWithAuth: ID token obtained successfully');
  } catch (error) {
    console.error('fetchWithAuth: Error getting ID token:', error);
    throw new Error('Failed to get authentication token');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');

  console.log('fetchWithAuth: Sending request to:', url);
  console.log('fetchWithAuth: Request method:', options.method || 'GET');
  console.log('fetchWithAuth: Request headers:', headers);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  console.log('fetchWithAuth: Response status:', response.status);
  console.log('fetchWithAuth: Response headers:', response.headers);

  if (!response.ok) {
    console.error('fetchWithAuth: Request failed:', response.status, response.statusText);
    const errorBody = await response.text();
    console.error('fetchWithAuth: Error response body:', errorBody);
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  console.log('fetchWithAuth: Request successful');
  return response;
}

export async function getAuthToken(): Promise<string> {
  console.log('getAuthToken: Starting to get auth token');
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error('getAuthToken: User not authenticated');
    throw new Error('User not authenticated');
  }

  console.log('getAuthToken: User authenticated, getting ID token');
  try {
    const token = await user.getIdToken();
    console.log('getAuthToken: ID token obtained successfully');
    return token;
  } catch (error) {
    console.error('getAuthToken: Error getting ID token:', error);
    throw new Error('Failed to get authentication token');
  }
}