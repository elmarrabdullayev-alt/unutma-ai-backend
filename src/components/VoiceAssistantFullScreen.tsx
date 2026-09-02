import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  X,
  Loader2,
  Check,
  Edit2,
  Trash2,
  Clock,
  ArrowRight,
  RefreshCw,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import { Reminder, ReminderCategory, ReminderRecurrence, ReminderPriority } from '../types';
import { CATEGORIES } from '../utils/categoryMeta';
import { playMicStartSound, playSuccessSound, speakText } from '../utils/soundUtils';
import { formatTimeOnly, formatDateAz } from '../utils/dateUtils';
import { reminderService } from '../services/reminderService';
import { speechManager } from '../services/speech/SpeechProviderManager';
import { apiClient } from '../services/apiClient';
import { intelligentRouter } from '../services/intelligentRouter';

interface VoiceAssistantFullScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onRemindersCreated: (reminders: Reminder[], summary: string) => void;
}

interface EditableExtractedReminder {
  id: string;
  title: string;
  description: string;
  dueDateTime: string;
  category: ReminderCategory;
  recurrence: ReminderRecurrence;
  priority: ReminderPriority;
  inferredTime?: boolean;
  timeConfidence?: 'exact' | 'inferred' | 'ambiguous';
}

export const VoiceAssistantFullScreen: React.FC<VoiceAssistantFullScreenProps> = ({
  isOpen,
  onClose,
  onRemindersCreated,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [parsedReminders, setParsedReminders] = useState<EditableExtractedReminder[]>([]);
  const [parsedSummary, setParsedSummary] = useState('');
  const [assistantSpokenResponse, setAssistantSpokenResponse] = useState<string | null>(null);
  const [viewStep, setViewStep] = useState<'listening' | 'review' | 'answer'>('listening');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

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

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopListeningProcess();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setViewStep('listening');
      setTranscript('');
      setInterimText('');
      setRecordingError(null);
      setRecordingSeconds(0);
      setParsedReminders([]);
      setParsedSummary('');
      setAssistantSpokenResponse(null);
      startListeningProcess();
    } else {
      stopListeningProcess();
    }
  }, [isOpen]);

  const formatSeconds = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startListeningProcess = async () => {
    try {
      setRecordingError(null);
      playMicStartSound();
      setIsListening(true);

      await speechManager.startListening({
        onResult: (text, isFinal) => {
          if (isMountedRef.current) {
            if (isFinal) {
              setTranscript(text);
              setInterimText('');
              // If final text is received directly, analyze it
              if (text.trim()) {
                handleAnalyzeText(text.trim());
              }
            } else {
              setInterimText(text);
            }
          }
        },
        onAudioLevel: (level) => {
          if (isMountedRef.current) {
            setAudioLevel(level);
          }
        },
        onError: (err) => {
          console.warn('[VoiceAssistant] Speech error:', err);
          if (isMountedRef.current) {
            setRecordingError(err.message || 'Səs qəbulu zamanı xəta baş verdi.');
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
      console.warn('[VoiceAssistant] Mic start error:', err);
      if (isMountedRef.current) {
        setIsListening(false);
        setRecordingError(err.message || 'Mikrofona qoşulmaq mümkün olmadı.');
      }
    }
  };

  const stopListeningProcess = async (): Promise<string> => {
    setIsListening(false);
    try {
      const finalRecorded = await speechManager.stopListening();
      if (finalRecorded && isMountedRef.current && !transcript) {
        setTranscript(finalRecorded);
      }
      return finalRecorded || '';
    } catch (e: any) {
      console.warn('[VoiceAssistant] Stop error:', e);
      if (isMountedRef.current && e.message) {
        setRecordingError(e.message);
      }
      return '';
    }
  };

  const handleAnalyzeText = async (textOverride?: string) => {
    let textToAnalyze = (textOverride || transcript || interimText).trim();

    if (!textToAnalyze) {
      // If live transcript empty, trigger provider stop to check audio fallback buffer
      const fallbackResult = await speechManager.stopListening();
      setIsListening(false);
      if (fallbackResult) {
        textToAnalyze = fallbackResult.trim();
        setTranscript(textToAnalyze);
      }
    } else {
      await stopListeningProcess();
    }

    if (!textToAnalyze) {
      setIsProcessing(false);
      return;
    }

    // Check if deterministic local fast path handles this instantly
    const currentReminders = reminderService.getAll();
    const evaluation = intelligentRouter.evaluateLocalFastPath(textToAnalyze, currentReminders);

    if (evaluation.handledLocally && evaluation.confidence >= 0.8) {
      console.log(`[ROUTER-UI] Instant local execution for "${textToAnalyze}" (${evaluation.action})`);
      const payload = evaluation.payload;

      if (
        payload.action === 'get_daily_schedule' ||
        payload.action === 'get_weekly_schedule' ||
        payload.action === 'search_reminders' ||
        payload.action === 'general_chat'
      ) {
        setAssistantSpokenResponse(payload.responseMessage);
        speakText(payload.responseMessage);
        setViewStep('answer');
        setIsProcessing(false);
        return;
      }

      if (
        payload.action === 'update_reminder' ||
        payload.action === 'delete_reminder' ||
        payload.action === 'complete_reminder'
      ) {
        const result = reminderService.executeAIAction(payload);
        playSuccessSound();
        setAssistantSpokenResponse(result.message);
        speakText(result.message);
        setViewStep('answer');
        setIsProcessing(false);
        return;
      }

      if (
        (payload.action === 'create_reminder' || payload.action === 'create_multiple_reminders') &&
        payload.remindersToCreate &&
        payload.remindersToCreate.length > 0
      ) {
        playSuccessSound();
        const editableList: EditableExtractedReminder[] = payload.remindersToCreate.map((r: any, idx: number) => ({
          id: `extracted-${Date.now()}-${idx}`,
          title: r.title,
          description: r.description || '',
          dueDateTime: r.dueDateTime,
          category: r.category || 'other',
          recurrence: r.recurrence || 'none',
          priority: r.priority || 'medium',
          inferredTime: Boolean(r.inferredTime),
          timeConfidence: r.timeConfidence || (r.inferredTime ? 'inferred' : 'exact'),
        }));
        setParsedReminders(editableList);
        setParsedSummary(payload.responseMessage || `${editableList.length} xatırlatma tapdım`);
        setViewStep('review');
        setIsProcessing(false);
        return;
      }
    }

    // Only show AI loading spinner if actually calling AI path
    setIsProcessing(true);

    try {
      const routeResult = await intelligentRouter.route(textToAnalyze, currentReminders, {
        userNowISO: new Date().toISOString(),
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        executeDirectly: false,
      });

      const payload = routeResult.actionPayload;

      if (
        payload.action === 'get_daily_schedule' ||
        payload.action === 'get_weekly_schedule' ||
        payload.action === 'search_reminders' ||
        payload.action === 'general_chat'
      ) {
        setAssistantSpokenResponse(payload.responseMessage);
        speakText(payload.responseMessage);
        setViewStep('answer');
        setIsProcessing(false);
        return;
      }

      if (
        payload.action === 'update_reminder' ||
        payload.action === 'delete_reminder' ||
        payload.action === 'complete_reminder'
      ) {
        const result = reminderService.executeAIAction(payload);
        playSuccessSound();
        setAssistantSpokenResponse(result.message);
        speakText(result.message);
        setViewStep('answer');
        setIsProcessing(false);
        return;
      }

      if (payload.remindersToCreate && payload.remindersToCreate.length > 0) {
        playSuccessSound();
        const editableList: EditableExtractedReminder[] = payload.remindersToCreate.map((r: any, idx: number) => ({
          id: `extracted-${Date.now()}-${idx}`,
          title: r.title,
          description: r.description || '',
          dueDateTime: r.dueDateTime,
          category: r.category || 'other',
          recurrence: r.recurrence || 'none',
          priority: r.priority || 'medium',
          inferredTime: Boolean(r.inferredTime),
          timeConfidence: r.timeConfidence || (r.inferredTime ? 'inferred' : 'exact'),
        }));
        setParsedReminders(editableList);
        setParsedSummary(payload.responseMessage || `${editableList.length} xatırlatma tapdım`);
        setViewStep('review');
      } else {
        const single: EditableExtractedReminder = {
          id: `extracted-${Date.now()}-0`,
          title: textToAnalyze,
          description: 'Səsli xatırlatma',
          dueDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          category: 'personal',
          recurrence: 'none',
          priority: 'medium',
          inferredTime: true,
          timeConfidence: 'inferred',
        };
        setParsedReminders([single]);
        setParsedSummary('1 xatırlatma tapdım');
        setViewStep('review');
      }
    } catch (err: any) {
      console.error('Error analyzing voice command:', err);
      const userErr = err.message || 'AI xidmətinə qoşulmaq mümkün olmadı. İnternet bağlantınızı yoxlayın.';
      setAssistantSpokenResponse(userErr);
      setViewStep('answer');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAll = () => {
    if (parsedReminders.length === 0) return;

    // Save directly to centralized repository
    const created = reminderService.createMultipleReminders(
      parsedReminders.map((r) => ({
        ...r,
        sourceVoiceText: transcript || 'Səsli əmr',
      }))
    );

    playSuccessSound();
    onRemindersCreated(created, parsedSummary || `${created.length} xatırlatma təsdiqləndi`);
    onClose();
  };

  const handleUpdateItem = (id: string, updates: Partial<EditableExtractedReminder>) => {
    setParsedReminders((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updates,
              // If user explicitly edited the time, it's no longer inferred
              inferredTime: updates.dueDateTime ? false : item.inferredTime,
              timeConfidence: updates.dueDateTime ? 'exact' : item.timeConfidence,
            }
          : item
      )
    );
  };

  const handleDeleteItem = (id: string) => {
    const next = parsedReminders.filter((item) => item.id !== id);
    setParsedReminders(next);
    if (next.length === 0) {
      setViewStep('listening');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#080C15] text-slate-50 animate-fade-in safe-top safe-bottom overflow-y-auto">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-5 pt-3 pb-2 z-20">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-violet-300">
            Unutma AI Səs Mühərriki
          </span>
        </div>

        <button
          id="close-voice-assistant-fullscreen"
          onClick={() => {
            stopListeningProcess();
            onClose();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:text-white active:scale-95 transition-all"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col justify-between px-5 pb-6 max-w-md mx-auto w-full z-10">
        {viewStep === 'listening' && (
          /* STEP 1: ACTIVE VOICE LISTENING & ANIMATED ORB */
          <>
            {/* Top Prompt Section */}
            <div className="text-center pt-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-xs font-semibold text-violet-300 mb-3 shadow-sm">
                <span className={`h-2 w-2 rounded-full ${isListening ? 'bg-rose-400 animate-ping' : 'bg-slate-500'}`} />
                <span>{isListening ? `Dinləyirəm... (${formatSeconds(recordingSeconds)})` : isProcessing ? 'AI Emal Edir...' : 'Mikrofon dayandırılıb'}</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {isListening ? 'Dinləyirəm...' : 'Səslə idarə et'}
              </h2>

              <p className="text-xs text-slate-400 mt-1 max-w-[280px] mx-auto">
                {isListening
                  ? 'Planlarınızı və ya xatırlatmalarınızı söyləyin, bitirdikdə mikrofona toxunun.'
                  : 'Danışmağa başlamaq üçün mikrofona toxunun.'}
              </p>

              {/* Localized Error Display */}
              {recordingError && (
                <div className="mt-2.5 mx-auto max-w-sm rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 flex items-center justify-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                  <span>{recordingError}</span>
                </div>
              )}
            </div>

            {/* Center Dynamic AI Orb & Audio Waves */}
            <div className="my-auto py-6 flex flex-col items-center justify-center relative">
              {/* Outer Ambient Aura */}
              <div
                className="absolute h-56 w-56 rounded-full bg-gradient-to-tr from-violet-600/30 via-indigo-600/25 to-pink-600/20 blur-3xl pointer-events-none transition-all duration-300"
                style={{
                  transform: `scale(${1 + audioLevel * 0.7})`,
                  opacity: isListening ? 0.95 : 0.2,
                }}
              />

              {/* Pulsing Concentric Rings */}
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute h-44 w-44 rounded-full border border-violet-500/25 transition-all duration-150"
                  style={{ transform: `scale(${1 + audioLevel * 0.35})` }}
                />
                <div
                  className="absolute h-32 w-32 rounded-full border border-indigo-500/35 transition-all duration-100"
                  style={{ transform: `scale(${1 + audioLevel * 0.2})` }}
                />

                {/* Hero Mic Action Orb */}
                <button
                  id="voice-screen-toggle-mic"
                  onClick={async () => {
                    if (isListening) {
                      const text = await stopListeningProcess();
                      if (text.trim()) {
                        handleAnalyzeText(text.trim());
                      }
                    } else {
                      startListeningProcess();
                    }
                  }}
                  className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full shadow-2xl transition-all duration-300 active:scale-95 border-2 border-white/20 ${
                    isListening
                      ? 'bg-gradient-to-tr from-rose-600 via-violet-600 to-indigo-600 text-white shadow-rose-500/40 ring-4 ring-rose-500/25 animate-pulse-glow'
                      : 'bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700'
                  }`}
                >
                  {isListening ? (
                    <Mic className="h-10 w-10 text-white stroke-[2.2]" />
                  ) : (
                    <MicOff className="h-8 w-8 text-slate-400" />
                  )}
                </button>
              </div>

              {/* Live Recognized Speech Box */}
              <div className="mt-7 w-full text-center">
                {transcript || interimText ? (
                  <p className="text-sm font-semibold text-slate-100 italic bg-[#111728] p-3.5 rounded-2xl border border-white/10 shadow-lg">
                    “{transcript} {interimText}”
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 font-medium">
                    {isListening ? 'Danışın... Səs qeyd olunur' : 'Danışmaq üçün mikrofona toxunun'}
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Section: Sample Quotes & Action */}
            <div className="space-y-3 pt-2">
              {/* Highlighted Example Prompts */}
              <div className="rounded-2xl border border-white/5 bg-[#111624] p-3 text-center">
                <p className="text-[11px] text-violet-300 font-semibold mb-1">
                  Nümunə səsli əmrlər:
                </p>
                <div className="space-y-1">
                  <p
                    onClick={() =>
                      handleAnalyzeText(
                        'Sabah saat 10-da Anara zəng etməyi, günorta 2-də maşını ustaya aparmağı, axşam anamın dərmanını almağı xatırlat.'
                      )
                    }
                    className="text-[11px] text-slate-300 italic cursor-pointer hover:text-violet-300 transition-colors"
                  >
                    “Sabah saat 10-da Anara zəng et, 2-də maşını apar, axşam dərmanı al”
                  </p>
                  <p
                    onClick={() => handleAnalyzeText('Sabah nə planım var?')}
                    className="text-[11px] text-slate-400 italic cursor-pointer hover:text-violet-300 transition-colors"
                  >
                    “Sabah nə planım var?”
                  </p>
                </div>
              </div>

              {/* Confirm / Parse Trigger Button */}
              <button
                id="voice-screen-analyze-btn"
                onClick={() => handleAnalyzeText()}
                disabled={isProcessing || (!transcript.trim() && !interimText.trim())}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-xl shadow-violet-500/30 border border-white/10 hover:brightness-110 active:scale-98 disabled:opacity-40 transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>AI Analiz Edir...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Təsdiq Et və Emal Et</span>
                    <ArrowRight className="h-4 w-4 ml-0.5" />
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {viewStep === 'review' && (
          /* STEP 2: REVIEW & EDIT EXTRACTED REMINDERS INTERFACE */
          <div className="flex flex-col h-full justify-between pt-2">
            <div>
              <div className="text-center mb-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-bold text-emerald-400 mb-1.5">
                  <Check className="h-3 w-3" />
                  Analiz Tamamlandı
                </div>

                <h2 className="text-xl font-extrabold tracking-tight text-white">
                  {parsedReminders.length} xatırlatma tapdım
                </h2>

                <p className="text-xs text-slate-400 mt-0.5 px-2">
                  {parsedSummary || 'Xatırlatmaları nəzərdən keçirin, lazım olduqda düzəliş edin:'}
                </p>
              </div>

              {/* Extracted Reminders List */}
              <div className="space-y-2.5 max-h-[52vh] overflow-y-auto pr-0.5">
                {parsedReminders.map((item, index) => {
                  const catMeta = CATEGORIES[item.category] || CATEGORIES.other;
                  const isEditing = editingCardId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-[#121828] p-3.5 shadow-md"
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase text-slate-400">Başlıq</label>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                            className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-violet-500"
                            placeholder="Başlıq"
                          />

                          <label className="text-[10px] font-bold uppercase text-slate-400">Təsvir / Qeyd</label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                            className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
                            placeholder="Əlavə qeyd"
                          />

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-400">Tarix və Saat</label>
                              <input
                                type="datetime-local"
                                value={item.dueDateTime ? item.dueDateTime.slice(0, 16) : ''}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleUpdateItem(item.id, {
                                      dueDateTime: new Date(e.target.value).toISOString(),
                                    });
                                  }
                                }}
                                className="w-full rounded-xl border border-white/10 bg-slate-800 px-2 py-1.5 text-[11px] text-white focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-400">Kateqoriya</label>
                              <select
                                value={item.category}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, { category: e.target.value as ReminderCategory })
                                }
                                className="w-full rounded-xl border border-white/10 bg-slate-800 px-2 py-1.5 text-[11px] text-white focus:outline-none"
                              >
                                {Object.values(CATEGORIES).map((c) => (
                                  <option key={c.id} value={c.id} className="bg-slate-900">
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <button
                            onClick={() => setEditingCardId(null)}
                            className="w-full rounded-xl bg-violet-600 py-2 text-xs font-bold text-white hover:bg-violet-500 shadow-md"
                          >
                            Yadda saxla
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold">
                                {index + 1}
                              </span>
                              <span className="text-[11px] font-bold text-violet-300">
                                {formatTimeOnly(item.dueDateTime)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                • {catMeta.label}
                              </span>

                              {/* Inferred time indicator badge */}
                              {item.inferredTime && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                                  <Clock className="h-2.5 w-2.5" />
                                  Təxmini vaxt
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs font-bold text-white">{item.title}</h4>
                            {item.description && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {item.description}
                              </p>
                            )}

                            <p className="text-[10px] text-slate-500 mt-1">
                              {formatDateAz(item.dueDateTime)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setEditingCardId(item.id)}
                              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                              title="Düzəliş et"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10"
                              title="Sil"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2 pt-3">
              <button
                id="confirm-extracted-reminders-btn"
                onClick={handleConfirmAll}
                disabled={parsedReminders.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-xl shadow-violet-500/30 border border-white/10 hover:brightness-110 active:scale-98 transition-all"
              >
                <Check className="h-4 w-4 stroke-[2.5]" />
                <span>Hamısını Təsdiq Et ({parsedReminders.length})</span>
              </button>

              <button
                onClick={() => {
                  setViewStep('listening');
                  setTranscript('');
                  setInterimText('');
                  startListeningProcess();
                }}
                className="flex w-full items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Yenidən danış</span>
              </button>
            </div>
          </div>
        )}

        {viewStep === 'answer' && (
          /* STEP 3: VOICE ASSISTANT SPOKEN ANSWER (e.g. Schedule Response) */
          <div className="flex flex-col h-full justify-between pt-6">
            <div className="space-y-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 border border-violet-500/30 text-violet-300 mx-auto">
                <Sparkles className="h-7 w-7" />
              </div>

              <h2 className="text-xl font-extrabold text-white">AI Köməkçinin Cavabı</h2>

              <div className="rounded-2xl border border-white/10 bg-[#121828] p-4 text-left shadow-lg">
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {assistantSpokenResponse}
                </p>

                <div className="mt-3 flex items-center justify-end">
                  <button
                    onClick={() => assistantSpokenResponse && speakText(assistantSpokenResponse)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-400 hover:text-violet-300"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    Təkrar səsləndir
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-3">
              <button
                onClick={onClose}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3 text-xs font-bold text-white hover:bg-violet-500"
              >
                Bağla
              </button>

              <button
                onClick={() => {
                  setViewStep('listening');
                  setTranscript('');
                  setInterimText('');
                  startListeningProcess();
                }}
                className="flex w-full items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Yeni sual və ya əmr
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
