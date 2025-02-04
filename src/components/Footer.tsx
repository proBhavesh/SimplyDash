// src/components/Footer.tsx

import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-background border-t py-4">
      <div className="container mx-auto flex justify-center space-x-4">
        <Link href="/copyright" className="text-sm text-muted-foreground hover:text-foreground">
          Copyright
        </Link>
        <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
          Terms
        </Link>
        <Link href="/policy" className="text-sm text-muted-foreground hover:text-foreground">
          Policy
        </Link>
        <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground">
          About
        </Link>
        <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground">
          Blog
        </Link>
      </div>
    </footer>
  );
}

export default Footer;
