import React from 'react';

interface LogViewerProps {
  logs: string[];
  onClearLogs: () => void;
}

const LogViewer: React.FC<LogViewerProps> = ({ logs, onClearLogs }) => {
  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-2">Logs:</h2>
      <div className="border p-4 h-64 overflow-y-auto bg-white rounded-lg shadow-inner">
        {logs.length > 0 ? (
          logs.map((log, index) => (
            <p key={index} className="text-sm">
              {log}
            </p>
          ))
        ) : (
          <p className="text-sm text-gray-500">No logs yet.</p>
        )}
      </div>
      <button
        onClick={onClearLogs}
        className="mt-4 px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-full shadow-md transition duration-300"
      >
        Clear Logs
      </button>
    </div>
  );
};

export default LogViewer;
