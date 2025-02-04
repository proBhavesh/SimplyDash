// src/components/OpenAIGifUpload.tsx

import React from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';

interface OpenAIGifUploadProps {
  assistant: any;
  onGifUpload: (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'waiting' | 'talking'
  ) => void;
  isUploadingGif: boolean; // Added isUploadingGif prop
}

const OpenAIGifUpload: React.FC<OpenAIGifUploadProps> = ({
  assistant,
  onGifUpload,
  isUploadingGif,
}) => {
  return (
    <div className="bg-white shadow sm:rounded-lg my-6">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          Assistant GIFs
        </h3>
        {isUploadingGif && (
          <div className="mb-4 text-blue-500">
            Uploading GIF, please wait...
          </div>
        )}
        <div className="space-y-4">
          <div>
            <Label>Waiting GIF</Label>
            <div className="flex items-center mt-2">
              <img
                src={assistant.waitingGifUrl || '/static/yuboto.gif'}
                alt="Waiting GIF"
                className="w-16 h-16 mr-4"
              />
              <Input
                type="file"
                accept="image/gif"
                onChange={(e) => onGifUpload(e, 'waiting')}
              />
            </div>
          </div>
          <div>
            <Label>Talking GIF</Label>
            <div className="flex items-center mt-2">
              <img
                src={assistant.talkingGifUrl || '/static/yubotot.gif'}
                alt="Talking GIF"
                className="w-16 h-16 mr-4"
              />
              <Input
                type="file"
                accept="image/gif"
                onChange={(e) => onGifUpload(e, 'talking')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpenAIGifUpload;
