import React, { useState } from 'react';
import { X, Sparkles, Plus, Loader2 } from 'lucide-react';
import { Reminder, ReminderCategory, ReminderPriority, ReminderRecurrence } from '../types';
import { CATEGORIES } from '../utils/categoryMeta';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="manual-add-modal"
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-b from-[#111827] to-[#0F172A] p-6 shadow-2xl text-slate-50"
      >
        <button
          id="close-manual-modal-btn"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 border border-violet-500/30">
            <Plus className="h-4 w-4" />
          </div>
          <h3 className="font-bold text-base text-white">Yazılı Xatırlatma Əlavə Et</h3>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Təbii dildə yazın. AI tarixi, saatı və kateqoriyanı avtomatik müəyyən edəcək.
        </p>

        <form onSubmit={handleAiParse} className="space-y-4">
          <div>
            <textarea
              id="manual-natural-input"
              rows={3}
              required
              value={naturalText}
              onChange={(e) => setNaturalText(e.target.value)}
              placeholder="Məsələn: Cümə axşamı saat 16:30-da maşını texniki baxışa apar və 18:00-da uşağı bağçadan götür..."
              className="w-full resize-none rounded-2xl border border-white/5 bg-slate-800/40 p-3.5 text-xs text-slate-100 placeholder-slate-500 focus:border-violet-500/60 focus:outline-none transition-colors"
            />
          </div>

          {errorMessage && (
            <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
              {errorMessage}
            </p>
          )}

          <button
            id="submit-manual-parse-btn"
            type="submit"
            disabled={isAiProcessing || !naturalText.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 py-2.5 text-xs font-bold text-white hover:brightness-110 disabled:opacity-40 transition-all shadow-md shadow-violet-500/20 active:scale-98 border border-white/10"
          >
            {isAiProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI Analiz Edir...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                AI ilə Yaradın
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
