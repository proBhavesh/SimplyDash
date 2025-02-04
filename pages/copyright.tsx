// pages/copyright.tsx

import React from 'react';
import { Header } from '../src/components/Header';
import { Footer } from '../src/components/Footer';

export default function CopyrightPage() {
  return (
    <>
      <Header />
      <main className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-4">Copyright</h1>
        <p>This is a placeholder page for the Copyright information.</p>
      </main>
      <Footer />
    </>
  );
}
