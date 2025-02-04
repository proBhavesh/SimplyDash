import React from 'react';
import Image from 'next/image';

interface AssistantProfileProps {
  name: string;
  imageSrc: string;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

const AssistantProfile: React.FC<AssistantProfileProps> = ({
  name,
  imageSrc,
  isConnected,
  onConnect,
  onDisconnect,
}) => {
  return (
    <div className="text-center mb-6">
      <h1 className="text-3xl font-extrabold mb-4">{name}</h1>
      <div className="w-64 h-64 mx-auto mb-4">
        <Image
          src={imageSrc}
          alt="Assistant"
          width={256}
          height={256}
          objectFit="cover"
          className="rounded-full mx-auto shadow-lg"
        />
      </div>
      <div className="flex justify-center mb-6">
        {isConnected ? (
          <button
            onClick={onDisconnect}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full shadow-md transition duration-300"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-md transition duration-300"
          >
            Connect and Talk
          </button>
        )}
      </div>
    </div>
  );
};

export default AssistantProfile;
