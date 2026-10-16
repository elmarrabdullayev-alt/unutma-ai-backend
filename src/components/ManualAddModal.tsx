import React, { useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { motion } from 'motion/react';
import { X, Sparkles, Plus, Loader2 } from 'lucide-react';
import { Reminder } from '../types';
import { playSuccessSound } from '../utils/soundUtils';
import { apiClient } from '../services/apiClient';

interface ManualAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRemindersCreated: (newReminders: Reminder[], summary: string) => void;
}

export const ManualAddModal: React.FC<ManualAddModalProps> = ({
  isOpen,
  onClose,
  onRemindersCreated,
}) => {
  useEscapeKey(onClose);
  const [naturalText, setNaturalText] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAiParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalText.trim()) return;

    setIsAiProcessing(true);
    setErrorMessage(null);

    try {
      const data = await apiClient.parseReminder(
        naturalText,
        new Date().toISOString(),
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Baku'
      );

      if (!data.success) {
        throw new Error(data.error || 'Analiz zamanı xəta baş verdi');
      }

      const generatedReminders: Reminder[] = (data.reminders || []).map((r: any, idx: number) => ({
        id: `rem-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        title: r.title,
        description: r.description || '',
        dueDateTime: r.dueDateTime,
        category: r.category || 'other',
        recurrence: r.recurrence || 'none',
        priority: r.priority || 'medium',
        isCompleted: false,
        notificationEnabled: true,
        createdAt: new Date().toISOString(),
        sourceVoiceText: naturalText,
      }));

      playSuccessSound();
      onRemindersCreated(generatedReminders, data.summary);
      setNaturalText('');
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Xatırlatma yaradıla bilmədi');
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink-950/70 backdrop-blur-sm"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
        onClick={(e) => e.stopPropagation()}
        id="manual-add-modal"
        className="relative w-full max-w-md rounded-[22px] border border-white/[0.08] bg-[#1d161c] p-5 shadow-2xl text-[#f8f2ec]"
      >
        <motion.button
          whileTap={{ scale: 0.95 }}
          id="close-manual-modal-btn"
          onClick={onClose}
          aria-label="Bağla"
          className="absolute right-3.5 top-3.5 flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full bg-white/[0.04] text-[#c3b2ba] hover:text-[#f8f2ec] transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </motion.button>

        <div className="flex items-center gap-2.5 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e2a332]/20 text-[#f1c868] border border-[#e2a332]/30">
            <Plus className="h-4 w-4" />
          </div>
          <h3 className="font-semibold text-base text-[#f8f2ec]">Xatırlatma yarat</h3>
        </div>

        <p className="text-xs text-[#c3b2ba] mb-4">
          Cümləni yazın. Tarix və vaxt avtomatik müəyyən ediləcək.
        </p>

        <form onSubmit={handleAiParse} className="space-y-4">
          <div>
            <textarea
              id="manual-natural-input"
              rows={3}
              required
              value={naturalText}
              onChange={(e) => setNaturalText(e.target.value)}
              placeholder="Məsələn: Sabah saat 16:30-da görüş və 18:00-da market..."
              className="w-full resize-none rounded-[16px] border border-white/[0.06] bg-[#1d161c] p-3 text-xs text-[#f8f2ec] placeholder-[#c3b2ba]/60 focus:border-[#e2a332]/60 focus:outline-none transition-colors"
            />
          </div>

          {errorMessage && (
            <p className="text-xs text-[#e14762] bg-[#e14762]/10 p-2.5 rounded-[12px] border border-[#e14762]/20">
              {errorMessage}
            </p>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            id="submit-manual-parse-btn"
            type="submit"
            disabled={isAiProcessing || !naturalText.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#e2a332] hover:bg-[#c78626] py-3 text-xs font-medium text-white disabled:opacity-40 transition-all shadow-sm"
          >
            {isAiProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Yadda saxlanılır...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Yadda saxla</span>
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
};
