import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { handleError, ErrorResponse } from '../utils/errorHandler';
import toastUtils from '../utils/toast';
import { errorLogger } from '../utils/errorLogger';

declare global {
  interface Window {
    vapiSDK: any;
  }
}

interface VapiChatInterfaceProps {
  assistantId: string;
  waitingGifUrl: string;
  talkingGifUrl: string;
}

const VapiChatInterface: React.FC<VapiChatInterfaceProps> = ({ assistantId, waitingGifUrl, talkingGifUrl }) => {
  const vapiInstanceRef = useRef<any>(null);
  const [avatarState, setAvatarState] = useState<'idle' | 'speaking' | 'loading'>('idle');

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;

    if (!apiKey) {
      const error: ErrorResponse = {
        message: 'API key is missing. Please check your environment variables.',
        code: 'MISSING_API_KEY',
        details: { component: 'VapiChatInterface' }
      };
      handleError(error);
      errorLogger.error(error);
      return;
    }

    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/gh/VapiAI/html-script-tag@latest/dist/assets/index.js";
    script.async = true;
    script.onload = () => initializeVapi(apiKey);
    script.onerror = () => {
      const error: ErrorResponse = {
        message: 'Failed to load Vapi SDK script.',
        code: 'SCRIPT_LOAD_ERROR',
        details: { component: 'VapiChatInterface', scriptSrc: script.src }
      };
      handleError(error);
      errorLogger.error(error);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [assistantId]);

  const initializeVapi = (apiKey: string) => {
    if (window.vapiSDK) {
      const buttonConfig = {
        position: "bottom-right",
        offset: "10px",
        width: "50px",
        height: "50px",
        idle: {
          color: `rgb(93, 254, 202)`,
          type: "pill",
          title: "Need help?",
          subtitle: "Talk with our assistant",
          icon: `https://unpkg.com/lucide-static@0.321.0/icons/phone.svg`,
        },
        loading: {
          color: `rgb(93, 124, 202)`,
          type: "pill",
          title: "Connecting",
          subtitle: "Please wait...",
          icon: `https://unpkg.com/lucide-static@0.321.0/icons/loader-2.svg`,
        },
        active: {
          color: `rgb(255, 0, 0)`,
          type: "pill",
          title: "Live",
          subtitle: "Close the call",
          icon: `https://unpkg.com/lucide-static@0.321.0/icons/phone-off.svg`,
        },
      };

      try {
        vapiInstanceRef.current = window.vapiSDK.run({
          apiKey: apiKey,
          assistant: assistantId,
          config: buttonConfig,
        });

        toastUtils.success('Chat interface initialized successfully');

        // Add event listeners
        vapiInstanceRef.current.on('speech-start', () => {
          setAvatarState('speaking');
        });

        vapiInstanceRef.current.on('speech-end', () => {
          setAvatarState('idle');
        });

        vapiInstanceRef.current.on('call-start', () => {
          setAvatarState('idle');
          toastUtils.info('Call started');
        });

        vapiInstanceRef.current.on('call-end', () => {
          setAvatarState('idle');
          toastUtils.info('Call ended');
        });

        vapiInstanceRef.current.on('loading-start', () => {
          setAvatarState('loading');
        });

        vapiInstanceRef.current.on('loading-end', () => {
          setAvatarState('idle');
        });

        vapiInstanceRef.current.on('error', (error: any) => {
          const vapiError: ErrorResponse = {
            message: `Vapi SDK error: ${error.message || 'Unknown error'}`,
            code: 'VAPI_SDK_ERROR',
            details: { component: 'VapiChatInterface', originalError: error }
          };
          handleError(vapiError);
          errorLogger.error(vapiError);
        });

      } catch (err) {
        const initError: ErrorResponse = {
          message: 'Failed to initialize chat. Please try again later.',
          code: 'CHAT_INIT_ERROR',
          details: { component: 'VapiChatInterface', originalError: err }
        };
        handleError(initError);
        errorLogger.error(initError);
      }
    } else {
      const sdkError: ErrorResponse = {
        message: 'Chat functionality is currently unavailable. Please try again later.',
        code: 'SDK_NOT_FOUND',
        details: { component: 'VapiChatInterface' }
      };
      handleError(sdkError);
      errorLogger.error(sdkError);
    }
  };

  return (
    <div className="avatar-container relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
      <Image
        src={waitingGifUrl}
        alt="Écoute"
        fill
        priority
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        style={{ objectFit: 'contain', display: avatarState === 'idle' || avatarState === 'loading' ? 'block' : 'none' }}
      />
      <Image
        src={talkingGifUrl}
        alt="IA Parlante"
        fill
        priority
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        style={{ objectFit: 'contain', display: avatarState === 'speaking' ? 'block' : 'none' }}
      />
    </div>
  );
};

export default VapiChatInterface;