import { renderHook, act } from '@testing-library/react';
import { useAssistants } from '../useAssistants';
import { fetchWithAuth } from '../../utils/api';
import { getAuth } from 'firebase/auth';

jest.mock('../../utils/api', () => ({
  fetchWithAuth: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
}));

describe('useAssistants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({
      currentUser: { uid: 'testUserId' },
    });
  });

  it('should initialize with empty assistants and loading state', () => {
    const { result } = renderHook(() => useAssistants());
    expect(result.current.assistants).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should fetch assistants and analytics successfully', async () => {
    const mockAssistants = [
      { id: '1', name: 'Assistant 1' },
      { id: '2', name: 'Assistant 2' },
    ];
    const mockAnalytics = [
      {
        name: 'usage',
        result: [
          { assistantId: '1', type: '2023-05-01', totalDuration: '100', totalCost: '45' },
          { assistantId: '2', type: '2023-05-01', totalDuration: '200', totalCost: '90' },
        ],
      },
    ];

    (fetchWithAuth as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockAssistants),
    });
    (fetchWithAuth as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockAnalytics),
    });

    const { result } = renderHook(() => useAssistants());

    await act(async () => {
      await result.current.fetchAssistantsAndAnalytics(false);
    });

    expect(result.current.assistants.length).toBe(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.totalUsage.totalMinutes).toBe(300);
    expect(result.current.totalUsage.totalCost).toBe(135);
  });

  it('should handle fetch error', async () => {
    (fetchWithAuth as jest.Mock).mockRejectedValueOnce(new Error('Fetch error'));

    const { result } = renderHook(() => useAssistants());

    await act(async () => {
      await result.current.fetchAssistantsAndAnalytics(false);
    });

    expect(result.current.assistants).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Failed to fetch assistants: Fetch error');
  });

  it('should delete assistant successfully', async () => {
    const mockAssistants = [
      { id: '1', name: 'Assistant 1' },
      { id: '2', name: 'Assistant 2' },
    ];

    (fetchWithAuth as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockAssistants),
    });

    const { result } = renderHook(() => useAssistants());

    await act(async () => {
      await result.current.fetchAssistantsAndAnalytics(false);
    });

    (fetchWithAuth as jest.Mock).mockResolvedValueOnce({ ok: true });

    await act(async () => {
      await result.current.deleteAssistant('1');
    });

    expect(result.current.assistants.length).toBe(1);
    expect(result.current.assistants[0].id).toBe('2');
  });

  it('should handle delete error', async () => {
    const mockAssistants = [
      { id: '1', name: 'Assistant 1' },
      { id: '2', name: 'Assistant 2' },
    ];

    (fetchWithAuth as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockAssistants),
    });

    const { result } = renderHook(() => useAssistants());

    await act(async () => {
      await result.current.fetchAssistantsAndAnalytics(false);
    });

    (fetchWithAuth as jest.Mock).mockRejectedValueOnce(new Error('Delete error'));

    await act(async () => {
      await result.current.deleteAssistant('1');
    });

    expect(result.current.assistants.length).toBe(2);
    expect(result.current.error).toBe('An unexpected error occurred while deleting the assistant');
  });
});