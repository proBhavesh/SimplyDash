// src/components/Header.tsx

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { getAuth, signOut } from 'firebase/auth';
import Image from 'next/image';
import {
  // MountainIcon, // Removed since the logo will be used instead
  UsersIcon,
  PlusIcon,
  CreditCardIcon,
  SettingsIcon,
  MenuIcon,
  XIcon,
  StatusIcon,
  ActivityIcon, // Added ActivityIcon for Token Usage
} from './Icons';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="bg-background border-b">
      <nav className="flex items-center justify-between py-4 px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/static/logo.png" alt="Logo" width={150} height={75} />
          </Link>
        </div>
        <div className="md:hidden">
          <Button onClick={toggleMenu} variant="ghost">
            {isMenuOpen ? (
              <XIcon className="h-6 w-6" />
            ) : (
              <MenuIcon className="h-6 w-6" />
            )}
          </Button>
        </div>
        <div
          className={`flex flex-col md:flex-row items-center gap-4 ${
            isMenuOpen
              ? 'absolute top-16 left-0 right-0 bg-background p-4 shadow-md z-50'
              : 'hidden md:flex'
          }`}
        >
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 px-4 py-2 rounded-md transition-colors hover:bg-muted hover:text-foreground"
          >
            <UsersIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
            <span>Assistants</span>
          </Link>
          <Link
            href="/create-assistant"
            className="group flex items-center gap-2 px-4 py-2 rounded-md transition-colors hover:bg-muted hover:text-foreground"
          >
            <PlusIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
            <span>Create new Assistant</span>
          </Link>
          <Link
            href="/billing"
            className="group flex items-center gap-2 px-4 py-2 rounded-md transition-colors hover:bg-muted hover:text-foreground"
          >
            <CreditCardIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
            <span>Billing</span>
          </Link>
          <Link
            href="/token-usage"
            className="group flex items-center gap-2 px-4 py-2 rounded-md transition-colors hover:bg-muted hover:text-foreground"
          >
            <ActivityIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
            <span>Token Usage</span>
          </Link>
          <Link
            href="/status"
            className="group flex items-center gap-2 px-4 py-2 rounded-md transition-colors hover:bg-muted hover:text-foreground"
          >
            <StatusIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
            <span>Status</span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="group flex items-center gap-2 px-4 py-2 rounded-md transition-colors hover:bg-muted hover:text-foreground"
              >
                <SettingsIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                <span>Settings</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => router.push('/account-settings')}>
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleLogout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </header>
  );
}
