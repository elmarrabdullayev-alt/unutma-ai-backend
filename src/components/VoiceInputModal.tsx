import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  X,
  Volume2,
  Send,
  Loader2,
  CheckCircle,
  HelpCircle,
  Clock,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { SAMPLE_VOICE_PROMPTS } from '../utils/categoryMeta';
import { playMicStartSound, playSuccessSound } from '../utils/soundUtils';
import { ParsedReminderResult, Reminder } from '../types';
import { apiClient } from '../services/apiClient';
import { speechManager } from '../services/speech/SpeechProviderManager';
import { intelligentRouter } from '../services/intelligentRouter';
import { reminderService } from '../services/reminderService';

interface VoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRemindersCreated: (newReminders: Reminder[], summary: string) => void;
}

export const VoiceInputModal: React.FC<VoiceInputModalProps> = ({
  isOpen,
  onClose,
  onRemindersCreated,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedReminderResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const isMountedRef = useRef(true);
  const timerIntervalRef = useRef<number | null>(null);

  // Timer effect for live recording duration
  useEffect(() => {
    if (isListening) {
      setRecordingSeconds(0);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current !== null) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current !== null) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isListening]);

  const formatSeconds = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cleanup on modal open/close
  useEffect(() => {
    if (!isOpen) {
      speechManager.stopListening().catch(() => {});
      setIsListening(false);
      setTranscript('');
      setParsedResult(null);
      setErrorMessage(null);
      setAudioLevel(0);
    }
  }, [isOpen]);

  const startListening = async () => {
    setErrorMessage(null);
    setParsedResult(null);

    try {
      playMicStartSound();
      setIsListening(true);

      await speechManager.startListening({
        onResult: (text, isFinal) => {
          if (isMountedRef.current) {
            setTranscript(text);
          }
        },
        onAudioLevel: (level) => {
          if (isMountedRef.current) {
            setAudioLevel(level);
          }
        },
        onError: (err) => {
          console.warn('[VoiceInputModal] Speech error:', err);
          if (isMountedRef.current) {
            setErrorMessage(err.message || 'Səs qəbulu zamanı xəta baş verdi.');
            setIsListening(false);
          }
        },
        onEnd: () => {
          if (isMountedRef.current) {
            setIsListening(false);
          }
        },
      });
    } catch (err: any) {
      console.error('[VoiceInputModal] Start listening error:', err);
      if (isMountedRef.current) {
        setIsListening(false);
        setErrorMessage(
          err.message || 'Mikrofona qoşulmaq mümkün olmadı. Aşağıdakı nümunələrdən birini seçə və ya əl ilə yaza bilərsiniz.'
        );
      }
    }
  };

  const stopAllListening = async (): Promise<string> => {
    setIsListening(false);
    try {
      const result = await speechManager.stopListening();
      if (result && isMountedRef.current) {
        setTranscript(result);
      }
      return result;
    } catch (e: any) {
      console.warn('[VoiceInputModal] Stop error:', e);
      if (isMountedRef.current && e.message) {
        setErrorMessage(e.message);
      }
      return '';
    }
  };

  const toggleListening = async () => {
    if (isListening) {
      setIsListening(false);
      setIsProcessing(true);
      const recorded = await stopAllListening();
      const textToUse = (recorded || transcript).trim();
      if (textToUse) {
        handleAnalyzeText(textToUse);
      } else {
        setIsProcessing(false);
      }
    } else {
      startListening();
    }
  };

  const handleAnalyzeText = async (textToParse?: string) => {
    let text = (textToParse || transcript).trim();

    if (!text && isListening) {
      setIsProcessing(true);
      const recorded = await stopAllListening();
      text = (recorded || '').trim();
    } else if (isListening) {
      await stopAllListening();
    }

    if (!text) {
      setErrorMessage('Zəhmət olmasa əvvəlcə bir cümlə söyləyin və ya yazın.');
      setIsProcessing(false);
      return;
    }

    setErrorMessage(null);

    // 1. Evaluate local fast path first
    const currentReminders = reminderService.getAll();
    const evaluation = intelligentRouter.evaluateLocalFastPath(text, currentReminders);

    if (
      evaluation.handledLocally &&
      evaluation.confidence >= 0.8 &&
      evaluation.payload.remindersToCreate &&
      evaluation.payload.remindersToCreate.length > 0
    ) {
      console.log(`[VOICE-MODAL-FAST-PATH] Created ${evaluation.payload.remindersToCreate.length} reminders locally for: "${text}"`);
      const generatedReminders: Reminder[] = evaluation.payload.remindersToCreate.map((r: any, idx: number) => ({
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
        sourceVoiceText: text,
      }));

      playSuccessSound();
      setParsedResult({
        summary: evaluation.payload.responseMessage || `${generatedReminders.length} xatırlatma yaradıldı`,
        reminders: evaluation.payload.remindersToCreate as any,
      });

      onRemindersCreated(generatedReminders, evaluation.payload.responseMessage || `${generatedReminders.length} xatırlatma yaradıldı`);
      setIsProcessing(false);
      return;
    }

    // 2. Otherwise trigger Gemini path
    setIsProcessing(true);

    try {
      const data = await apiClient.parseReminder(
        text,
        new Date().toISOString(),
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Baku'
      );

      if (!data.success) {
        throw new Error(data.error || 'Xatırlatmalar analiz edilə bilmədi.');
      }

      if (!data.reminders || data.reminders.length === 0) {
        setErrorMessage('Daxil edilən cümlədə konkret xatırlatma və ya vaxt tapılmadı.');
        setIsProcessing(false);
        return;
      }

      const generatedReminders: Reminder[] = data.reminders.map((r: any, idx: number) => ({
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
        sourceVoiceText: text,
      }));

      playSuccessSound();
      setParsedResult({
        summary: data.summary,
        reminders: generatedReminders,
      });

      // Pass directly to parent
      onRemindersCreated(generatedReminders, data.summary);
      setIsProcessing(false);
    } catch (error: any) {
      console.error('Error analyzing reminder:', error);
      setErrorMessage(error.message || 'Xatırlatma yaradılarkən xəta baş verdi.');
      setIsProcessing(false);
    }
  };

  const handleSampleClick = (sample: string) => {
    setTranscript(sample);
    handleAnalyzeText(sample);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="voice-input-modal"
        className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-gradient-to-b from-[#111827] to-[#0F172A] p-6 shadow-2xl text-slate-50 overflow-hidden"
      >
        {/* Ambient Glow */}
        <div className="pointer-events-none absolute -top-20 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-violet-500/15 blur-3xl" />

        {/* Close Button */}
        <button
          id="close-voice-modal-btn"
          onClick={() => {
            stopAllListening();
            onClose();
          }}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300 mb-2 uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            Süni İntellekt Səs Analizi
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Nəyi xatırlamaq istəyirsiniz?
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Bir cümlədə bir neçə tapşırıq və vaxt qeyd edə bilərsiniz. AI hər birini ayrı-ayrı təyin edəcək.
          </p>
        </div>

        {/* Center Microphone Orb */}
        <div className="flex flex-col items-center justify-center my-6">
          <div className="relative flex items-center justify-center">
            {/* Pulsing rings when listening */}
            {isListening && (
              <>
                <div className="absolute h-36 w-36 rounded-full bg-violet-500/20 animate-ping opacity-75" />
                <div
                  className="absolute h-44 w-44 rounded-full border border-violet-500/30 transition-all duration-150"
                  style={{ transform: `scale(${1 + audioLevel * 0.3})` }}
                />
              </>
            )}

            <button
              id="voice-record-toggle-btn"
              onClick={toggleListening}
              disabled={isProcessing}
              className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full shadow-2xl transition-all duration-300 active:scale-95 border-2 border-white/10 ${
                isListening
                  ? 'bg-rose-500 text-white shadow-rose-500/30 ring-4 ring-rose-500/20 animate-pulse'
                  : 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-violet-500/30 hover:scale-105'
              }`}
            >
              {isListening ? (
                <MicOff className="h-10 w-10 text-white animate-bounce" />
              ) : (
                <Mic className="h-10 w-10 text-white font-bold" />
              )}
            </button>
          </div>

          <span className="mt-4 text-xs font-medium text-slate-300">
            {isListening ? (
              <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                Dinləyirəm... ({formatSeconds(recordingSeconds)})
              </span>
            ) : (
              'Danışmaq üçün mikrofona toxunun'
            )}
          </span>
        </div>

        {/* Transcript / Input text area */}
        <div className="mb-4">
          <div className="relative rounded-2xl border border-white/5 bg-slate-800/40 p-3 shadow-inner">
            <textarea
              id="voice-transcript-input"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Məsələn: “Sabah saat 10-da həkimə get, axşam 7-də idman et və hər ayın 5-i kirayəni ödə...”"
              rows={3}
              className="w-full resize-none bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />

            <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-1">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Azərbaycan dili dəstəklənir
              </span>

              <button
                id="submit-voice-transcript-btn"
                onClick={() => handleAnalyzeText()}
                disabled={isProcessing || !transcript.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md shadow-violet-500/20 border border-white/10"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analiz edilir...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Xatırlatma Yarat
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Sample presets for fast one-tap testing */}
        <div className="mt-2">
          <p className="text-[11px] font-medium text-slate-400 mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-violet-400" />
            Sürətli sınaq üçün hazır nümunələr:
          </p>
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
            {SAMPLE_VOICE_PROMPTS.map((sample, idx) => (
              <button
                key={idx}
                id={`sample-prompt-btn-${idx}`}
                onClick={() => handleSampleClick(sample)}
                disabled={isProcessing}
                className="text-left text-xs text-slate-300 rounded-xl border border-white/5 bg-slate-800/30 px-3 py-2 hover:bg-slate-800/70 hover:border-violet-500/30 hover:text-white transition-all flex items-center justify-between group"
              >
                <span className="line-clamp-1 italic font-normal">“{sample}”</span>
                <ArrowRight className="h-3 w-3 shrink-0 text-slate-500 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
