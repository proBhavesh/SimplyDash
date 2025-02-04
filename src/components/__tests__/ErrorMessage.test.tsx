import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorMessage from '../ErrorMessage';

describe('ErrorMessage', () => {
  it('renders the error message', () => {
    const testMessage = 'Test error message';
    render(<ErrorMessage message={testMessage} />);

    expect(screen.getByText('Error:')).toBeInTheDocument();
    expect(screen.getByText(testMessage)).toBeInTheDocument();
  });

  it('applies the correct CSS classes', () => {
    render(<ErrorMessage message="Test message" />);

    const errorDiv = screen.getByRole('alert');
    expect(errorDiv).toHaveClass('bg-red-100', 'border', 'border-red-400', 'text-red-700', 'px-4', 'py-3', 'rounded', 'relative');
  });

  it('renders the error message with correct structure', () => {
    const testMessage = 'Test error message';
    render(<ErrorMessage message={testMessage} />);

    const strongElement = screen.getByText('Error:');
    expect(strongElement.tagName).toBe('STRONG');
    expect(strongElement).toHaveClass('font-bold');

    const messageElement = screen.getByText(testMessage);
    expect(messageElement.tagName).toBe('SPAN');
    expect(messageElement).toHaveClass('block', 'sm:inline');
  });
});