import { forwardRef } from 'react';
import ReactDatePicker from 'react-datepicker';
import { format, parse } from 'date-fns';
import { Clock } from 'lucide-react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  label?: string;
}

export const TimePicker = forwardRef<any, Props>(({ value, onChange, label }, ref) => {
  const selectedTime = value ? parse(value, 'HH:mm', new Date()) : null;
  
  return (
    <div className="flex flex-col w-full">
      {label && <label className="input-label">{label}</label>}
      <div className="relative w-full">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
          <Clock size={14} className="text-surface-400" />
        </div>
        <ReactDatePicker
          selected={selectedTime}
          onChange={(date: Date | null) => {
            if (date) onChange(format(date, 'HH:mm'));
          }}
          showTimeSelect
          showTimeSelectOnly
          timeIntervals={15}
          timeCaption="Time"
          dateFormat="HH:mm"
          timeFormat="HH:mm"
          className="input pl-9 text-sm text-surface-700 w-full cursor-pointer bg-white"
          wrapperClassName="w-full"
          showPopperArrow={false}
          popperPlacement="bottom-start"
        />
      </div>
    </div>
  );
});
