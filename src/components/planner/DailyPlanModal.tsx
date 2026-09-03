import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  Clock,
  Flame,
  AlertTriangle,
  Check,
  Edit2,
  Trash2,
  Plus,
  X,
  Mic,
  MicOff,
  ArrowRight,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import {
  PlanTask,
  DailyPlanProposal,
  Reminder,
  ReminderPriority,
  ReminderCategory,
} from '../../types';
import { dailyPlannerService } from '../../services/dailyPlannerService';
import { speechManager } from '../../services/speech/SpeechProviderManager';
import { playMicStartSound, playSuccessSound } from '../../utils/soundUtils';
import { CATEGORIES } from '../../utils/categoryMeta';

interface DailyPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProposal?: DailyPlanProposal | null;
  existingReminders: Reminder[];
  onPlanConfirmed: (createdReminders: Reminder[]) => void;
  onOpenFocus?: (taskTitle?: string) => void;
}

const EXAMPLE_PROMPTS = [
  'Bu gün saat 2-də görüşüm var, hesabatı bitirməliyəm, marketə getməliyəm və 30 dəqiqə idman etmək istəyirəm.',
  'Səhər 10-da komanda ilə iclas, hesabatı bitirmək, axşam 18:00-da aptekə getmək.',
];

export const DailyPlanModal: React.FC<DailyPlanModalProps> = ({
  isOpen,
  onClose,
  initialProposal,
  existingReminders,
  onPlanConfirmed,
  onOpenFocus,
}) => {
  const [step, setStep] = useState<'input' | 'review' | 'edit_task'>('input');
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [proposal, setProposal] = useState<DailyPlanProposal | null>(null);
  const [editingTask, setEditingTask] = useState<PlanTask | null>(null);
  const [isInlineEditMode, setIsInlineEditMode] = useState(false);
  const [focusSuggestionNotice, setFocusSuggestionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialProposal && initialProposal.tasks.length > 0) {
        setProposal(initialProposal);
        setStep('review');
      } else {
        setStep('input');
        setInputText('');
        setProposal(null);
      }
      setIsInlineEditMode(false);
      setFocusSuggestionNotice(null);
    } else {
      stopListening();
    }
  }, [isOpen, initialProposal]);

  if (!isOpen) return null;

  // Voice recording toggle for input
  const toggleListening = async () => {
    if (isListening) {
      await stopListening();
    } else {
      playMicStartSound();
      setIsListening(true);
      try {
        await speechManager.startListening({
          onResult: (txt, isFinal) => {
            if (isFinal) {
              setInputText((prev) => (prev ? `${prev} ${txt}` : txt));
            }
          },
          onError: (err) => {
            console.warn('[DailyPlanModal] Voice error:', err);
            setIsListening(false);
          },
          onEnd: () => {
            setIsListening(false);
          },
        });
      } catch (err) {
        console.warn('[DailyPlanModal] Failed to start voice:', err);
        setIsListening(false);
      }
    }
  };

  const stopListening = async () => {
    setIsListening(false);
    try {
      const finalTxt = await speechManager.stopListening();
      if (finalTxt) {
        setInputText((prev) => (prev ? `${prev} ${finalTxt}` : finalTxt));
      }
    } catch (e) {}
  };

  // Generate plan from text input
  const handleGeneratePlan = async (customPrompt?: string) => {
    const textToUse = (customPrompt || inputText).trim();
    if (!textToUse || isGenerating) return;

    if (isListening) {
      await stopListening();
    }

    setIsGenerating(true);
    try {
      const generated = await dailyPlannerService.planDay(textToUse, existingReminders);
      setProposal(generated);
      setStep('review');
    } catch (err) {
      console.error('[DailyPlanModal] Generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Apply suggested conflict-free slot to a task
  const handleApplyAlternativeSlot = (taskId: string) => {
    if (!proposal) return;
    const updatedTasks = proposal.tasks.map((t) => {
      if (t.id === taskId) {
        return dailyPlannerService.applyAlternativeSlot(t);
      }
      return t;
    });

    const updatedProposal = dailyPlannerService.detectAndResolveConflicts(
      { ...proposal, tasks: updatedTasks },
      existingReminders
    );
    setProposal(updatedProposal);
  };

  // Delete a task from proposal
  const handleDeleteTask = (taskId: string) => {
    if (!proposal) return;
    const updatedTasks = proposal.tasks.filter((t) => t.id !== taskId);
    const updatedProposal = dailyPlannerService.detectAndResolveConflicts(
      { ...proposal, tasks: updatedTasks },
      existingReminders
    );
    setProposal(updatedProposal);
  };

  // Open edit task form
  const handleStartEditTask = (task: PlanTask) => {
    setEditingTask({ ...task });
    setStep('edit_task');
  };

  // Save edited task
  const handleSaveEditTask = () => {
    if (!proposal || !editingTask) return;
    const updatedTasks = proposal.tasks.map((t) =>
      t.id === editingTask.id ? editingTask : t
    );

    const updatedProposal = dailyPlannerService.detectAndResolveConflicts(
      { ...proposal, tasks: updatedTasks },
      existingReminders
    );
    setProposal(updatedProposal);
    setEditingTask(null);
    setStep('review');
  };

  // Add brand-new task to proposal
  const handleAddNewTask = () => {
    if (!proposal) return;
    const newTask: PlanTask = {
      id: `plan-task-${Date.now()}`,
      title: 'Yeni tapşırıq',
      dueDateTime: `${new Date().toISOString().slice(0, 10)}T16:00:00.000Z`,
      timeString: '16:00',
      durationMinutes: 30,
      priority: 'medium',
      category: 'other',
      isFixedTime: false,
    };
    handleStartEditTask(newTask);
  };

  // Confirm plan and create reminders
  const handleConfirmPlan = () => {
    if (!proposal || proposal.tasks.length === 0) return;

    playSuccessSound();
    const created = dailyPlannerService.confirmPlan(proposal);

    // Check if any task is focus-ready
    const focusTask = proposal.tasks.find((t) => t.isFocusReady);
    if (focusTask && onOpenFocus) {
      setFocusSuggestionNotice(focusTask.title);
      // Wait a moment so user sees the confirmation, then trigger
      setTimeout(() => {
        onPlanConfirmed(created);
        onClose();
        onOpenFocus(focusTask.title);
      }, 900);
      return;
    }

    onPlanConfirmed(created);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-md animate-fade-in safe-bottom">
      <div className="w-full max-w-md bg-[#0D1322] border border-violet-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/5 bg-[#12182B] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white tracking-tight">
                {step === 'review' ? 'Bugünkü planın' : step === 'edit_task' ? 'Tapşırığı dəyiş' : 'Gününü planla'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {step === 'review'
                  ? 'Optimal gün cədvəlin'
                  : 'Bütün işlərini bir cümlə ilə de'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* STEP 1: PROMPT INPUT */}
          {step === 'input' && (
            <div className="space-y-4">
              <div className="relative">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Məsələn: Bu gün saat 2-də görüşüm var, hesabatı bitirməliyəm, marketə getməliyəm və 30 dəqiqə idman etmək istəyirəm..."
                  rows={4}
                  className="w-full rounded-2xl bg-[#141C2E] border border-white/10 p-3.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 resize-none transition-colors"
                />

                <button
                  onClick={toggleListening}
                  className={`absolute right-3 bottom-3 h-8 w-8 rounded-xl flex items-center justify-center transition-all ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600/40'
                  }`}
                  title={isListening ? 'Mikrofonu dayandır' : 'Səslə de'}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              </div>

              {isListening && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-950/40 border border-violet-500/30 text-[11px] text-violet-300">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                  <span>Dinləyirəm... Bütün günün planını sərbəst danış.</span>
                </div>
              )}

              {/* Example Prompts */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Nümunə təkliflər:
                </span>
                <div className="space-y-1.5">
                  {EXAMPLE_PROMPTS.map((promptText, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInputText(promptText);
                        handleGeneratePlan(promptText);
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-[#121929] hover:bg-[#182136] border border-white/5 text-[11px] text-slate-300 transition-colors flex items-start gap-2"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{promptText}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleGeneratePlan()}
                disabled={!inputText.trim() || isGenerating}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Plan tərtib olunur...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Planı tərtib et</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: REVIEW "Bugünkü planın" */}
          {step === 'review' && proposal && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[11px] font-bold text-slate-300">
                  {proposal.tasks.length} tapşırıq ardıcıllığı:
                </span>

                <button
                  onClick={() => setIsInlineEditMode(!isInlineEditMode)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${
                    isInlineEditMode
                      ? 'bg-violet-600 text-white'
                      : 'bg-[#182032] text-slate-300 hover:text-white border border-white/5'
                  }`}
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  <span>{isInlineEditMode ? 'Dəyişikliyi bitir' : 'Dəyiş'}</span>
                </button>
              </div>

              {/* Task Cards List */}
              <div className="space-y-2.5">
                {proposal.tasks.map((task) => {
                  const catMeta = CATEGORIES[task.category] || CATEGORIES.other;

                  return (
                    <div
                      key={task.id}
                      className={`p-3 rounded-2xl border transition-all ${
                        task.hasConflict
                          ? 'bg-amber-950/25 border-amber-500/40'
                          : 'bg-[#131A2B] border-white/5 hover:border-violet-500/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        {/* Time Badge */}
                        <div className="flex flex-col items-center justify-center h-11 w-14 rounded-xl bg-[#1A2238] border border-white/10 shrink-0 text-white">
                          <span className="text-xs font-black tracking-tight">{task.timeString}</span>
                          <span className="text-[9px] text-slate-400">
                            {task.isFixedTime ? 'Dəqiq' : 'Planlı'}
                          </span>
                        </div>

                        {/* Title & Metadata */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <h4 className="text-xs font-bold text-white tracking-tight truncate max-w-[180px]">
                              {task.title}
                            </h4>

                            {/* Focus Indicator */}
                            {task.isFocusReady && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-500/20 border border-violet-500/30 text-[9px] font-extrabold text-violet-300">
                                <Flame className="h-2.5 w-2.5 text-amber-400" />
                                Fokus
                              </span>
                            )}
                          </div>

                          {/* Details Row: duration & priority */}
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            {task.durationMinutes && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5 text-slate-400" />
                                {task.durationMinutes} dəq
                              </span>
                            )}

                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                task.priority === 'high'
                                  ? 'text-rose-400 bg-rose-500/10'
                                  : task.priority === 'medium'
                                  ? 'text-amber-400 bg-amber-500/10'
                                  : 'text-slate-400 bg-slate-500/10'
                              }`}
                            >
                              {task.priority === 'high' ? 'Yüksək' : task.priority === 'medium' ? 'Orta' : 'Aşağı'}
                            </span>
                          </div>
                        </div>

                        {/* Actions (Edit / Delete) */}
                        {isInlineEditMode && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleStartEditTask(task)}
                              className="h-7 w-7 rounded-lg bg-white/5 hover:bg-violet-600/30 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                              title="Dəyiş"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="h-7 w-7 rounded-lg bg-white/5 hover:bg-rose-600/30 text-slate-400 hover:text-rose-300 flex items-center justify-center transition-colors"
                              title="Sil"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Conflict Alert & Suggested Slot */}
                      {task.hasConflict && (
                        <div className="mt-2.5 pt-2 border-t border-amber-500/20 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            <span>Bu saatda artıq planın var</span>
                          </div>
                          {task.conflictReason && (
                            <p className="text-[10px] text-amber-200/70 pl-5">
                              {task.conflictReason}
                            </p>
                          )}

                          {task.suggestedAlternativeTime && (
                            <div className="flex items-center justify-between gap-2 pl-5 pt-1">
                              <span className="text-[11px] text-slate-300 font-medium">
                                Təklif: <b className="text-violet-300 font-bold">{task.suggestedAlternativeTime}</b>
                              </span>
                              <button
                                onClick={() => handleApplyAlternativeSlot(task.id)}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-[10px] font-bold active:scale-95 transition-all"
                              >
                                Təklifi tətbiq et
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Extra Task Button in Edit Mode */}
              {isInlineEditMode && (
                <button
                  onClick={handleAddNewTask}
                  className="w-full py-2.5 rounded-xl border border-dashed border-white/15 hover:border-violet-500/40 text-slate-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Yeni tapşırıq əlavə et</span>
                </button>
              )}

              {/* Focus suggestion announcement if confirmed */}
              {focusSuggestionNotice && (
                <div className="p-3 rounded-2xl bg-violet-950/60 border border-violet-500/40 text-xs text-violet-200 flex items-center gap-2 animate-fade-in">
                  <Flame className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>
                    Plan təsdiqləndi! <b>"{focusSuggestionNotice}"</b> üzrə Fokus rejiminə keçilir...
                  </span>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-2xl bg-[#151C2C] hover:bg-[#1C253B] text-slate-300 font-bold text-xs border border-white/5 active:scale-95 transition-all"
                >
                  Ləğv et
                </button>

                <button
                  onClick={() => setIsInlineEditMode(!isInlineEditMode)}
                  className="flex-1 py-3 rounded-2xl bg-[#1C243B] hover:bg-[#25304E] text-violet-300 font-bold text-xs border border-violet-500/20 active:scale-95 transition-all"
                >
                  {isInlineEditMode ? 'Bitir' : 'Dəyiş'}
                </button>

                <button
                  onClick={handleConfirmPlan}
                  className="flex-[1.5] py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Check className="h-4 w-4" />
                  <span>Təsdiq et</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: EDIT TASK */}
          {step === 'edit_task' && editingTask && (
            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Tapşırığın adı
                </label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#141C2E] border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Vaxt (Saat)
                  </label>
                  <input
                    type="time"
                    value={editingTask.timeString}
                    onChange={(e) => {
                      const newTime = e.target.value;
                      const updated = dailyPlannerService.updateTaskTime(editingTask, newTime);
                      setEditingTask(updated);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#141C2E] border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Müddət (dəqiqə)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    step="5"
                    value={editingTask.durationMinutes || 30}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        durationMinutes: parseInt(e.target.value, 10) || 30,
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-[#141C2E] border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Prioritet
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['low', 'medium', 'high'] as ReminderPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditingTask({ ...editingTask, priority: p })}
                      className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                        editingTask.priority === p
                          ? 'bg-violet-600 text-white'
                          : 'bg-[#141C2E] text-slate-400 border border-white/5'
                      }`}
                    >
                      {p === 'high' ? 'Yüksək' : p === 'medium' ? 'Orta' : 'Aşağı'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#141C2E] border border-white/5">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">Fokus tapşırığı</span>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(editingTask.isFocusReady)}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, isFocusReady: e.target.checked })
                  }
                  className="h-4 w-4 accent-violet-600 rounded"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingTask(null);
                    setStep('review');
                  }}
                  className="flex-1 py-3 rounded-2xl bg-[#151C2C] text-slate-300 font-bold text-xs"
                >
                  Geri
                </button>
                <button
                  onClick={handleSaveEditTask}
                  className="flex-1 py-3 rounded-2xl bg-violet-600 text-white font-bold text-xs shadow-lg"
                >
                  Yadda saxla
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
