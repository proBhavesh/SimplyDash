import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Skip middleware for static files and api routes
  if (request.nextUrl.pathname.startsWith('/_next/') || 
      request.nextUrl.pathname.startsWith('/api/') ||
      request.nextUrl.pathname.startsWith('/static/')) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // Add frame isolation headers
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Content-Security-Policy-Report-Only', "frame-ancestors 'self' *");

  // Only apply security headers for embed paths
  if (request.nextUrl.pathname.startsWith('/embed/')) {
    // Add permissions policy for microphone
    response.headers.set(
      'Permissions-Policy',
      'microphone=*, camera=(), geolocation=(), interest-cohort=()'
    );

    // Add frame-specific headers
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

    // Add Content-Security-Policy for embed pages
    response.headers.set(
      'Content-Security-Policy',
      [
        // Allow resources from same origin and specified external sources
        "default-src 'self' blob: data: https://*.firebaseapp.com https://*.googleapis.com",
        // Allow styles from same origin and inline
        "style-src 'self' 'unsafe-inline'",
        // Allow scripts with necessary permissions
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
        // Allow connections to necessary services
        "connect-src 'self' blob: https://*.firebaseapp.com https://*.googleapis.com wss://*.firebaseio.com",
        // Allow media (for audio)
        "media-src 'self' blob:",
        // Allow workers and worklets
        "worker-src 'self' blob:",
        // Allow frames
        "frame-src 'self'",
        // Isolate this frame from parent page scripts
        "frame-ancestors *"
      ].join('; ')
    );
  }

  return response;
}

// Configure which paths should be processed by this middleware
export const config = {
  matcher: [
    // Match all paths except static files and api routes
    '/((?!_next/|api/|static/).*)',
  ],
};
