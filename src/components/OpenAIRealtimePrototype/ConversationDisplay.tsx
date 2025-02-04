import React, { useEffect, useRef } from 'react';

interface AudioContent {
  type: 'audio' | 'input_audio';
  transcript?: string;
  audio?: string;
}

interface TextContent {
  type: 'text';
  text: string;
}

type MessageContent = AudioContent | TextContent;

interface ConversationItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type: 'message' | 'function_call' | 'function_call_output';
  content: MessageContent[] | string;
  status: 'pending' | 'completed' | 'interrupted';
  formatted: {
    text?: string;
    transcript?: string;
    audio?: string;
    file?: { url: string };
  };
}

interface ConversationDisplayProps {
  conversationItems: ConversationItem[];
  onAssistantStreamingChange: (isStreaming: boolean) => void;
}

const ConversationDisplay: React.FC<ConversationDisplayProps> = ({ 
  conversationItems, 
  onAssistantStreamingChange 
}) => {
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  useEffect(() => {
    const latestAssistantItem = [...conversationItems].reverse().find(item => item.role === 'assistant');
    if (latestAssistantItem && latestAssistantItem.formatted.file) {
      const audio = audioRefs.current[latestAssistantItem.id];
      if (audio) {
        audio.onplay = () => onAssistantStreamingChange(true);
        audio.onpause = () => onAssistantStreamingChange(false);
        audio.onended = () => onAssistantStreamingChange(false);
      }
    }
  }, [conversationItems, onAssistantStreamingChange]);

  const getDisplayContent = (item: ConversationItem): string => {
    if (typeof item.content === 'string') {
      return item.content;
    }

    return item.content
      .map(content => {
        if (content.type === 'text') return content.text;
        if (content.type === 'audio' || content.type === 'input_audio') return content.transcript;
        return '';
      })
      .filter(Boolean)
      .join(' ');
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-2">Conversation</h3>
      <div className="h-80 overflow-y-auto border p-2 mb-4">
        {conversationItems.map((item) => (
          <div key={item.id} className={`mb-4 p-2 rounded ${item.role === 'assistant' ? 'bg-blue-100' : 'bg-green-100'}`}>
            <strong className="text-lg">{item.role === 'assistant' ? 'Assistant' : 'User'}:</strong>
            <div className="mt-1">{getDisplayContent(item)}</div>
            {item.status === 'pending' && <span className="ml-2 text-yellow-500">(pending)</span>}
            {item.status === 'interrupted' && <span className="ml-2 text-red-500">(interrupted)</span>}
            {item.role === 'user' && item.formatted.transcript && (
              <div className="mt-1 text-sm text-gray-600">Transcript: {item.formatted.transcript}</div>
            )}
            {item.role === 'assistant' && item.formatted.file && (
              <audio
                ref={(el) => audioRefs.current[item.id] = el}
                src={item.formatted.file.url}
                controls
                className="mt-2 w-full"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConversationDisplay;
