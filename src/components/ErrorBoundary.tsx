import React, { ReactNode, useState, useEffect } from 'react';
import { errorLogger } from '../utils/errorLogger';
import { handleError, ErrorResponse } from '../utils/errorHandler';
import toastUtils from '../utils/toast';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children, fallback }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<ErrorResponse | null>(null);

  useEffect(() => {
    const errorHandler = (event: ErrorEvent | PromiseRejectionEvent) => {
      setHasError(true);
      let errorToHandle: Error;
      let componentStack = '';

      if (event instanceof ErrorEvent) {
        errorToHandle = event.error;
        componentStack = (event as any).error?.stack || '';
      } else {
        errorToHandle = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
        componentStack = errorToHandle.stack || '';
      }

      const errorResponse = handleError(errorToHandle);
      setError(errorResponse);
      errorLogger.error('Error caught by ErrorBoundary:', {
        error: errorResponse,
        componentStack,
      });
      toastUtils.error('An unexpected error occurred. Please try again later.');
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', errorHandler);

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', errorHandler);
    };
  }, []);

  if (hasError) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default ErrorBoundary;