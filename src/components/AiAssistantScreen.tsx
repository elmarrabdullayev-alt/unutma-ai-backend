import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Volume2,
  Mic,
  Bot,
  User,
  Loader2,
  RotateCcw,
  CheckCircle2,
  Clock,
  Calendar,
  Trash2,
} from 'lucide-react';
import { Reminder, AIActionPayload, AssistantMessage } from '../types';
import { speakText } from '../utils/soundUtils';
import { reminderService } from '../services/reminderService';
import { formatDateAz, formatTimeOnly } from '../utils/dateUtils';
import { apiClient } from '../services/apiClient';

interface AiAssistantScreenProps {
  reminders: Reminder[];
  onOpenVoice: () => void;
}

const SUGGESTED_CHIPS = [
  'Sabah nə planım var?',
  'Bu gün nə etməliyəm?',
  'Bu həftə hansı günüm daha boşdur?',
  'Sabah saat 15:00-a görüş əlavə et',
];

export const AiAssistantScreen: React.FC<AiAssistantScreenProps> = ({
  reminders,
  onOpenVoice,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      text: 'Salam! Mən sənin Unutma AI şəxsi köməkçinəm. Cədvəlin haqqında soruşa, yeni xatırlatmalar yarada, vaxtlarını dəyişə və ya ləğv edə bilərsən.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (userText: string) => {
    const textToSend = userText.trim();
    if (!textToSend || isLoading) return;

    const userMsg: AssistantMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // 1. Send to AI action engine
      const currentReminders = reminderService.getAll();
      const data = await apiClient.executeAiAction(
        textToSend,
        currentReminders,
        new Date().toISOString(),
        Intl.DateTimeFormat().resolvedOptions().timeZone
      );

      const payload: AIActionPayload = data.actionPayload || {
        action: 'general_chat',
        responseMessage: 'Sorğu cavablandırıldı.',
      };

      // 2. Execute any actionable intent if present
      let actionResultMessage = '';
      if (
        payload.action === 'create_reminder' ||
        payload.action === 'create_multiple_reminders' ||
        payload.action === 'update_reminder' ||
        payload.action === 'delete_reminder' ||
        payload.action === 'complete_reminder'
      ) {
        const execution = reminderService.executeAIAction(payload);
        if (execution.message) {
          actionResultMessage = execution.message;
        }
      }

      const assistantMsg: AssistantMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        text: actionResultMessage || payload.responseMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionPayload: payload,
        executed: true,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Chat Assistant error:', err);
      const fallbackMsg: AssistantMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        text: 'Bağlantı xətası baş verdi. Zəhmət olmasa bir az sonra yenidən yoxlayın.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'init-reset',
        role: 'assistant',
        text: 'Söhbət yeniləndi. Yeni bir sualınız və ya xatırlatmanız varmı?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="w-full px-4 pt-2 pb-24 flex flex-col min-h-[calc(100vh-140px)]">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white">Unutma AI</h1>
            <p className="text-[10px] font-medium text-emerald-400">Aktiv İntellekt • Şəxsi Köməkçi</p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
          title="Təmizlə"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Conversational Mobile Messages Stream */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const payload = msg.actionPayload;

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600/30 text-violet-300 text-[10px] font-bold">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white rounded-br-none shadow-sm'
                    : 'bg-[#121828] text-slate-200 border border-white/5 rounded-bl-none shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {/* Interactive Action Confirmation Badge */}
                {payload && payload.action && payload.action !== 'general_chat' && (
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    <span>
                      {payload.action === 'create_reminder' && 'Xatırlatma təqvimə əlavə edildi'}
                      {payload.action === 'create_multiple_reminders' && 'Xatırlatmalar təqvimə əlavə edildi'}
                      {payload.action === 'update_reminder' && 'Cədvəl yeniləndi'}
                      {payload.action === 'delete_reminder' && 'Xatırlatma ləğv edildi'}
                      {payload.action === 'complete_reminder' && 'Status: Tamamlandı'}
                      {payload.action === 'get_daily_schedule' && 'Gündəlik qrafik analiz edildi'}
                      {payload.action === 'get_weekly_schedule' && 'Həftəlik qrafik analiz edildi'}
                    </span>
                  </div>
                )}

                <div className="mt-1.5 flex items-center justify-end gap-2 text-[9px] opacity-60">
                  <span>{msg.timestamp}</span>
                  {!isUser && (
                    <button
                      onClick={() => speakText(msg.text)}
                      className="hover:opacity-100"
                      title="Səsləndir"
                    >
                      <Volume2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {isUser && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-300 text-[10px] font-bold">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600/30 text-violet-300">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-2xl rounded-bl-none bg-[#121828] border border-white/5 px-3 py-2 text-xs text-slate-400 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
              <span>Düşünürəm və icra edirəm...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="pt-2 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
          {SUGGESTED_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(chip)}
              className="shrink-0 rounded-full border border-violet-500/25 bg-[#121829] px-3 py-1.5 text-[11px] font-semibold text-violet-300 hover:border-violet-400 active:scale-95 transition-all"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Sleek Mobile Pill Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputText);
        }}
        className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#101524] p-1.5 shadow-lg"
      >
        <button
          type="button"
          onClick={onOpenVoice}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 active:scale-90 transition-transform"
          title="Səslə danış"
        >
          <Mic className="h-4 w-4" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="AI-yə əmr ver və ya sual yaz..."
          className="flex-1 bg-transparent px-2 text-xs text-white placeholder-slate-500 focus:outline-none"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white disabled:opacity-30 active:scale-90 transition-transform"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};
