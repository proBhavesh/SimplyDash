import React from 'react';
import { render, screen } from '@testing-library/react';
import AssistantDetailPage from '../[id]';
import { useRouter } from 'next/router';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('AssistantDetailPage', () => {
  it('renders the assistant detail page without crashing', () => {
    (useRouter as jest.Mock).mockReturnValue({
      query: { id: 'test-assistant-id' },
    });

    render(<AssistantDetailPage />);
    expect(screen.getByText(/Assistant Details/i)).toBeInTheDocument();
  });
});