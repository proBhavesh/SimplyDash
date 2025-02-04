import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DashboardPage } from '../dashboard-page';
import { useAssistants } from '../../hooks/useAssistants';
import { useRouter } from 'next/router';

// Mock the useAssistants hook
jest.mock('../../hooks/useAssistants');

// Mock the next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock the firebase/auth
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    onAuthStateChanged: jest.fn((callback) => callback({ email: 'test@example.com' })),
  })),
  signOut: jest.fn(),
}));

describe('DashboardPage', () => {
  const mockFetchAssistantsAndAnalytics = jest.fn();
  const mockDeleteAssistant = jest.fn();

  beforeEach(() => {
    (useAssistants as jest.Mock).mockReturnValue({
      assistants: [
        { id: '1', name: 'Assistant 1', usage: { totalMinutes: 100, totalCost: 45 } },
        { id: '2', name: 'Assistant 2', usage: { totalMinutes: 200, totalCost: 90 } },
      ],
      loading: false,
      error: null,
      fetchAssistantsAndAnalytics: mockFetchAssistantsAndAnalytics,
      deleteAssistant: mockDeleteAssistant,
      totalUsage: { totalMinutes: 300, totalCost: 135, dailyData: [] },
    });

    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      query: {},
    });
  });

  it('renders the dashboard page', () => {
    render(<DashboardPage />);
    expect(screen.getByText('SimplyTalk.ai')).toBeInTheDocument();
    expect(screen.getByText('Usage Summary (Last 30 Days)')).toBeInTheDocument();
    expect(screen.getByText('Assistants')).toBeInTheDocument();
  });

  it('displays correct total usage data', () => {
    render(<DashboardPage />);
    expect(screen.getByText('300.00')).toBeInTheDocument(); // Total minutes
    expect(screen.getByText('$135.00')).toBeInTheDocument(); // Total cost
  });

  it('renders assistant cards', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Assistant 1')).toBeInTheDocument();
    expect(screen.getByText('Assistant 2')).toBeInTheDocument();
  });

  it('handles refresh button click', async () => {
    render(<DashboardPage />);
    const refreshButton = screen.getByText('Refresh Data');
    fireEvent.click(refreshButton);

    expect(mockFetchAssistantsAndAnalytics).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
    });
  });

  it('handles delete assistant', async () => {
    render(<DashboardPage />);
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    // Mock the confirm dialog
    window.confirm = jest.fn(() => true);

    expect(mockDeleteAssistant).toHaveBeenCalledTimes(1);
    expect(mockDeleteAssistant).toHaveBeenCalledWith('1');

    await waitFor(() => {
      expect(mockFetchAssistantsAndAnalytics).toHaveBeenCalledTimes(1);
    });
  });

  it('displays loading state', () => {
    (useAssistants as jest.Mock).mockReturnValue({
      assistants: [],
      loading: true,
      error: null,
      fetchAssistantsAndAnalytics: mockFetchAssistantsAndAnalytics,
      deleteAssistant: mockDeleteAssistant,
      totalUsage: { totalMinutes: 0, totalCost: 0, dailyData: [] },
    });

    render(<DashboardPage />);
    expect(screen.getByText('Loading assistants...')).toBeInTheDocument();
  });

  it('displays error message', () => {
    (useAssistants as jest.Mock).mockReturnValue({
      assistants: [],
      loading: false,
      error: 'Failed to fetch assistants',
      fetchAssistantsAndAnalytics: mockFetchAssistantsAndAnalytics,
      deleteAssistant: mockDeleteAssistant,
      totalUsage: { totalMinutes: 0, totalCost: 0, dailyData: [] },
    });

    render(<DashboardPage />);
    expect(screen.getByText('Failed to fetch assistants')).toBeInTheDocument();
  });
});