// src/components/landing-page.tsx

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { auth } from '../app/firebaseConfig';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import toastUtils from '../utils/toast';
import { Upload, Phone, Globe, FileText, Users, Zap, Gift, XCircle } from 'lucide-react';

// Import mammoth for parsing .docx files
import mammoth from 'mammoth';

// Import TEMPLATES data and define its type
import TEMPLATESData from '../templates/templates.json';
const TEMPLATES: { [key: string]: string } = TEMPLATESData;

// Import TEMPLATE_SUMMARIES and templatesList from templateData.ts
import { templatesList } from '../templates/templateData';

export function LandingPage() {
  // Updated assistantType to include 'templates'
  const [assistantType, setAssistantType] = useState<'vapi' | 'openai-realtime' | 'templates'>('vapi');
  const [showForm, setShowForm] = useState(false);
  const [assistantName, setAssistantName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [firstMessage, setFirstMessage] = useState('');

  // States specific to OpenAI Realtime Assistant
  const [trainingFileOpenAI, setTrainingFileOpenAI] = useState<File | null>(null);
  const [uploadedContentOpenAI, setUploadedContentOpenAI] = useState<string>('');
  const [scrapedUrlsOpenAI, setScrapedUrlsOpenAI] = useState<string[]>([]);
  const [scrapedContentsOpenAI, setScrapedContentsOpenAI] = useState<{ [url: string]: string }>(
    {}
  );
  const [urlToScrapeOpenAI, setUrlToScrapeOpenAI] = useState('');

  // VAPI assistant states
  const [trainingFile, setTrainingFile] = useState<File | null>(null);
  const [scrapedUrls, setScrapedUrls] = useState<string[]>([]);
  const [scrapedContent, setScrapedContent] = useState<{ [url: string]: string }>({});
  const [urlToScrape, setUrlToScrape] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const topRef = useRef<HTMLDivElement>(null);

  // OpenAI Realtime assistant specific states
  const [voiceSettings, setVoiceSettings] = useState('alloy');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [threshold, setThreshold] = useState(0.5);
  const [prefixPaddingMs, setPrefixPaddingMs] = useState(500);
  const [silenceDurationMs, setSilenceDurationMs] = useState(300);
  const [temperature, setTemperature] = useState(0.6);

  // Authentication state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // New state for selected template
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // OpenAI Realtime Assistant - Handle file upload
  const handleFileUploadOpenAI = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTrainingFileOpenAI(file);
      try {
        if (file.type === 'application/pdf') {
          // Send PDF file to server for parsing
          const formData = new FormData();
          formData.append('file', file);
          const response = await fetch('/api/parse-pdf', {
            method: 'POST',
            body: formData,
          });
          if (!response.ok) {
            throw new Error('Failed to parse PDF file');
          }
          const data = await response.json();
          setUploadedContentOpenAI(data.text);
          toastUtils.success('PDF file uploaded and parsed successfully');
        } else if (
          file.type ===
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          file.name.endsWith('.docx')
        ) {
          // Handle .docx parsing on client side (for now)
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          setUploadedContentOpenAI(result.value);
          toastUtils.success('DOCX file uploaded and parsed successfully');
        } else {
          // Handle text-based files
          const reader = new FileReader();
          reader.onload = (event) => {
            const fileContent = event.target?.result;
            if (typeof fileContent === 'string') {
              setUploadedContentOpenAI(fileContent);
              toastUtils.success('File uploaded successfully');
            }
          };
          reader.readAsText(file);
        }
      } catch (error) {
        console.error('Error reading file:', error);
        toastUtils.error('Failed to read file');
      }
    }
  };

  // OpenAI Realtime Assistant - Remove uploaded file
  const removeUploadedFileOpenAI = () => {
    setTrainingFileOpenAI(null);
    setUploadedContentOpenAI('');
    toastUtils.success('Uploaded file removed');
  };

  // OpenAI Realtime Assistant - Handle web scraping
  const handleScrapeWebsiteOpenAI = async () => {
    if (!urlToScrapeOpenAI) {
      toastUtils.error('Please enter a URL to scrape');
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch('/api/scrape-website-unauthenticated', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: urlToScrapeOpenAI }),
      });

      if (!response.ok) {
        throw new Error('Failed to scrape website');
      }

      const data = await response.json();
      setScrapedUrlsOpenAI((prevUrls) => [...prevUrls, urlToScrapeOpenAI]);
      setScrapedContentsOpenAI((prevContents) => ({
        ...prevContents,
        [urlToScrapeOpenAI]: data.content,
      }));
      setUrlToScrapeOpenAI('');
      toastUtils.success('Website scraped successfully');
    } catch (error) {
      console.error('Error scraping website:', error);
      toastUtils.error('Failed to scrape website');
    } finally {
      setIsLoading(false);
    }
  };

  // OpenAI Realtime Assistant - Remove scraped URL
  const removeScrapedUrlOpenAI = (url: string) => {
    setScrapedUrlsOpenAI((prevUrls) => prevUrls.filter((u) => u !== url));
    setScrapedContentsOpenAI((prevContents) => {
      const newContents = { ...prevContents };
      delete newContents[url];
      return newContents;
    });
    toastUtils.success('Scraped URL removed');
  };

  // Combine all content for OpenAI assistant creation
  const getCombinedInstructionsOpenAI = () => {
    let combined = systemPrompt;
    if (uploadedContentOpenAI) {
      combined += '\n' + uploadedContentOpenAI;
    }
    scrapedUrlsOpenAI.forEach((url) => {
      combined += '\n' + scrapedContentsOpenAI[url];
    });
    return combined;
  };

  // VAPI Assistant - Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTrainingFile(file);
      // Existing file handling logic for VAPI assistant (if any)
    }
  };

  // VAPI Assistant - Handle web scraping
  const handleScrapeWebsite = async () => {
    if (!urlToScrape) {
      toastUtils.error('Please enter a URL to scrape');
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch('/api/scrape-website-unauthenticated', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: urlToScrape }),
      });

      if (!response.ok) {
        throw new Error('Failed to scrape website');
      }

      const data = await response.json();
      setScrapedUrls((prevUrls) => [...prevUrls, urlToScrape]);
      setScrapedContent((prevContent) => ({
        ...prevContent,
        [urlToScrape]: data.content,
      }));
      setUrlToScrape('');
      toastUtils.success('Website scraped successfully');
    } catch (error) {
      console.error('Error scraping website:', error);
      toastUtils.error('Failed to scrape website');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVapiAssistantCreation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('name', assistantName);
      formData.append('systemPrompt', systemPrompt);
      formData.append('firstMessage', firstMessage);
      if (trainingFile) {
        formData.append('trainingFile', trainingFile);
      }
      formData.append('scrapedUrls', JSON.stringify(scrapedUrls));
      formData.append('scrapedContent', JSON.stringify(scrapedContent));

      const response = await fetch('/api/create-assistant-with-scraping', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to create assistant');
      }

      if (!data.id) {
        throw new Error('Assistant ID is undefined');
      }

      // Redirect to success page with the assistant ID and type
      router.push(`/success?assistantId=${data.id}&assistantType=vapi`);
    } catch (error) {
      console.error('Error creating assistant:', error);
      setError(
        error instanceof Error
          ? `${error.message}\n\nAdditional details: ${JSON.stringify(error)}`
          : 'An error occurred while creating the assistant'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAIRealtimeAssistantCreation = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const combinedInstructions = getCombinedInstructionsOpenAI();

      const body = {
        name: assistantName,
        instructions: combinedInstructions,
        voiceSettings,
        threshold,
        prefix_padding_ms: prefixPaddingMs,
        silence_duration_ms: silenceDurationMs,
        temperature,
        openaiApiKey: openaiApiKey || undefined, // Only include if provided
        template: selectedTemplate || 'default', // Include the template field
      };

      const response = await fetch('/api/create-openai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to create assistant');
      }

      if (!data.id) {
        throw new Error('Assistant ID is undefined');
      }

      // Redirect to success page with the assistant ID and type
      router.push(`/success?assistantId=${data.id}&assistantType=openai-realtime`);
    } catch (error) {
      console.error('Error creating assistant:', error);
      setError(
        error instanceof Error
          ? `${error.message}\n\nAdditional details: ${JSON.stringify(error)}`
          : 'An error occurred while creating the assistant'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowForm(true);
  };

  const handleEmailLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Implement email login logic here
    console.log('Email login');
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // The signed-in user info.
      const user = result.user;
      console.log('Google sign-in successful:', user);
      setIsLoginModalOpen(false);
      // Redirect to dashboard or appropriate page after successful login
      router.push('/dashboard');
    } catch (error) {
      console.error('Error during Google sign-in:', error);
      // Handle errors here, such as displaying an error message to the user
    }
  };

  return (
    <div ref={topRef} className="min-h-screen bg-[#f8fafc] flex flex-col items-center">
      {/* Header */}
      <header className="w-full flex justify-between items-center p-6 bg-white shadow-sm">
        <div className="flex items-center">
          <Image src="/static/logo.png" alt="SimplyTalk.ai Logo" width={150} height={75} />
        </div>
        <Dialog open={isLoginModalOpen} onOpenChange={setIsLoginModalOpen}>
          <DialogTrigger asChild>
            <Button className="text-[#1e293b] hover:bg-[#f1f5f9] px-4 py-2 rounded-md">
              {user ? 'Profile' : 'Login'}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Login</DialogTitle>
              <DialogDescription>Choose your login method</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="Enter your email" required />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Login with Email
                </Button>
              </form>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
              <Button onClick={handleGoogleLogin} variant="outline" className="w-full">
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
                Login with Google
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* Main Content */}
      <main className="flex-grow w-full flex flex-col items-center">
        <section className="py-12 md:py-24 lg:py-32 w-full flex flex-col items-center">
          <div className="container px-4 md:px-6 mx-auto flex flex-col items-center">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px] items-center">
              <div className="flex flex-col justify-center items-center space-y-4">
                <div className="space-y-2 text-center">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    Unleash the Power of Conversational AI
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl mx-auto">
                    SimplyTalk empowers you to create custom AI Assistants that seamlessly integrate
                    with your business.
                  </p>
                </div>
                {!showForm && (
                  <Button
                    className="bg-[#64bbc3] hover:bg-[#57aab0] text-white w-fit"
                    onClick={() => setShowForm(true)}
                  >
                    Create AI Assistant
                  </Button>
                )}
                {showForm && (
                  <div className="w-full max-w-md">
                    <div className="flex mb-6">
                      <button
                        className={`flex-1 py-2 text-center ${
                          assistantType === 'vapi'
                            ? 'bg-white text-[#1e293b]'
                            : 'bg-[#e2e8f0] text-[#64748b]'
                        }`}
                        onClick={() => {
                          setAssistantType('vapi');
                          setSelectedTemplate(null); // Reset selected template
                        }}
                      >
                        Custom Assistant
                      </button>
                      <button
                        className={`flex-1 py-2 text-center ${
                          assistantType === 'openai-realtime'
                            ? 'bg-white text-[#1e293b]'
                            : 'bg-[#e2e8f0] text-[#64748b]'
                        }`}
                        onClick={() => {
                          setAssistantType('openai-realtime');
                          setSelectedTemplate(null); // Reset selected template
                        }}
                      >
                        OpenAI Realtime Assistant
                      </button>
                      <button
                        className={`flex-1 py-2 text-center ${
                          assistantType === 'templates'
                            ? 'bg-white text-[#1e293b]'
                            : 'bg-[#e2e8f0] text-[#64748b]'
                        }`}
                        onClick={() => {
                          setAssistantType('templates');
                          setSelectedTemplate(null); // Reset selected template
                        }}
                      >
                        Templates
                      </button>
                    </div>
                    {assistantType === 'openai-realtime' && (
                      <p className="text-xs text-[#64748b] mb-4">
                        Powered by OpenAI advanced voice mode
                      </p>
                    )}
                    {assistantType === 'vapi' ? (
                      // VAPI Assistant form remains unchanged
                      <form onSubmit={handleVapiAssistantCreation} className="space-y-4">
                        {/* Existing form fields for VAPI assistant */}
                        <Input
                          type="text"
                          placeholder="Assistant Name"
                          value={assistantName}
                          onChange={(e) => setAssistantName(e.target.value)}
                          required
                        />
                        <Textarea
                          placeholder="System Prompt"
                          value={systemPrompt}
                          onChange={(e) => setSystemPrompt(e.target.value)}
                          required
                        />
                        <Input
                          type="text"
                          placeholder="First Message"
                          value={firstMessage}
                          onChange={(e) => setFirstMessage(e.target.value)}
                          required
                        />
                        <div className="flex items-center space-x-2">
                          <Input
                            type="file"
                            id="training-content"
                            onChange={(e) => setTrainingFile(e.target.files?.[0] || null)}
                            accept=".pdf,.doc,.docx,.txt,.md"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => document.getElementById('training-content')?.click()}
                            className="px-4 py-2 border border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9] rounded-md flex items-center"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Choose Training Content
                          </button>
                          <span className="text-sm text-[#64748b]">
                            {trainingFile ? trainingFile.name : 'No file chosen'}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <Input
                            type="text"
                            placeholder="Enter website URL"
                            value={urlToScrape}
                            onChange={(e) => setUrlToScrape(e.target.value)}
                          />
                          <Button
                            type="button"
                            onClick={handleScrapeWebsite}
                            disabled={isLoading}
                            className="px-4 py-2 bg-[#64bbc3] hover:bg-[#2563eb] text-white rounded-md"
                          >
                            {isLoading ? 'Scraping...' : 'Scrape'}
                          </Button>
                        </div>
                        {scrapedUrls.length > 0 && (
                          <div>
                            <Label>Scraped URLs</Label>
                            <ul className="list-disc pl-5">
                              {scrapedUrls.map((url, index) => (
                                <li key={index}>{url}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <Button
                          type="submit"
                          disabled={isLoading}
                          className="w-full py-2 bg-[#64bbc3] hover:bg-[#2563eb] text-white rounded-md"
                        >
                          {isLoading ? 'Creating...' : 'Create Custom Assistant'}
                        </Button>
                        {error && <p className="text-red-500">{error}</p>}
                      </form>
                    ) : assistantType === 'openai-realtime' ? (
                      // OpenAI Realtime Assistant form
                      <form onSubmit={handleOpenAIRealtimeAssistantCreation} className="space-y-4">
                        <Input
                          type="text"
                          placeholder="Assistant Name"
                          value={assistantName}
                          onChange={(e) => setAssistantName(e.target.value)}
                          required
                        />
                        <Textarea
                          placeholder="Instructions"
                          value={systemPrompt}
                          onChange={(e) => setSystemPrompt(e.target.value)}
                          required
                        />
                        <Input
                          type="password"
                          placeholder="OpenAI API Key (optional)"
                          value={openaiApiKey}
                          onChange={(e) => setOpenaiApiKey(e.target.value)}
                        />
                        {/* Voice settings and other parameters */}
                        <div className="space-y-2">
                          <Label htmlFor="voice-select" className="text-sm font-medium text-[#1e293b]">
                            Choose your voice
                          </Label>
                          <select
                            id="voice-select"
                            className="w-full px-3 py-2 border border-[#e2e8f0] rounded-md bg-white"
                            value={voiceSettings}
                            onChange={(e) => setVoiceSettings(e.target.value)}
                          >
                            <option value="alloy">Alloy (female)</option>
                            <option value="echo">Echo (male)</option>
                            <option value="shimmer">Shimmer (female)</option>
                          </select>
                        </div>
                        {/* Additional parameters with titles and tooltips */}
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="threshold" className="flex items-center">
                              Activation Threshold
                              <span
                                className="ml-1 text-[#64748b] cursor-pointer"
                                title="Activation threshold for Voice Activity Detection (VAD) (0.0 to 1.0). A higher value means more confidence is needed to detect speech."
                              >
                                ⓘ
                              </span>
                            </Label>
                            <Input
                              id="threshold"
                              type="number"
                              step="0.01"
                              placeholder="Threshold (default: 0.5)"
                              value={threshold}
                              onChange={(e) => setThreshold(parseFloat(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="prefixPadding" className="flex items-center">
                              Prefix Padding (ms)
                              <span
                                className="ml-1 text-[#64748b] cursor-pointer"
                                title="The amount of audio (in milliseconds) to include before speech starts."
                              >
                                ⓘ
                              </span>
                            </Label>
                            <Input
                              id="prefixPadding"
                              type="number"
                              placeholder="Prefix Padding (ms) (default: 500)"
                              value={prefixPaddingMs}
                              onChange={(e) => setPrefixPaddingMs(parseInt(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="silenceDuration" className="flex items-center">
                              Silence Duration (ms)
                              <span
                                className="ml-1 text-[#64748b] cursor-pointer"
                                title="The duration of silence (in milliseconds) required to detect the end of speech."
                              >
                                ⓘ
                              </span>
                            </Label>
                            <Input
                              id="silenceDuration"
                              type="number"
                              placeholder="Silence Duration (ms) (default: 300)"
                              value={silenceDurationMs}
                              onChange={(e) => setSilenceDurationMs(parseInt(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="temperature" className="flex items-center">
                              Temperature
                              <span
                                className="ml-1 text-[#64748b] cursor-pointer"
                                title="Sampling temperature for the model, controls the randomness of responses (higher values = more random, lower values = more focused)."
                              >
                                ⓘ
                              </span>
                            </Label>
                            <Input
                              id="temperature"
                              type="number"
                              step="0.01"
                              placeholder="Temperature (default: 0.6)"
                              value={temperature}
                              onChange={(e) => setTemperature(parseFloat(e.target.value))}
                            />
                          </div>
                        </div>
                        {/* File upload */}
                        <div className="flex items-center space-x-2">
                          <Input
                            type="file"
                            id="training-content-openai"
                            onChange={handleFileUploadOpenAI}
                            accept=".pdf,.doc,.docx,.txt,.md"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              document.getElementById('training-content-openai')?.click()
                            }
                            className="px-4 py-2 border border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9] rounded-md flex items-center"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Choose Training Content
                          </button>
                          {trainingFileOpenAI && (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-[#64748b]">
                                {trainingFileOpenAI.name}
                              </span>
                              <XCircle
                                className="h-5 w-5 text-red-500 cursor-pointer"
                                onClick={removeUploadedFileOpenAI}
                              />
                            </div>
                          )}
                        </div>
                        {/* Web scraping */}
                        <div className="flex space-x-2">
                          <Input
                            type="text"
                            placeholder="Enter website URL"
                            value={urlToScrapeOpenAI}
                            onChange={(e) => setUrlToScrapeOpenAI(e.target.value)}
                          />
                          <Button
                            type="button"
                            onClick={handleScrapeWebsiteOpenAI}
                            disabled={isLoading}
                            className="px-4 py-2 bg-[#64bbc3] hover:bg-[#57aab0] text-white rounded-md"
                          >
                            {isLoading ? 'Scraping...' : 'Scrape'}
                          </Button>
                        </div>
                        {scrapedUrlsOpenAI.length > 0 && (
                          <div>
                            <Label>Scraped URLs</Label>
                            <ul className="list-disc pl-5">
                              {scrapedUrlsOpenAI.map((url, index) => (
                                <li key={index} className="flex items-center space-x-2">
                                  <span>{url}</span>
                                  <XCircle
                                    className="h-5 w-5 text-red-500 cursor-pointer"
                                    onClick={() => removeScrapedUrlOpenAI(url)}
                                  />
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <Button
                          type="submit"
                          disabled={isLoading}
                          className="w-full py-2 bg-[#64bbc3] hover:bg-[#57aab0] text-white rounded-md"
                        >
                          {isLoading ? 'Creating...' : 'Create OpenAI Realtime Assistant'}
                        </Button>
                        {error && <p className="text-red-500">{error}</p>}
                      </form>
                    ) : (
                      // Templates section
                      <div>
                        {selectedTemplate ? (
                          // Show the OpenAI Realtime Assistant form with pre-filled fields
                          <form onSubmit={handleOpenAIRealtimeAssistantCreation} className="space-y-4">
                            <Input
                              type="text"
                              placeholder="Assistant Name"
                              value={assistantName}
                              onChange={(e) => setAssistantName(e.target.value)}
                              required
                            />
                            <Textarea
                              placeholder="Instructions"
                              value={systemPrompt}
                              onChange={(e) => setSystemPrompt(e.target.value)}
                              required
                            />
                            <Input
                              type="password"
                              placeholder="OpenAI API Key (optional)"
                              value={openaiApiKey}
                              onChange={(e) => setOpenaiApiKey(e.target.value)}
                            />
                            {/* Voice settings and other parameters */}
                            <div className="space-y-2">
                              <Label
                                htmlFor="voice-select"
                                className="text-sm font-medium text-[#1e293b]"
                              >
                                Choose your voice
                              </Label>
                              <select
                                id="voice-select"
                                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-md bg-white"
                                value={voiceSettings}
                                onChange={(e) => setVoiceSettings(e.target.value)}
                              >
                                <option value="alloy">Alloy (female)</option>
                                <option value="echo">Echo (male)</option>
                                <option value="shimmer">Shimmer (female)</option>
                              </select>
                            </div>
                            {/* Additional parameters with titles and tooltips */}
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="threshold" className="flex items-center">
                                  Activation Threshold
                                  <span
                                    className="ml-1 text-[#64748b] cursor-pointer"
                                    title="Activation threshold for Voice Activity Detection (VAD) (0.0 to 1.0). A higher value means more confidence is needed to detect speech."
                                  >
                                    ⓘ
                                  </span>
                                </Label>
                                <Input
                                  id="threshold"
                                  type="number"
                                  step="0.01"
                                  placeholder="Threshold (default: 0.5)"
                                  value={threshold}
                                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                                />
                              </div>
                              <div>
                                <Label htmlFor="prefixPadding" className="flex items-center">
                                  Prefix Padding (ms)
                                  <span
                                    className="ml-1 text-[#64748b] cursor-pointer"
                                    title="The amount of audio (in milliseconds) to include before speech starts."
                                  >
                                    ⓘ
                                  </span>
                                </Label>
                                <Input
                                  id="prefixPadding"
                                  type="number"
                                  placeholder="Prefix Padding (ms) (default: 500)"
                                  value={prefixPaddingMs}
                                  onChange={(e) => setPrefixPaddingMs(parseInt(e.target.value))}
                                />
                              </div>
                              <div>
                                <Label htmlFor="silenceDuration" className="flex items-center">
                                  Silence Duration (ms)
                                  <span
                                    className="ml-1 text-[#64748b] cursor-pointer"
                                    title="The duration of silence (in milliseconds) required to detect the end of speech."
                                  >
                                    ⓘ
                                  </span>
                                </Label>
                                <Input
                                  id="silenceDuration"
                                  type="number"
                                  placeholder="Silence Duration (ms) (default: 300)"
                                  value={silenceDurationMs}
                                  onChange={(e) => setSilenceDurationMs(parseInt(e.target.value))}
                                />
                              </div>
                              <div>
                                <Label htmlFor="temperature" className="flex items-center">
                                  Temperature
                                  <span
                                    className="ml-1 text-[#64748b] cursor-pointer"
                                    title="Sampling temperature for the model, controls the randomness of responses (higher values = more random, lower values = more focused)."
                                  >
                                    ⓘ
                                  </span>
                                </Label>
                                <Input
                                  id="temperature"
                                  type="number"
                                  step="0.01"
                                  placeholder="Temperature (default: 0.6)"
                                  value={temperature}
                                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                />
                              </div>
                            </div>
                            {/* File upload */}
                            <div className="flex items-center space-x-2">
                              <Input
                                type="file"
                                id="training-content-openai"
                                onChange={handleFileUploadOpenAI}
                                accept=".pdf,.doc,.docx,.txt,.md"
                                className="hidden"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  document.getElementById('training-content-openai')?.click()
                                }
                                className="px-4 py-2 border border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9] rounded-md flex items-center"
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                Choose Training Content
                              </button>
                              {trainingFileOpenAI && (
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm text-[#64748b]">
                                    {trainingFileOpenAI.name}
                                  </span>
                                  <XCircle
                                    className="h-5 w-5 text-red-500 cursor-pointer"
                                    onClick={removeUploadedFileOpenAI}
                                  />
                                </div>
                              )}
                            </div>
                            {/* Web scraping */}
                            <div className="flex space-x-2">
                              <Input
                                type="text"
                                placeholder="Enter website URL"
                                value={urlToScrapeOpenAI}
                                onChange={(e) => setUrlToScrapeOpenAI(e.target.value)}
                              />
                              <Button
                                type="button"
                                onClick={handleScrapeWebsiteOpenAI}
                                disabled={isLoading}
                                className="px-4 py-2 bg-[#64bbc3] hover:bg-[#57aab0] text-white rounded-md"
                              >
                                {isLoading ? 'Scraping...' : 'Scrape'}
                              </Button>
                            </div>
                            {scrapedUrlsOpenAI.length > 0 && (
                              <div>
                                <Label>Scraped URLs</Label>
                                <ul className="list-disc pl-5">
                                  {scrapedUrlsOpenAI.map((url, index) => (
                                    <li key={index} className="flex items-center space-x-2">
                                      <span>{url}</span>
                                      <XCircle
                                        className="h-5 w-5 text-red-500 cursor-pointer"
                                        onClick={() => removeScrapedUrlOpenAI(url)}
                                      />
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <Button
                              type="submit"
                              disabled={isLoading}
                              className="w-full py-2 bg-[#64bbc3] hover:bg-[#57aab0] text-white rounded-md"
                            >
                              {isLoading ? 'Creating...' : 'Create Assistant'}
                            </Button>
                            {error && <p className="text-red-500">{error}</p>}
                          </form>
                        ) : (
                          // Display list of templates with enhanced design
                          <div className="space-y-4">
                            <h3 className="text-xl font-semibold mb-6">Choose a Template</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {templatesList.map((template) => (
                                <div
                                  key={template.key}
                                  className="p-6 bg-white shadow-md rounded-lg flex flex-col"
                                >
                                  <h4 className="text-xl font-bold mb-2 break-words">
                                    {template.displayName}
                                  </h4>
                                  <p className="text-sm text-gray-700 mb-4">
                                    {template.summary}
                                  </p>
                                  <Button
                                    className="mt-auto bg-blue-500 hover:bg-blue-600 text-white w-full"
                                    onClick={() => {
                                      setAssistantName(template.displayName);
                                      setSystemPrompt(TEMPLATES[template.key]);
                                      setSelectedTemplate(template.key);
                                      setAssistantType('templates');
                                    }}
                                  >
                                    Select Template
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Placeholder for illustration or other content */}
              <div className="bg-[#f1f5f9] p-12 rounded-lg flex justify-center items-center">
                <Image
                  src="/placeholder.png"
                  alt="AI Agent Illustration"
                  width={600}
                  height={600}
                  className="rounded-lg"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Rest of the content remains unchanged */}
      </main>
      {/* Footer */}
      <footer className="bg-white border-t border-[#e2e8f0] py-6 w-full">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <Image
                src="/static/logo.png"
                alt="SimplyTalk.ai Logo"
                width={150}
                height={75}
              />
              <span className="text-sm font-medium">
                © {new Date().getFullYear()} SimplyTalk All rights reserved.
              </span>
            </div>
            <nav className="flex gap-4">
              <Link href="#" className="text-sm hover:underline">
                Terms
              </Link>
              <Link href="#" className="text-sm hover:underline">
                Privacy
              </Link>
              <Link href="#" className="text-sm hover:underline">
                Contact
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
