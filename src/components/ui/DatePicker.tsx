import { forwardRef } from 'react';
import ReactDatePicker from 'react-datepicker';
import { format, parse } from 'date-fns';
import { Calendar } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

interface Props {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  minDate?: string;
  maxDate?: string;
}

export const DatePicker = forwardRef<any, Props>(({ value, onChange, label, minDate, maxDate }, ref) => {
  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
  
  return (
    <div className="flex flex-col w-full">
      {label && <label className="input-label">{label}</label>}
      <div className="relative w-full">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
          <Calendar size={14} className="text-surface-400" />
        </div>
        <ReactDatePicker
          selected={selectedDate}
          onChange={(date: Date | null) => {
            if (date) onChange(format(date, 'yyyy-MM-dd'));
          }}
          dateFormat="MMM d, yyyy"
          minDate={minDate ? parse(minDate, 'yyyy-MM-dd', new Date()) : undefined}
          maxDate={maxDate ? parse(maxDate, 'yyyy-MM-dd', new Date()) : undefined}
          className="input pl-9 text-sm text-surface-700 w-full cursor-pointer bg-white"
          wrapperClassName="w-full"
          showPopperArrow={false}
          popperPlacement="bottom-start"
        />
      </div>
    </div>
  );
});
