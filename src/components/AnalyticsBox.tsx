// src/components/AnalyticsBox.tsx

import React from 'react';
import { ClockIcon } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { AnalyticsBoxProps } from '../types/assistant'; // Updated import path
import { COST_PER_MINUTE } from '../constants/assistant-constants';

export const AnalyticsBox: React.FC<AnalyticsBoxProps> = ({
  analyticsData,
  dateRange,
  onDateRangeChange,
}) => {
  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          <ClockIcon className="inline-block mr-2" />
          Analytics
        </h3>
        <DateRangePicker
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onChange={onDateRangeChange}
        />
        <div className="mt-4">
          <p>Total Minutes: {analyticsData.totalMinutes}</p>
          <p>
            Total Cost: $
            {(analyticsData.totalMinutes * COST_PER_MINUTE).toFixed(2)}
          </p>
          <p>Total Calls: {analyticsData.totalCalls}</p>
          {analyticsData.callTypeBreakdown && (
            <>
              <h4 className="mt-2 font-semibold">Call Type Breakdown:</h4>
              <ul>
                {Object.entries(analyticsData.callTypeBreakdown).map(
                  ([type, data]) => (
                    <li key={type}>
                      {type}: {data.calls} calls, {data.minutes.toFixed(2)} minutes
                    </li>
                  )
                )}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsBox;
