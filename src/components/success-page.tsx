// src/components/success-page.tsx

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useRouter } from 'next/router';
import { auth, db } from '../app/firebaseConfig';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid'; // Import uuidv4

export function SuccessPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { assistantId, assistantType } = router.query;

  // State variables to store assistantId and assistantType
  const [assistantIdState, setAssistantIdState] = useState<string | null>(null);
  const [assistantTypeState, setAssistantTypeState] = useState<string | null>(null);

  useEffect(() => {
    if (assistantId && assistantType) {
      setAssistantIdState(assistantId as string);
      setAssistantTypeState(assistantType as string);
    } else {
      router.push('/');
    }
  }, [assistantId, assistantType, router]);

  const createUserDocument = async (user: any) => {
    try {
      const userRef = doc(db, 'users', user.uid);

      // Check if user document already exists
      const userDoc = await getDoc(userRef);

      let workspaceId: string;

      if (userDoc.exists()) {
        // Use the existing workspaceId
        const userData = userDoc.data();
        workspaceId = userData.workspaceId;
        console.log('User document exists. Using existing workspaceId:', workspaceId);
      } else {
        // Generate a new workspaceId
        workspaceId = uuidv4();
        console.log('User document does not exist. Generating new workspaceId:', workspaceId);
      }

      // Update or create the user document
      await setDoc(
        userRef,
        {
          email: user.email,
          createdAt: new Date().toISOString(),
          workspaceId: workspaceId,
          assistants: assistantIdState ? arrayUnion(assistantIdState) : [],
        },
        { merge: true }
      );
      console.log('User document created or updated successfully');
    } catch (error) {
      console.error('Error creating or updating user document:', error);
      throw error;
    }
  };

  const storeAssistantId = async (userId: string) => {
    try {
      // Update the user document to include the assistant ID
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        assistants: assistantIdState ? arrayUnion(assistantIdState) : [],
      });

      // Get the workspaceId from the user's document
      const userDoc = await getDoc(userRef);
      let workspaceId = null;
      if (userDoc.exists()) {
        const userData = userDoc.data();
        workspaceId = userData.workspaceId;
      }

      // Update the assistant's userId and workspaceId in the appropriate collection
      if (assistantIdState && assistantTypeState) {
        let assistantRef;
        if (assistantTypeState === 'vapi') {
          assistantRef = doc(db, 'assistants', assistantIdState);
        } else if (assistantTypeState === 'openai-realtime') {
          assistantRef = doc(db, 'openaiAssistants', assistantIdState);
        } else {
          throw new Error('Invalid assistant type');
        }

        const updateData: any = {
          userId: userId,
        };

        if (workspaceId) {
          updateData.workspaceId = workspaceId;
        }

        await updateDoc(assistantRef, updateData);
      }

      console.log('Associated assistant with user and workspace:', assistantIdState, userId, workspaceId);
      router.push('/dashboard');
    } catch (error) {
      setError('Failed to store assistant data. Please try again.');
      console.error(error);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await createUserDocument(user);
      await storeAssistantId(user.uid);
    } catch (error) {
      setError('Failed to create an account. Please try again.');
      console.error(error);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      await createUserDocument(user);
      await storeAssistantId(user.uid);
    } catch (error) {
      setError('Failed to sign in with Google. Please try again.');
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center">
      {/* Header */}
      <header className="w-full flex justify-between items-center p-6 bg-white shadow-sm">
        <div className="flex items-center">
          <Image src="/static/logo.png" alt="SimplyTalk.ai Logo" width={150} height={75} />
        </div>
        <Link href="/signup">
          <a className="text-[#1e293b] hover:bg-[#f1f5f9] px-4 py-2 rounded-md">
            Sign up / Login
          </a>
        </Link>
      </header>

      {/* Main Content */}
      <main
        className="flex-grow w-full flex flex-col items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: "url('/simplytalkbg.jpg')" }}
      >
        <h1 className="text-4xl font-bold text-white mb-4">Assistant Created Successfully!</h1>
        <p className="text-white text-lg text-center max-w-xl">
          Your AI assistant is ready to go. Sign up or log in to manage your assistant.
        </p>
      </main>

      {/* Sign Up Form */}
      <div className="w-full max-w-md mt-8 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>Create an account to manage your assistant</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp}>
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </div>
              <Button className="w-full mt-4" type="submit">
                Sign Up
              </Button>
            </form>
            <div className="relative mt-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            <Button onClick={handleGoogleSignIn} variant="outline" className="w-full mt-4">
              <svg
                className="mr-2 h-4 w-4"
                aria-hidden="true"
                focusable="false"
                data-prefix="fab"
                data-icon="google"
                role="img"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 488 512"
              >
                <path
                  fill="currentColor"
                  d="M488 261.8C488 403.3 391.1 504 248 504c-137.2 0-248-110.8-248-248S110.8 8 248 8
                  c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5
                  69.1 156.6 153.7 156.6 98.2 0 135-70.4
                  140.8-106.9H248v-85.3h236.1c2.3
                  12.7 3.9 24.9 3.9 41.4z"
                ></path>
              </svg>
              Sign up with Google
            </Button>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              By signing up, you agree to our{' '}
              <Link href="/terms">
                <a className="underline">Terms of Service</a>
              </Link>{' '}
              and{' '}
              <Link href="/privacy">
                <a className="underline">Privacy Policy</a>
              </Link>.
            </p>
          </CardFooter>
          {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
        </Card>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-[#e2e8f0] py-6 w-full">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <Image src="/static/logo.png" alt="SimplyTalk.ai Logo" width={150} height={75} />
              <span className="text-sm font-medium">
                © {new Date().getFullYear()} SimplyTalk All rights reserved.
              </span>
            </div>
            <nav className="flex gap-4">
              <Link href="#">
                <a className="text-sm hover:underline">Terms</a>
              </Link>
              <Link href="#">
                <a className="text-sm hover:underline">Privacy</a>
              </Link>
              <Link href="#">
                <a className="text-sm hover:underline">Contact</a>
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default SuccessPage;
