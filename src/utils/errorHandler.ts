import { errorLogger } from './errorLogger';

export interface ErrorResponse {
  message: string;
  code?: string;
  details?: any;
}

export function handleError(error: any): ErrorResponse {
  let errorResponse: ErrorResponse;

  if (error instanceof Error) {
    errorResponse = {
      message: error.message,
      code: (error as any).code,
      details: (error as any).details,
    };
  } else if (typeof error === 'string') {
    errorResponse = { message: error };
  } else {
    errorResponse = { message: 'An unknown error occurred', details: error };
  }

  // Log the error
  errorLogger.error('Error occurred:', errorResponse);

  // Return a user-friendly error message
  return {
    message: getUserFriendlyErrorMessage(errorResponse),
    code: errorResponse.code,
  };
}

function getUserFriendlyErrorMessage(error: ErrorResponse): string {
  switch (error.code) {
    case 'UNAUTHORIZED':
      return 'You are not authorized to perform this action. Please log in and try again.';
    case 'FORBIDDEN':
      return 'You do not have permission to access this resource.';
    case 'NOT_FOUND':
      return 'The requested resource could not be found.';
    case 'RATE_LIMIT_EXCEEDED':
      return 'You have exceeded the allowed number of requests. Please try again later.';
    case 'INTERNAL_SERVER_ERROR':
      return 'An internal server error occurred. Our team has been notified and we are working on resolving the issue.';
    default:
      return error.message || 'An unexpected error occurred. Please try again later.';
  }
}

export function isErrorResponse(error: any): error is ErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof error.message === 'string'
  );
}