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
  Flame,
  AlertTriangle,
  Check,
  SlidersHorizontal,
  Bell,
} from 'lucide-react';
import { Reminder, AIActionPayload, AssistantMessage, DailyPlanProposal, RoutineProposal } from '../types';
import { speakText, playSuccessSound } from '../utils/soundUtils';
import { reminderService } from '../services/reminderService';
import { formatDateAz, formatTimeOnly } from '../utils/dateUtils';
import { apiClient } from '../services/apiClient';
import { intelligentRouter } from '../services/intelligentRouter';
import { dailyPlannerService } from '../services/dailyPlannerService';
import { routineService } from '../services/routineService';

interface AiAssistantScreenProps {
  reminders: Reminder[];
  onOpenVoice: () => void;
  onOpenDailyPlanner?: (proposal?: DailyPlanProposal) => void;
  onOpenRoutineReview?: (proposal: RoutineProposal) => void;
  onRemindersCreated?: (reminders: Reminder[]) => void;
}

const SUGGESTED_CHIPS = [
  'Sabahkı planımı göstər',
  'Bugünkü rutinlərimi yoxla',
  'Fokus rejiminə başla',
  'Ən vacib tapşırığım hansıdır?',
];

export const AiAssistantScreen: React.FC<AiAssistantScreenProps> = ({
  reminders,
  onOpenVoice,
  onOpenDailyPlanner,
  onOpenRoutineReview,
  onRemindersCreated,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      text: 'Salam! Mən sənin AI köməkçinəm. Günün haqqında soruşa, plan qura və ya tapşırıqlarını idarə edə bilərsən.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleConfirmPlanInChat = (messageId: string, proposal: DailyPlanProposal) => {
    playSuccessSound();
    const created = dailyPlannerService.confirmPlan(proposal);
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === messageId) {
          return {
            ...m,
            executed: true,
            text: `Təbriklər! Bugünkü plan təsdiqləndi və ${created.length} xatırlatma təqviminizə əlavə edildi.`,
          };
        }
        return m;
      })
    );
    onRemindersCreated?.(created);
  };

  const handleCancelPlanInChat = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === messageId) {
          return {
            ...m,
            executed: true,
            text: 'Plan ləğv edildi. İstədiyiniz vaxt yenidən plan tərtib edə bilərsiniz.',
          };
        }
        return m;
      })
    );
  };

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

    const currentReminders = reminderService.getAll();
    const evaluation = intelligentRouter.evaluateLocalFastPath(textToSend, currentReminders);

    // If local fast path can resolve with high confidence, execute instantly without loading state
    if (evaluation.handledLocally && evaluation.confidence >= 0.8) {
      console.log(`[AI-CHAT-ROUTER] Local fast path for "${textToSend}"`);
      const payload = evaluation.payload;
      let actionResultMessage = '';

      if (payload.action === 'plan_day') {
        const assistantMsg: AssistantMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          text: payload.responseMessage || 'Bugünkü planın hazırlandı. Zəhmət olmasa təsdiq edin.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionPayload: payload,
          executed: false,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        return;
      }

      if (payload.action === 'create_routine') {
        const assistantMsg: AssistantMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          text: payload.responseMessage || 'Rutininiz üçün cədvəl tərtib edildi. Zəhmət olmasa təsdiq edin.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionPayload: payload,
          executed: false,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        return;
      }

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
      return;
    }

    // Otherwise show loading indicator while calling Gemini path
    setIsLoading(true);

    try {
      const routeResult = await intelligentRouter.route(textToSend, currentReminders, {
        userNowISO: new Date().toISOString(),
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        executeDirectly: true,
      });

      const payload: AIActionPayload = routeResult.actionPayload || {
        action: 'general_chat',
        responseMessage: 'Sorğu cavablandırıldı.',
      };

      let actionResultMessage = '';
      if (routeResult.executionResult?.message) {
        actionResultMessage = routeResult.executionResult.message;
      }

      const isUnconfirmed = payload.action === 'plan_day' || payload.action === 'create_routine';

      const assistantMsg: AssistantMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        text: actionResultMessage || payload.responseMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionPayload: payload,
        executed: !isUnconfirmed,
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

  const handleConfirmRoutineInChat = (msgId: string, proposal: RoutineProposal) => {
    routineService.createRoutine({
      type: proposal.type,
      title: proposal.title,
      icon: proposal.icon,
      daysOfWeek: proposal.daysOfWeek,
      startTime: proposal.startTime,
      steps: proposal.steps,
    });
    playSuccessSound();

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              executed: true,
              text: `"${proposal.title}" təsdiqləndi və rutinlərinizə əlavə edildi! Cədvəl üzrə addımlar xatırladılacaq.`,
            }
          : m
      )
    );
  };

  const handleCancelRoutineInChat = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              executed: true,
              text: 'Rutin təklifi ləğv edildi.',
            }
          : m
      )
    );
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
            <h1 className="text-base font-extrabold text-white">AI köməkçi</h1>
            <p className="text-[10px] font-medium text-slate-400">Sual ver və ya gününü planla</p>
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

                {/* AI DAILY PLANNER PROPOSAL CARD */}
                {payload?.action === 'plan_day' && payload.dailyPlanProposal && !msg.executed && (
                  <div className="mt-3 pt-3 border-t border-violet-500/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white tracking-tight flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                        Bugünkü planın
                      </span>
                      <span className="text-[10px] text-violet-300/80 font-semibold">
                        {payload.dailyPlanProposal.tasks.length} tapşırıq
                      </span>
                    </div>

                    {/* Task List */}
                    <div className="space-y-1.5">
                      {payload.dailyPlanProposal.tasks.map((task) => (
                        <div
                          key={task.id}
                          className={`p-2 rounded-xl border text-[11px] ${
                            task.hasConflict
                              ? 'bg-amber-950/30 border-amber-500/40'
                              : 'bg-[#151D30] border-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-extrabold text-violet-300 text-xs shrink-0">
                                {task.timeString}
                              </span>
                              <span className="font-semibold text-white truncate max-w-[150px]">
                                {task.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {task.isFocusReady && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300 text-[9px] font-bold">
                                  <Flame className="h-2.5 w-2.5 text-amber-400" />
                                  Fokus
                                </span>
                              )}
                              {task.durationMinutes && (
                                <span className="text-[10px] text-slate-400">
                                  {task.durationMinutes}d
                                </span>
                              )}
                              <span
                                className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                                  task.priority === 'high'
                                    ? 'text-rose-400 bg-rose-500/10'
                                    : task.priority === 'medium'
                                    ? 'text-amber-400 bg-amber-500/10'
                                    : 'text-slate-400 bg-slate-500/10'
                                }`}
                              >
                                {task.priority === 'high' ? 'Y' : task.priority === 'medium' ? 'O' : 'A'}
                              </span>
                            </div>
                          </div>

                          {/* Conflict Alert */}
                          {task.hasConflict && (
                            <div className="mt-1.5 pt-1.5 border-t border-amber-500/20 text-[10px] text-amber-300 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                              <span>Bu saatda artıq planın var</span>
                              {task.suggestedAlternativeTime && (
                                <span className="text-violet-300 font-bold ml-auto">
                                  Təklif: {task.suggestedAlternativeTime}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Actions: "Təsdiq et", "Dəyiş", "Ləğv et" */}
                    <div className="pt-1 flex items-center gap-1.5">
                      <button
                        onClick={() => handleCancelPlanInChat(msg.id)}
                        className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold transition-all active:scale-95"
                      >
                        Ləğv et
                      </button>
                      <button
                        onClick={() => onOpenDailyPlanner?.(payload.dailyPlanProposal)}
                        className="flex-1 py-2 rounded-xl bg-[#1C253B] hover:bg-[#25304E] text-violet-300 text-[10px] font-bold border border-violet-500/20 transition-all active:scale-95"
                      >
                        Dəyiş
                      </button>
                      <button
                        onClick={() => handleConfirmPlanInChat(msg.id, payload.dailyPlanProposal!)}
                        className="flex-[1.4] py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black shadow-md flex items-center justify-center gap-1 transition-all active:scale-95"
                      >
                        <Check className="h-3 w-3" />
                        <span>Təsdiq et</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* AI ROUTINE PROPOSAL CARD */}
                {payload?.action === 'create_routine' && payload.routineProposal && !msg.executed && (
                  <div className="mt-3 pt-3 border-t border-violet-500/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white tracking-tight flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                        Rutinin
                      </span>
                      <span className="text-[10px] text-violet-300/80 font-semibold">
                        {payload.routineProposal.title} • {payload.routineProposal.startTime}
                      </span>
                    </div>

                    {/* Ordered Steps Preview */}
                    <div className="space-y-1.5">
                      {payload.routineProposal.steps.map((step, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex items-center justify-between p-2 rounded-xl bg-[#151D30] border border-white/5 text-[11px]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="h-4 w-4 rounded-full bg-violet-600/30 text-violet-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {sIdx + 1}
                            </span>
                            <span className="font-semibold text-white truncate max-w-[160px]">
                              {step.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-slate-400">
                            {step.time && <span className="text-violet-300 font-bold">{step.time}</span>}
                            {step.duration && <span>• {step.duration}d</span>}
                            {step.notificationEnabled && <Bell className="h-2.5 w-2.5 text-violet-400" />}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Actions: "Ləğv et", "Dəyiş", "Təsdiq et" */}
                    <div className="pt-1 flex items-center gap-1.5">
                      <button
                        onClick={() => handleCancelRoutineInChat(msg.id)}
                        className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold transition-all active:scale-95"
                      >
                        Ləğv et
                      </button>
                      <button
                        onClick={() => onOpenRoutineReview?.(payload.routineProposal!)}
                        className="flex-1 py-2 rounded-xl bg-[#1C253B] hover:bg-[#25304E] text-violet-300 text-[10px] font-bold border border-violet-500/20 transition-all active:scale-95"
                      >
                        Dəyiş
                      </button>
                      <button
                        onClick={() => handleConfirmRoutineInChat(msg.id, payload.routineProposal!)}
                        className="flex-[1.4] py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black shadow-md flex items-center justify-center gap-1 transition-all active:scale-95"
                      >
                        <Check className="h-3 w-3" />
                        <span>Təsdiq et</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Interactive Action Confirmation Badge */}
                {payload && payload.action && payload.action !== 'general_chat' && (
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    <span>
                      {payload.action === 'create_reminder' && 'Xatırlatma təqvimə əlavə edildi'}
                      {payload.action === 'create_multiple_reminders' && 'Xatırlatmalar təqvimə əlavə edildi'}
                      {payload.action === 'create_routine' && 'Rutin cədvəli tərtib edildi'}
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
