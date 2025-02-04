// global.d.ts

import React from 'react';

declare module 'next/link';
declare module 'next/router';
declare module 'next/dynamic';
declare module 'next/image';
declare module '@mui/material';
declare module 'firebase/auth';
declare module 'firebase/firestore';
declare module 'formidable';

declare module '@nivo/bar' {
  export const ResponsiveBar: React.ComponentType<any>;
}

declare module '@nivo/line' {
  export const ResponsiveLine: React.ComponentType<any>;
}

declare module 'next' {
  export * from 'next/types';
}

declare module 'react' {
  export * from 'react';
}

// Add firebaseAdmin declaration to the global scope
declare global {
  var firebaseAdmin: boolean | undefined;
}

// Add module declaration for pdf-parse
declare module 'pdf-parse';

export {};
