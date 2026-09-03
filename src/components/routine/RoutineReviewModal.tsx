import React from 'react';
import {
  X,
  Check,
  Sparkles,
  Clock,
  Calendar,
  Sunrise,
  Moon,
  Sun,
  Bell,
  Pencil,
} from 'lucide-react';
import { RoutineProposal, RoutineType } from '../../types';
import { routineService } from '../../services/routineService';

interface RoutineReviewModalProps {
  isOpen: boolean;
  proposal: RoutineProposal | null;
  onClose: () => void;
  onConfirm: (savedRoutine: any) => void;
  onEdit: (proposal: RoutineProposal) => void;
}

export const RoutineReviewModal: React.FC<RoutineReviewModalProps> = ({
  isOpen,
  proposal,
  onClose,
  onConfirm,
  onEdit,
}) => {
  if (!isOpen || !proposal) return null;

  const handleConfirm = () => {
    const saved = routineService.createRoutine({
      type: proposal.type,
      title: proposal.title,
      icon: proposal.icon,
      daysOfWeek: proposal.daysOfWeek,
      startTime: proposal.startTime,
      steps: proposal.steps,
    });
    onConfirm(saved);
  };

  const getRoutineIcon = (type: RoutineType) => {
    if (type === 'morning') return <Sunrise className="h-5 w-5 text-amber-300" />;
    if (type === 'evening') return <Moon className="h-5 w-5 text-indigo-300" />;
    if (type === 'afternoon') return <Sun className="h-5 w-5 text-yellow-400" />;
    return <Sparkles className="h-5 w-5 text-violet-300" />;
  };

  const formatDays = (days: number[]) => {
    if (days.length === 7) return 'Hər gün';
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Həftə içi';
    if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Həftə sonu';
    const dayNames = ['B', 'B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş'];
    return days.map((d) => dayNames[d]).join(', ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl bg-[#0F1523] border border-violet-500/40 shadow-2xl overflow-hidden text-white animate-scale-up">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#131A2D]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">Rutinin</h2>
              <p className="text-[11px] text-violet-300/80 font-semibold">
                AI tərəfindən tərtib edilmiş cədvəl
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center transition-all active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Routine Summary Card */}
        <div className="p-4 bg-[#111728] border-b border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-white/10">
                {getRoutineIcon(proposal.type)}
              </div>
              <h3 className="text-sm font-black text-white">{proposal.title}</h3>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-extrabold uppercase tracking-wider">
              {proposal.type === 'morning'
                ? 'Səhər'
                : proposal.type === 'evening'
                ? 'Axşam'
                : proposal.type === 'afternoon'
                ? 'Gündüz'
                : 'Xüsusi'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-300 font-medium pt-1">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-violet-400" />
              <span>Başlayır: <strong>{proposal.startTime}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-violet-400" />
              <span>{formatDays(proposal.daysOfWeek)}</span>
            </div>
          </div>
        </div>

        {/* Ordered Steps List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Ardıcıl addımlar ({proposal.steps.length})</span>
          </div>

          {proposal.steps.map((step, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-2xl bg-[#141B2D] border border-white/5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-6 w-6 rounded-xl bg-violet-600/20 text-violet-300 text-xs font-black flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{step.title}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    {step.time && <span>{step.time}</span>}
                    {step.duration && <span>• {step.duration} dəq</span>}
                  </div>
                </div>
              </div>

              {step.notificationEnabled && (
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 text-[10px] text-slate-300 font-semibold shrink-0"
                  title="Xatırlatma bildirişi aktivdir"
                >
                  <Bell className="h-2.5 w-2.5 text-violet-400" />
                  Xatırlat
                </span>
              )}
            </div>
          ))}
        </div>

        {/* 3 Explicit Actions: Ləğv et, Dəyiş, Təsdiq et */}
        <div className="p-4 border-t border-white/10 bg-[#121828] flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-all active:scale-95"
          >
            Ləğv et
          </button>
          <button
            onClick={() => onEdit(proposal)}
            className="flex-1 py-3 rounded-2xl bg-[#1C253B] hover:bg-[#25304E] text-violet-300 font-bold text-xs border border-violet-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Dəyiş</span>
          </button>
          <button
            onClick={handleConfirm}
            className="flex-[1.4] py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Check className="h-4 w-4 stroke-[3]" />
            <span>Təsdiq et</span>
          </button>
        </div>
      </div>
    </div>
  );
};
