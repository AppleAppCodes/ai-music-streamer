'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function CustomSelect({ options, value, onChange, placeholder }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div
        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white flex justify-between items-center cursor-pointer hover:border-white/20 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? 'text-white' : 'text-white/30'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-5 h-5 text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
            {options.map((option) => (
              <div
                key={option.value}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  value === option.value ? 'bg-indigo-500/20 text-indigo-300' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>{option.label}</span>
                {value === option.value && <Check className="w-4 h-4" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
