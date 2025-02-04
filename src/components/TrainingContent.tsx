import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileIcon, Trash2Icon, UploadIcon, LinkIcon } from 'lucide-react'
import axios from 'axios';
import toastUtils from "@/utils/toast"
import { auth } from '@/app/firebaseConfig';

export interface TrainingContentProps {
  assistantId: string;
  trainingFiles: Array<{
    id: string;
    name: string;
    size: number;
  }>;
  onFileChange: () => void;
}

const ALLOWED_FILE_TYPES = [
  'text/markdown',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export const TrainingContent: React.FC<TrainingContentProps> = ({
  assistantId,
  trainingFiles,
  onFileChange
}) => {
  const [uploading, setUploading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [url, setUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    console.log("Upload button clicked");
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File upload triggered");
    const file = event.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      console.log("Invalid file type:", file.type);
      toastUtils.error("Invalid file type. Please upload Markdown, PDF, plain text, or Microsoft Word files.");
      return;
    }

    console.log("File selected:", file.name);
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assistantId', assistantId);

    try {
      console.log("Getting auth token");
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        console.error("No auth token available");
        toastUtils.error("Authentication error. Please try logging in again.");
        return;
      }

      console.log("Sending file upload request");
      const response = await axios.post('/api/upload-file', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log("File upload response:", response.data);

      if (response.data && response.data.file) {
        onFileChange();
        toastUtils.success(`${file.name} has been added to the training content.`);
      } else {
        throw new Error('Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toastUtils.error("There was a problem uploading your file. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileDelete = async (fileId: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      await axios.delete(`/api/delete-file?assistantId=${assistantId}&fileId=${fileId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      onFileChange();
      toastUtils.success("The file has been removed from the training content.");
    } catch (error) {
      console.error('Error deleting file:', error);
      toastUtils.error("There was a problem deleting the file. Please try again.");
    }
  };

  const handleFileView = async (fileId: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await axios.get(`/api/get-file?assistantId=${assistantId}&fileId=${fileId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.data.url) {
        window.open(response.data.url, '_blank');
      } else {
        toastUtils.error("File URL not available.");
      }
    } catch (error) {
      console.error('Error viewing file:', error);
      toastUtils.error("There was a problem retrieving the file. Please try again.");
    }
  };

  const handleScrapeWebsite = async () => {
    if (!url) {
      toastUtils.error("Please enter a valid URL.");
      return;
    }

    setScraping(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        console.error("No auth token available");
        toastUtils.error("Authentication error. Please try logging in again.");
        return;
      }

      const response = await axios.post('/api/scrape-website', 
        { url, assistantId },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.data && response.data.file) {
        onFileChange();
        toastUtils.success(`Content from ${url} has been added to the training content.`);
        setUrl('');
      } else {
        throw new Error('Failed to scrape website');
      }
    } catch (error) {
      console.error('Error scraping website:', error);
      toastUtils.error("There was a problem scraping the website. Please try again.");
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          Training Content
        </h3>
        <ul className="divide-y divide-gray-200">
          {trainingFiles.map((file) => (
            <li key={file.id} className="py-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
              <div>
                <Button variant="outline" size="sm" className="mr-2" onClick={() => handleFileView(file.id)}>
                  <FileIcon className="mr-2 h-4 w-4" />
                  View
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleFileDelete(file.id)}>
                  <Trash2Icon className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-4">
          <div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
              accept=".md,.pdf,.txt,.doc,.docx"
            />
            <Button variant="outline" size="sm" disabled={uploading} onClick={handleUploadClick}>
              <UploadIcon className="mr-2 h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload New File'}
            </Button>
          </div>
          <div className="flex space-x-2">
            <Input
              type="url"
              placeholder="Enter website URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={scraping}
            />
            <Button variant="outline" size="sm" disabled={scraping} onClick={handleScrapeWebsite}>
              <LinkIcon className="mr-2 h-4 w-4" />
              {scraping ? 'Scraping...' : 'Scrape Website'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainingContent;