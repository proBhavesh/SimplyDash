// src/components/AssistantDetails.tsx

import React from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { AssistantDetailProps } from '../types/assistant-types';

export const AssistantDetails: React.FC<AssistantDetailProps> = ({
  assistant,
  editedAssistant,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  setEditedAssistant,
}) => {
  return (
    <div className="bg-white shadow sm:rounded-lg my-6">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            AI Assistant Details
          </h3>
          {isEditing ? (
            <div>
              <Button onClick={onSave} className="mr-2">
                Save
              </Button>
              <Button onClick={onCancel} variant="outline">
                Cancel
              </Button>
            </div>
          ) : (
            <Button onClick={onEdit}>Edit</Button>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            {isEditing ? (
              <Input
                id="name"
                value={editedAssistant?.name || ''}
                onChange={(e) =>
                  setEditedAssistant((prev: any) =>
                    prev ? { ...prev, name: e.target.value } : null
                  )
                }
              />
            ) : (
              <p className="mt-1">{assistant.name}</p>
            )}
          </div>
          <div>
            <Label htmlFor="firstMessage">First Message</Label>
            {isEditing ? (
              <Textarea
                id="firstMessage"
                value={editedAssistant?.firstMessage || ''}
                onChange={(e) =>
                  setEditedAssistant((prev: any) =>
                    prev ? { ...prev, firstMessage: e.target.value } : null
                  )
                }
              />
            ) : (
              <p className="mt-1">{assistant.firstMessage || 'Not set'}</p>
            )}
          </div>
          <div>
            <Label htmlFor="systemPrompt">System Prompt</Label>
            {isEditing ? (
              <Textarea
                id="systemPrompt"
                value={
                  editedAssistant?.model?.messages.find((m: any) => m.role === 'system')
                    ?.content || ''
                }
                onChange={(e) => {
                  setEditedAssistant((prev: any) => {
                    if (!prev || !prev.model) return prev;
                    const updatedMessages = prev.model.messages.map((msg: any) =>
                      msg.role === 'system'
                        ? { ...msg, content: e.target.value }
                        : msg
                    );
                    if (!updatedMessages.some((msg: any) => msg.role === 'system')) {
                      updatedMessages.push({ role: 'system', content: e.target.value });
                    }
                    return { ...prev, model: { ...prev.model, messages: updatedMessages } };
                  });
                }}
              />
            ) : (
              <p className="mt-1">
                {assistant.model?.messages.find((m: any) => m.role === 'system')
                  ?.content || 'Not set'}
              </p>
            )}
          </div>
          <div>
            <Label>Created At</Label>
            <p className="mt-1">
              {assistant.createdAt
                ? new Date(assistant.createdAt.seconds * 1000).toLocaleString()
                : 'N/A'}
            </p>
          </div>
          <div>
            <Label>Updated At</Label>
            <p className="mt-1">
              {assistant.updatedAt
                ? new Date(assistant.updatedAt.seconds * 1000).toLocaleString()
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssistantDetails;
