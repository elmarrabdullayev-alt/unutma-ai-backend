import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Loader2,
  Calendar,
  Clock,
  HelpCircle,
  ArrowRight,
  Bot,
  User,
} from 'lucide-react';
import { Reminder, AssistantMessage } from '../types';
import { SAMPLE_QUESTIONS } from '../utils/categoryMeta';
import { speakText, stopSpeaking, playMicStartSound } from '../utils/soundUtils';
import { apiClient } from '../services/apiClient';
import { speechManager } from '../services/speech/SpeechProviderManager';

interface AssistantChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminders: Reminder[];
  onOpenVoiceReminder: () => void;
}

export const AssistantChatModal: React.FC<AssistantChatModalProps> = ({
  isOpen,
  onClose,
  reminders,
  onOpenVoiceReminder,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      text: 'Salam! Mən sizin şəxsi Unutma AI yaddaş köməkçinizəm. “Bu gün nə etməliyəm?”, “Sabah hansı işlərim var?” və ya “Gələn həftə nələri unutmamalıyam?” deyə səslə və ya yazılı soruşa bilərsiniz.',
      timestamp: new Date().toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isOpen) {
      stopSpeaking();
      setIsSpeaking(false);
      speechManager.stopListening().catch(() => {});
      setIsListening(false);
    }
  }, [isOpen]);

  const toggleVoiceQuery = async () => {
    if (isListening) {
      setIsListening(false);
      try {
        const text = await speechManager.stopListening();
        const query = (text || inputQuery).trim();
        if (query) {
          setInputQuery(query);
          handleAskQuestion(query);
        }
      } catch (e) {
        console.warn(e);
      }
    } else {
      try {
        playMicStartSound();
        setIsListening(true);
        await speechManager.startListening({
          onResult: (text, isFinal) => {
            setInputQuery(text);
            if (isFinal && text.trim()) {
              handleAskQuestion(text.trim());
            }
          },
          onError: (err) => {
            console.warn('[AssistantChatModal] Speech error:', err);
            setIsListening(false);
          },
          onEnd: () => {
            setIsListening(false);
          },
        });
      } catch (e) {
        console.warn('[AssistantChatModal] Start listening error:', e);
        setIsListening(false);
      }
    }
  };

  const handleAskQuestion = async (queryToAsk?: string) => {
    const query = (queryToAsk || inputQuery).trim();
    if (!query) return;

    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const data = await apiClient.askAssistant(
        query,
        reminders.filter((r) => !r.isCompleted),
        new Date().toISOString(),
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Baku'
      );

      const answer = data.answer || 'Məlumat tapılmadı.';

      const assistantMessage: AssistantMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: answer,
        timestamp: new Date().toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);

      // Auto speak answer
      speakText(answer);
      setIsSpeaking(true);
    } catch (err: any) {
      console.error('Error asking assistant:', err);
      const errorMessage: AssistantMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: 'Bağışlayın, cavab hazırlanarkən xəta baş verdi. Zəhmət olmasa yenidən yoxlayın.',
        timestamp: new Date().toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  const handleSpeakToggle = (text: string) => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      speakText(text);
      setIsSpeaking(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="assistant-chat-modal"
        className="relative flex h-[85vh] max-h-[640px] w-full max-w-lg flex-col rounded-3xl border border-white/10 bg-gradient-to-b from-[#111827] to-[#0F172A] p-5 shadow-2xl text-slate-50 overflow-hidden"
      >
        {/* Top Glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-violet-500/15 blur-3xl" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white border border-white/10 shadow-md shadow-violet-500/20">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">AI Yaddaş Köməkçisi</h3>
              <p className="text-[11px] text-slate-400">Qrafikiniz və xatırlatmalarınız haqqında soruşun</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="close-assistant-modal-btn"
              onClick={() => {
                stopSpeaking();
                onClose();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400 border border-violet-500/30 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
              )}

              <div
                className={`max-w-[82%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-medium rounded-tr-none shadow-md shadow-violet-500/20 border border-white/10'
                    : 'bg-slate-800/60 text-slate-100 border border-white/5 rounded-tl-none shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                <div
                  className={`mt-1.5 flex items-center justify-between text-[10px] ${
                    msg.role === 'user' ? 'text-violet-200' : 'text-slate-500'
                  }`}
                >
                  <span>{msg.timestamp}</span>

                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleSpeakToggle(msg.text)}
                      className="flex items-center gap-1 text-slate-400 hover:text-violet-400 transition-colors"
                      title="Səsi oxu / dayandır"
                    >
                      <Volume2 className="h-3 w-3" />
                      Oxu
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-violet-400 bg-slate-850 p-3 rounded-2xl border border-white/5 w-fit">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Unutma AI qrafikinizi yoxlayır...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Sample Questions */}
        <div className="border-t border-white/5 pt-2.5 pb-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {SAMPLE_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                id={`assistant-preset-q-${idx}`}
                onClick={() => handleAskQuestion(q)}
                disabled={isLoading}
                className="whitespace-nowrap rounded-xl border border-white/5 bg-slate-800/40 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800 hover:border-violet-500/30 hover:text-white transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar with Voice Button */}
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <input
              id="assistant-query-input"
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAskQuestion();
              }}
              placeholder="Qrafikiniz haqqında soruşun..."
              disabled={isLoading}
              className="w-full rounded-2xl border border-white/5 bg-slate-800/40 pl-3.5 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-violet-500/50 focus:outline-none transition-colors"
            />

            <button
              id="send-assistant-query-btn"
              onClick={() => handleAskQuestion()}
              disabled={isLoading || !inputQuery.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 shadow-sm"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Voice query mic button */}
          <button
            id="assistant-mic-btn"
            onClick={toggleVoiceQuery}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all shadow-md active:scale-95 border ${
              isListening
                ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                : 'bg-slate-800 text-violet-400 hover:bg-slate-700 hover:text-white border-white/10'
            }`}
            title="Səslə soruş"
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
