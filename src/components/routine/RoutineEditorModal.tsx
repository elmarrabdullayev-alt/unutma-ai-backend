import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Clock,
  Bell,
  Sparkles,
  Sunrise,
  Moon,
  Sun,
  Save,
  Check,
} from 'lucide-react';
import { Routine, RoutineProposal, RoutineType } from '../../types';
import { routineService } from '../../services/routineService';

interface RoutineEditorModalProps {
  isOpen: boolean;
  editingRoutine?: Routine | null;
  initialProposal?: RoutineProposal | null;
  initialType?: RoutineType;
  onClose: () => void;
  onSave: (savedRoutine: Routine) => void;
  onDelete?: (routineId: string) => void;
}

const WEEKDAYS = [
  { day: 1, label: 'B.e' },
  { day: 2, label: 'Ç.a' },
  { day: 3, label: 'Ç' },
  { day: 4, label: 'C.a' },
  { day: 5, label: 'C' },
  { day: 6, label: 'Ş' },
  { day: 0, label: 'B' },
];

export const RoutineEditorModal: React.FC<RoutineEditorModalProps> = ({
  isOpen,
  editingRoutine,
  initialProposal,
  initialType,
  onClose,
  onSave,
  onDelete,
}) => {
  const [type, setType] = useState<RoutineType>('morning');
  const [title, setTitle] = useState('Səhər rutini');
  const [startTime, setStartTime] = useState('07:00');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [steps, setSteps] = useState<
    Array<{
      id?: string;
      title: string;
      time?: string;
      duration?: number;
      notificationEnabled: boolean;
    }>
  >([]);

  const [aiPrompt, setAiPrompt] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (editingRoutine) {
      setType(editingRoutine.type);
      setTitle(editingRoutine.title);
      setStartTime(editingRoutine.startTime);
      setDaysOfWeek(editingRoutine.daysOfWeek);
      setSteps(
        editingRoutine.steps.map((s) => ({
          id: s.id,
          title: s.title,
          time: s.time,
          duration: s.duration,
          notificationEnabled: s.notificationEnabled,
        }))
      );
    } else if (initialProposal) {
      setType(initialProposal.type);
      setTitle(initialProposal.title);
      setStartTime(initialProposal.startTime);
      setDaysOfWeek(initialProposal.daysOfWeek);
      setSteps(
        initialProposal.steps.map((s) => ({
          title: s.title,
          time: s.time,
          duration: s.duration,
          notificationEnabled: s.notificationEnabled,
        }))
      );
    } else {
      const selectedType = initialType || 'morning';
      setType(selectedType);
      const defaultTitle =
        selectedType === 'morning'
          ? 'Səhər rutini'
          : selectedType === 'evening'
          ? 'Axşam rutini'
          : selectedType === 'afternoon'
          ? 'Gündüz rutini'
          : 'Xüsusi rutin';
      setTitle(defaultTitle);
      setStartTime(selectedType === 'morning' ? '07:00' : selectedType === 'evening' ? '22:00' : '14:00');
      setDaysOfWeek([1, 2, 3, 4, 5, 6, 0]);
      setSteps([
        { title: 'Oyan və su iç', time: '07:00', duration: 10, notificationEnabled: true },
        { title: '15 dəqiqə idman', time: '07:15', duration: 15, notificationEnabled: true },
        { title: 'Hazırlaş və evdən çıx', time: '07:45', duration: 20, notificationEnabled: true },
      ]);
    }
  }, [isOpen, editingRoutine, initialProposal, initialType]);

  if (!isOpen) return null;

  const handleTypeChange = (newType: RoutineType) => {
    setType(newType);
    if (!editingRoutine && (!title || title.includes('rutin'))) {
      if (newType === 'morning') setTitle('Səhər rutini');
      else if (newType === 'evening') setTitle('Axşam rutini');
      else if (newType === 'afternoon') setTitle('Gündüz rutini');
      else setTitle('Xüsusi rutin');
    }
    if (!editingRoutine) {
      if (newType === 'morning') setStartTime('07:00');
      else if (newType === 'evening') setStartTime('22:00');
      else if (newType === 'afternoon') setStartTime('14:00');
    }
  };

  const toggleDay = (d: number) => {
    if (daysOfWeek.includes(d)) {
      if (daysOfWeek.length > 1) {
        setDaysOfWeek(daysOfWeek.filter((item) => item !== d));
      }
    } else {
      setDaysOfWeek([...daysOfWeek, d]);
    }
  };

  const handleAddStep = () => {
    let nextTime = startTime;
    if (steps.length > 0) {
      const last = steps[steps.length - 1];
      const baseTime = last.time || startTime;
      const [h, m] = baseTime.split(':').map((v) => parseInt(v, 10));
      const dur = last.duration || 15;
      const total = h * 60 + m + dur;
      nextTime = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(
        total % 60
      ).padStart(2, '0')}`;
    }

    setSteps([
      ...steps,
      {
        title: '',
        time: nextTime,
        duration: 10,
        notificationEnabled: true,
      },
    ]);
  };

  const handleUpdateStep = (index: number, updates: any) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], ...updates };
    setSteps(updated);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleAiParse = () => {
    if (!aiPrompt.trim()) return;
    const proposal = routineService.parseRoutinePrompt(aiPrompt);
    if (proposal) {
      setType(proposal.type);
      setTitle(proposal.title);
      setStartTime(proposal.startTime);
      setDaysOfWeek(proposal.daysOfWeek);
      setSteps(
        proposal.steps.map((s) => ({
          title: s.title,
          time: s.time,
          duration: s.duration,
          notificationEnabled: s.notificationEnabled,
        }))
      );
      setAiPrompt('');
    }
  };

  const handleSave = () => {
    const validSteps = steps.filter((s) => s.title.trim().length > 0);
    if (validSteps.length === 0) {
      alert('Ən azı 1 addım daxil edin');
      return;
    }

    let result: Routine;
    if (editingRoutine) {
      const updated = routineService.updateRoutine(editingRoutine.id, {
        type,
        title: title.trim() || 'Rutin',
        startTime,
        daysOfWeek,
        steps: validSteps.map((s, idx) => ({
          id: s.id || `step-${Date.now()}-${idx}`,
          title: s.title.trim(),
          time: s.time,
          duration: s.duration,
          notificationEnabled: s.notificationEnabled,
        })),
      });
      result = updated || editingRoutine;
    } else {
      result = routineService.createRoutine({
        type,
        title: title.trim() || 'Rutin',
        startTime,
        daysOfWeek,
        steps: validSteps,
      });
    }

    onSave(result);
  };

  const handleDelete = () => {
    if (!editingRoutine) return;
    if (confirm(`"${editingRoutine.title}" rutinini silmək istədiyinizə əminsiniz?`)) {
      routineService.deleteRoutine(editingRoutine.id);
      onDelete?.(editingRoutine.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md max-h-[92vh] flex flex-col rounded-3xl bg-[#0F1523] border border-violet-500/30 shadow-2xl overflow-hidden text-white animate-scale-up">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#131A2D]">
          <h2 className="text-base font-black text-white tracking-tight">
            {editingRoutine ? 'Rutini redaktə et' : 'Yeni rutin yarat'}
          </h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center transition-all active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* AI Quick Generator Prompt */}
          {!editingRoutine && (
            <div className="p-3 rounded-2xl bg-violet-950/30 border border-violet-500/25 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-violet-300">
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                <span>AI ilə sürətli qur</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAiParse()}
                  placeholder="Məs: Hər səhər 7-də oyanım, 10 dəq idman..."
                  className="flex-1 px-3 py-2 rounded-xl bg-[#101524] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={handleAiParse}
                  className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shrink-0 active:scale-95 transition-all"
                >
                  Qur
                </button>
              </div>
            </div>
          )}

          {/* Routine Type Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Rutin Növü
            </label>
            <div className="grid grid-cols-4 gap-1.5 bg-[#121828] p-1 rounded-2xl border border-white/5">
              {[
                { id: 'morning', label: 'Səhər', icon: Sunrise },
                { id: 'afternoon', label: 'Gündüz', icon: Sun },
                { id: 'evening', label: 'Axşam', icon: Moon },
                { id: 'custom', label: 'Xüsusi', icon: Sparkles },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = type === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTypeChange(item.id as RoutineType)}
                    className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-violet-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-[10px]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title & Start Time */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2 space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Rutin Adı
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Rutin adı"
                className="w-full px-3 py-2.5 rounded-xl bg-[#141B2D] border border-white/10 text-xs text-white font-bold focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Başlama
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-2.5 py-2.5 rounded-xl bg-[#141B2D] border border-white/10 text-xs text-white font-bold text-center focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
          </div>

          {/* Days of week */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Həftə Günləri
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDaysOfWeek([1, 2, 3, 4, 5, 6, 0])}
                  className="text-[10px] font-bold text-violet-400 hover:text-violet-300"
                >
                  Hər gün
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={() => setDaysOfWeek([1, 2, 3, 4, 5])}
                  className="text-[10px] font-bold text-violet-400 hover:text-violet-300"
                >
                  Həftə içi
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => {
                const isSelected = daysOfWeek.includes(w.day);
                return (
                  <button
                    key={w.day}
                    type="button"
                    onClick={() => toggleDay(w.day)}
                    className={`py-2 rounded-xl text-xs font-black transition-all ${
                      isSelected
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-[#141B2D] text-slate-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ordered Steps Editor */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Ardıcıl Addımlar ({steps.length})
              </label>
              <button
                type="button"
                onClick={handleAddStep}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-400 hover:text-violet-300 active:scale-95 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Addım əlavə et</span>
              </button>
            </div>

            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-[#141B2D] border border-white/5 space-y-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-xl bg-violet-600/20 text-violet-300 text-xs font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => handleUpdateStep(idx, { title: e.target.value })}
                      placeholder="Məs: 10 dəqiqə idman"
                      className="flex-1 px-3 py-1.5 rounded-xl bg-[#101524] border border-white/10 text-xs text-white font-semibold focus:outline-none focus:border-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      disabled={steps.length <= 1}
                      className="h-7 w-7 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors disabled:opacity-30 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Step parameters: Time, Duration, Notification */}
                  <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <input
                          type="time"
                          value={step.time || ''}
                          onChange={(e) => handleUpdateStep(idx, { time: e.target.value })}
                          className="px-1.5 py-0.5 rounded-lg bg-[#101524] border border-white/10 text-[11px] text-white"
                        />
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <input
                          type="number"
                          min="1"
                          max="120"
                          value={step.duration || ''}
                          onChange={(e) =>
                            handleUpdateStep(idx, {
                              duration: parseInt(e.target.value, 10) || undefined,
                            })
                          }
                          placeholder="Dəq"
                          className="w-12 px-1.5 py-0.5 rounded-lg bg-[#101524] border border-white/10 text-[11px] text-white text-center"
                        />
                        <span>dəq</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateStep(idx, {
                          notificationEnabled: !step.notificationEnabled,
                        })
                      }
                      className={`px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all ${
                        step.notificationEnabled
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                          : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      <Bell className="h-2.5 w-2.5" />
                      <span>{step.notificationEnabled ? 'Xatırlat' : 'Səssiz'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-[#121828] flex items-center justify-between gap-2">
          {editingRoutine ? (
            <button
              type="button"
              onClick={handleDelete}
              className="py-3 px-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs flex items-center gap-1 transition-all active:scale-95"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Sil</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-all active:scale-95"
            >
              Ləğv et
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Save className="h-4 w-4" />
            <span>Yadda saxla</span>
          </button>
        </div>
      </div>
    </div>
  );
};
