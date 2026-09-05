import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface M3SelectorOption<T extends string = string> {
  id: T;
  name: string;
  desc?: string;
  fontFamily?: string;
  badge?: string;
}

export interface M3SelectorProps<T extends string = string> {
  value: T;
  onChange: (val: T) => void;
  options: readonly M3SelectorOption<T>[] | M3SelectorOption<T>[];
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export const M3Selector = <T extends string>({
  value,
  onChange,
  options,
  label,
  icon,
  className = '',
  size = 'md',
}: M3SelectorProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1.5 ${className}`}>
      {label && (
        <span className="text-zinc-300 font-semibold flex items-center gap-1.5 text-xs">
          {icon && <span style={{ color: 'var(--color-stop-1, #6366f1)' }}>{icon}</span>}
          {label}
        </span>
      )}

      {/* M3 Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={
          isOpen
            ? {
                borderColor: 'var(--color-stop-1, #6366f1)',
                boxShadow: '0 0 0 1px var(--color-stop-1, #6366f1)',
              }
            : undefined
        }
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800/90 border border-white/10 text-xs text-white transition-all text-left group ${
          size === 'sm' ? 'py-1.5 px-2.5 text-[11px]' : 'py-2 px-3 text-xs'
        }`}
      >
        <div className="flex flex-col min-w-0 flex-1">
          <span
            className="font-medium truncate"
            style={selectedOption?.fontFamily ? { fontFamily: selectedOption.fontFamily } : undefined}
          >
            {selectedOption?.name ?? value}
          </span>
          {selectedOption?.desc && (
            <span className="text-[10px] text-zinc-400 truncate mt-0.5">{selectedOption.desc}</span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-zinc-400 transition-transform duration-200 shrink-0 group-hover:text-white ${
            isOpen ? 'rotate-180' : ''
          }`}
          style={isOpen ? { color: 'var(--color-stop-1, #6366f1)' } : undefined}
        />
      </button>

      {/* M3 Floating Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-64 overflow-y-auto custom-scrollbar glass-panel bg-zinc-950/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-1.5 flex flex-col gap-1"
          >
            {options.map((opt) => {
              const isSelected = opt.id === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'text-white font-semibold'
                      : 'text-zinc-300 hover:text-white hover:bg-white/10'
                  }`}
                  style={
                    isSelected
                      ? {
                          background:
                            'linear-gradient(135deg, color-mix(in srgb, var(--color-stop-1, #6366f1) 85%, transparent), color-mix(in srgb, var(--color-stop-2, #818cf8) 75%, transparent))',
                          boxShadow: '0 4px 12px -2px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                        }
                      : undefined
                  }
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      className="text-xs truncate"
                      style={opt.fontFamily ? { fontFamily: opt.fontFamily } : undefined}
                    >
                      {opt.name}
                    </span>
                    {opt.desc && (
                      <span
                        className={`text-[10px] truncate ${
                          isSelected ? 'text-white/80' : 'text-zinc-400'
                        }`}
                      >
                        {opt.desc}
                      </span>
                    )}
                  </div>

                  {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
