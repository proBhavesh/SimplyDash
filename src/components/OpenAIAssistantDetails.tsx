import React, { useState } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

interface OpenAIAssistantData {
  name: string;
  instructions: string;
  voiceSettings: string;
  threshold: number;
  prefix_padding_ms: number;
  silence_duration_ms: number;
  temperature: number;
  apiKey?: string;
  isSubscribed: boolean;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any; // For any additional dynamic properties
}

interface OpenAIAssistantDetailProps {
  assistant: OpenAIAssistantData;
  editedAssistant: OpenAIAssistantData | null;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  setEditedAssistant: React.Dispatch<React.SetStateAction<OpenAIAssistantData | null>>;
  fieldsToShow?: string[]; // Added fieldsToShow prop
}

const OpenAIAssistantDetails: React.FC<OpenAIAssistantDetailProps> = ({
  assistant,
  editedAssistant,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  setEditedAssistant,
  fieldsToShow,
}) => {
  // Define labels for the fields
  const fieldLabels: { [key: string]: string } = {
    name: 'Name',
    instructions: 'Instructions',
    voiceSettings: 'Voice Settings',
    threshold: 'Threshold',
    prefix_padding_ms: 'Prefix Padding (ms)',
    silence_duration_ms: 'Silence Duration (ms)',
    temperature: 'Temperature',
    apiKey: 'OpenAI API Key',
    isSubscribed: 'Is Subscribed',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
  };

  // Determine which fields to render
  const fieldsToRender = fieldsToShow || Object.keys(fieldLabels);

  // State variable to manage expanded state of instructions
  const [isExpanded, setIsExpanded] = useState(false);

  // Define a function to render each field conditionally
  const renderField = (fieldName: string) => {
    const label = fieldLabels[fieldName] || fieldName;
    switch (fieldName) {
      case 'name':
        return (
          <div key={fieldName}>
            <Label htmlFor="name">{label}</Label>
            {isEditing ? (
              <Input
                id="name"
                value={editedAssistant?.name || ''}
                onChange={(e) =>
                  setEditedAssistant((prev) =>
                    prev ? { ...prev, name: e.target.value } : null
                  )
                }
              />
            ) : (
              <p className="mt-1">{assistant.name}</p>
            )}
          </div>
        );
      case 'instructions':
        return (
          <div key={fieldName}>
            <Label htmlFor="instructions">{label}</Label>
            {isEditing ? (
              <Textarea
                id="instructions"
                value={editedAssistant?.instructions || ''}
                onChange={(e) =>
                  setEditedAssistant((prev) =>
                    prev ? { ...prev, instructions: e.target.value } : null
                  )
                }
              />
            ) : (
              <div className="mt-1">
                <div
                  className={`border p-2 rounded ${
                    isExpanded ? '' : 'max-h-40 overflow-auto'
                  }`}
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {assistant.instructions || 'Not set'}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? 'Collapse' : 'Enlarge'}
                </Button>
              </div>
            )}
          </div>
        );
      case 'voiceSettings':
        return (
          <div key={fieldName}>
            <Label htmlFor="voiceSettings">{label}</Label>
            {isEditing ? (
              <Input
                id="voiceSettings"
                value={editedAssistant?.voiceSettings || ''}
                onChange={(e) =>
                  setEditedAssistant((prev) =>
                    prev ? { ...prev, voiceSettings: e.target.value } : null
                  )
                }
              />
            ) : (
              <p className="mt-1">{assistant.voiceSettings}</p>
            )}
          </div>
        );
      case 'threshold':
        return (
          <div key={fieldName}>
            <Label htmlFor="threshold">{label}</Label>
            {isEditing ? (
              <Input
                id="threshold"
                type="number"
                step="0.01"
                value={editedAssistant?.threshold || 0}
                onChange={(e) =>
                  setEditedAssistant((prev) =>
                    prev ? { ...prev, threshold: parseFloat(e.target.value) } : null
                  )
                }
              />
            ) : (
              <p className="mt-1">{assistant.threshold}</p>
            )}
          </div>
        );
      case 'prefix_padding_ms':
        return (
          <div key={fieldName}>
            <Label htmlFor="prefix_padding_ms">{label}</Label>
            {isEditing ? (
              <Input
                id="prefix_padding_ms"
                type="number"
                value={editedAssistant?.prefix_padding_ms || 0}
                onChange={(e) =>
                  setEditedAssistant((prev) =>
                    prev
                      ? { ...prev, prefix_padding_ms: parseInt(e.target.value) }
                      : null
                  )
                }
              />
            ) : (
              <p className="mt-1">{assistant.prefix_padding_ms}</p>
            )}
          </div>
        );
      case 'silence_duration_ms':
        return (
          <div key={fieldName}>
            <Label htmlFor="silence_duration_ms">{label}</Label>
            {isEditing ? (
              <Input
                id="silence_duration_ms"
                type="number"
                value={editedAssistant?.silence_duration_ms || 0}
                onChange={(e) =>
                  setEditedAssistant((prev) =>
                    prev
                      ? { ...prev, silence_duration_ms: parseInt(e.target.value) }
                      : null
                  )
                }
              />
            ) : (
              <p className="mt-1">{assistant.silence_duration_ms}</p>
            )}
          </div>
        );
      case 'temperature':
        return (
          <div key={fieldName}>
            <Label htmlFor="temperature">{label}</Label>
            {isEditing ? (
              <Input
                id="temperature"
                type="number"
                step="0.01"
                value={editedAssistant?.temperature || 0}
                onChange={(e) =>
                  setEditedAssistant((prev) =>
                    prev
                      ? { ...prev, temperature: parseFloat(e.target.value) } : null
                  )
                }
              />
            ) : (
              <p className="mt-1">{assistant.temperature}</p>
            )}
          </div>
        );
      case 'apiKey':
        return (
          <div key={fieldName}>
            <Label htmlFor="apiKey">{label}</Label>
            {isEditing ? (
              <Input
                id="apiKey"
                type="password"
                value={editedAssistant?.apiKey || ''}
                onChange={(e) =>
                  setEditedAssistant((prev) =>
                    prev ? { ...prev, apiKey: e.target.value } : null
                  )
                }
              />
            ) : (
              <p className="mt-1">{assistant.apiKey ? '********' : 'Not set'}</p>
            )}
          </div>
        );
      case 'isSubscribed':
        return (
          <div key={fieldName}>
            <Label>{label}</Label>
            <p className="mt-1">{assistant.isSubscribed ? 'Yes' : 'No'}</p>
          </div>
        );
      case 'createdAt':
        return (
          <div key={fieldName}>
            <Label>{label}</Label>
            <p className="mt-1">
              {assistant.createdAt
                ? new Date(assistant.createdAt.seconds * 1000).toLocaleString()
                : 'N/A'}
            </p>
          </div>
        );
      case 'updatedAt':
        return (
          <div key={fieldName}>
            <Label>{label}</Label>
            <p className="mt-1">
              {assistant.updatedAt
                ? new Date(assistant.updatedAt.seconds * 1000).toLocaleString()
                : 'N/A'}
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white shadow sm:rounded-lg my-6">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            OpenAI Assistant Details
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
          {fieldsToRender.map((field) => renderField(field))}
        </div>
      </div>
    </div>
  );
};

export default OpenAIAssistantDetails;
