import React from 'react';

interface ProcessStatusData {
  total_stories: number;
  processed_stories: number;
  status: string;
  success_count: number;
  failure_count: number;
  total_time: number;
  start_time: number;
  message: string;
  note: string;
}

interface ProcessStatusProps {
  isProcessing: boolean;
  uploadProgress: number;
  processStatus: ProcessStatusData | null;
  error: string | null;
}

const ProcessStatus: React.FC<ProcessStatusProps> = ({
  isProcessing,
  uploadProgress,
  processStatus,
  error,
}) => {
  return (
    <div>
      {isProcessing && (
        <div className="mt-6">
          <p className="font-semibold">
            Uploading PDF and analyzing your user stories (estimated 25 minutes)...
          </p>
          <div className="w-full bg-gray-300 rounded-full h-4 mt-2">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-500"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {processStatus && (
        <div className="mt-6">
          <p className="text-lg font-semibold">
            Status:{' '}
            <span
              className={`${
                processStatus.status === 'completed' ||
                processStatus.status === 'success'
                  ? 'text-green-600'
                  : processStatus.status === 'failed'
                  ? 'text-red-600'
                  : 'text-yellow-600'
              }`}
            >
              {processStatus.status === 'completed' ||
              processStatus.status === 'success'
                ? 'Fully optimized'
                : processStatus.status.charAt(0).toUpperCase() +
                  processStatus.status.slice(1)}
            </span>
          </p>
          <p className="mt-2">Message: {processStatus.message}</p>
          {processStatus.note && <p>Note: {processStatus.note}</p>}
          {processStatus.total_stories !== undefined && (
            <ul className="mt-4 list-disc list-inside">
              <li>Total Stories: {processStatus.total_stories}</li>
              <li>Processed Stories: {processStatus.processed_stories}</li>
              <li>Success Count: {processStatus.success_count}</li>
              <li>Failure Count: {processStatus.failure_count}</li>
              <li>
                Total Time: {processStatus.total_time.toFixed(2)} seconds
              </li>
            </ul>
          )}
        </div>
      )}

      {error && (
        <div className="mt-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default ProcessStatus;
