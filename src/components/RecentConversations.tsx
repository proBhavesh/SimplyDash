import React from 'react';
import { RecentConversationsProps } from '../types/assistant'; // Updated import

export const RecentConversations: React.FC<RecentConversationsProps> = ({
  conversations
}) => {
  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          Recent Conversations
        </h3>
        <ul className="divide-y divide-gray-200">
          {conversations.map((conversation) => (
            <li key={conversation.id} className="py-4">
              <p className="text-sm font-medium text-gray-900">{conversation.user}</p>
              <p className="text-sm text-gray-500">{new Date(conversation.timestamp).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default RecentConversations;