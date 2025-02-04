import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

// A component that throws an error
const ErrorThrowingComponent = () => {
  throw new Error('Test error');
};

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary fallback={<div>Error occurred</div>}>
        <div>Child component</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child component')).toBeInTheDocument();
  });

  it('renders fallback UI when there is an error', () => {
    render(
      <ErrorBoundary fallback={<div>Error occurred</div>}>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error occurred')).toBeInTheDocument();
  });
});