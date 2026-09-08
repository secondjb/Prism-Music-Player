import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, X } from 'lucide-react';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (playlistName: string) => void;
  title?: string;
  description?: string;
  defaultName?: string;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Create New Playlist',
  description = 'Enter a name for your new playlist.',
  defaultName = '',
}) => {
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-md p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="glass-panel border rounded-2xl p-5 shadow-2xl flex flex-col gap-4 max-w-sm w-full animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: '#141418f2',
          borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, rgba(255, 255, 255, 0.12))',
          boxShadow:
            '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 30px color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <span className="text-sm font-bold text-white flex items-center gap-2">
            <PlusCircle className="w-5 h-5 shrink-0" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {description && <p className="text-xs text-zinc-400">{description}</p>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Playlist name..."
            className="w-full bg-zinc-900 border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
            style={{
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, rgba(255, 255, 255, 0.12))',
            }}
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 rounded-xl text-white text-xs font-semibold transition-all disabled:opacity-40 hover:brightness-110 cursor-pointer shadow-md"
              style={{
                background: 'linear-gradient(135deg, var(--color-stop-1, #6366f1), var(--color-stop-2, #818cf8))',
                boxShadow: '0 4px 14px color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
              }}
            >
              Create Playlist
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
