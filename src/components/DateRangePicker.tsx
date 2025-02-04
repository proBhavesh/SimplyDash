import React, { useState } from 'react';
import { DateRange, Range, RangeKeyDict } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { Button } from "@/components/ui/button"
import { CalendarIcon } from 'lucide-react'

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (range: { startDate: Date; endDate: Date }) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localRange, setLocalRange] = useState<Range[]>([
    {
      startDate: startDate,
      endDate: endDate,
      key: 'selection'
    }
  ]);

  const handleSelect = (ranges: RangeKeyDict) => {
    setLocalRange([ranges.selection]);
  };

  const handleApply = () => {
    onChange({
      startDate: localRange[0].startDate!,
      endDate: localRange[0].endDate!
    });
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Button 
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className="w-full justify-start text-left font-normal"
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
      </Button>
      {isOpen && (
        <div className="absolute z-50 mt-2 bg-white shadow-lg rounded-lg p-4">
          <DateRange
            ranges={localRange}
            onChange={handleSelect}
            months={2}
            direction="horizontal"
            weekStartsOn={1}
          />
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setIsOpen(false)} variant="outline" className="mr-2">
              Cancel
            </Button>
            <Button onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};