// pages/create-assistant.tsx

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { Header } from '../src/components/Header';
import { Input } from '../src/components/ui/input';
import { Textarea } from '../src/components/ui/textarea';
import { Button } from '../src/components/ui/button';
import { Label } from '../src/components/ui/label';
import toastUtils from '../src/utils/toast';
import { Upload, XCircle } from 'lucide-react';
import mammoth from 'mammoth';
import { Footer } from '../src/components/Footer'; // Import the Footer component

export default function CreateAssistantPage() {
  const [assistantType, setAssistantType] = useState<'vapi' | 'openai-realtime'>('vapi');
  const [assistantName, setAssistantName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [firstMessage, setFirstMessage] = useState('');

  // States specific to OpenAI Realtime Assistant
  const [trainingFileOpenAI, setTrainingFileOpenAI] = useState<File | null>(null);
  const [uploadedContentOpenAI, setUploadedContentOpenAI] = useState<string>('');
  const [scrapedUrlsOpenAI, setScrapedUrlsOpenAI] = useState<string[]>([]);
  const [scrapedContentsOpenAI, setScrapedContentsOpenAI] = useState<{ [url: string]: string }>({});
  const [urlToScrapeOpenAI, setUrlToScrapeOpenAI] = useState('');
  const [voiceSettings, setVoiceSettings] = useState('alloy');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [threshold, setThreshold] = useState(0.5);
  const [prefixPaddingMs, setPrefixPaddingMs] = useState(500);
  const [silenceDurationMs, setSilenceDurationMs] = useState(300);
  const [temperature, setTemperature] = useState(0.6);

  // VAPI assistant states
  const [trainingFile, setTrainingFile] = useState<File | null>(null);
  const [scrapedUrls, setScrapedUrls] = useState<string[]>([]);
  const [scrapedContent, setScrapedContent] = useState<{ [url: string]: string }>({});
  const [urlToScrape, setUrlToScrape] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        // Redirect to login page if not authenticated
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router]);

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
          // Handle .docx parsing on client side
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
      toastUtils.success('File uploaded successfully');
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
      setScrapedContent((prevContents) => ({
        ...prevContents,
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

  // VAPI Assistant - Remove scraped URL
  const removeScrapedUrl = (url: string) => {
    setScrapedUrls((prevUrls) => prevUrls.filter((u) => u !== url));
    setScrapedContent((prevContents) => {
      const newContents = { ...prevContents };
      delete newContents[url];
      return newContents;
    });
    toastUtils.success('Scraped URL removed');
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

      const response = await fetch('/api/create-authenticated-assistant-with-scraping', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await user?.getIdToken()}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to create assistant');
      }

      if (!data.id) {
        throw new Error('Assistant ID is undefined');
      }

      const assistantId = data.id;

      // Redirect to assistant detail page
      router.push(`/assistant/${assistantId}`);
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
        openaiApiKey: openaiApiKey || undefined,
      };

      const response = await fetch('/api/create-openai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user?.getIdToken()}`,
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

      const assistantId = data.id;

      // Redirect to assistant detail page
      router.push(`/assistant/${assistantId}`);
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

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 p-6">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold mb-6">Create New Assistant</h1>
          <div className="max-w-2xl mx-auto">
            <div className="flex mb-6">
              <button
                className={`flex-1 py-2 text-center ${
                  assistantType === 'vapi'
                    ? 'bg-white text-[#1e293b]'
                    : 'bg-[#e2e8f0] text-[#64748b]'
                }`}
                onClick={() => setAssistantType('vapi')}
              >
                Custom Assistant
              </button>
              <button
                className={`flex-1 py-2 text-center ${
                  assistantType === 'openai-realtime'
                    ? 'bg-white text-[#1e293b]'
                    : 'bg-[#e2e8f0] text-[#64748b]'
                }`}
                onClick={() => setAssistantType('openai-realtime')}
              >
                OpenAI Realtime Assistant
              </button>
            </div>
            {assistantType === 'openai-realtime' && (
              <p className="text-xs text-[#64748b] mb-4">
                Powered by OpenAI advanced voice mode
              </p>
            )}
            {assistantType === 'vapi' ? (
              // VAPI Assistant Form
              <form onSubmit={handleVapiAssistantCreation} className="space-y-4">
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
                    onChange={handleFileUpload}
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
                        <li key={index} className="flex items-center space-x-2">
                          <span>{url}</span>
                          <XCircle
                            className="h-5 w-5 text-red-500 cursor-pointer"
                            onClick={() => removeScrapedUrl(url)}
                          />
                        </li>
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
            ) : (
              // OpenAI Realtime Assistant Form
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
                {/* Voice Settings */}
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
                {/* Additional Parameters */}
                {/* Include input fields for threshold, prefixPaddingMs, silenceDurationMs, temperature */}
                {/* File Upload */}
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
                {/* Web Scraping */}
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
            )}
          </div>
        </div>
      </main>
      <Footer /> {/* Include the Footer component */}
    </div>
  );
}
