// pages/about.tsx

import React from 'react';
import { Header } from '../src/components/Header';
import { Footer } from '../src/components/Footer';

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-4">About Us</h1>
        <p>This is a placeholder page for the About Us section.</p>
      </main>
      <Footer />
    </>
  );
}
