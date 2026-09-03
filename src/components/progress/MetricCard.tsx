import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  sublabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  diffPercent?: number | null; // e.g. +12, -5, or null
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  sublabel,
  icon: Icon,
  iconColor = 'text-violet-400',
  iconBgColor = 'bg-violet-500/10 border-violet-500/20',
  diffPercent,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border border-white/5 bg-[#111726]/80 p-3.5 shadow-sm transition-all ${
        onClick ? 'cursor-pointer hover:border-violet-500/25 active:scale-[0.98]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${iconBgColor} shrink-0`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>

        {diffPercent !== null && diffPercent !== undefined && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
              diffPercent > 0
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : diffPercent < 0
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                : 'bg-white/5 text-slate-400 border border-white/10'
            }`}
          >
            {diffPercent > 0 ? `+${diffPercent}%` : `${diffPercent}%`}
          </span>
        )}
      </div>

      <div className="mt-2.5">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-black tracking-tight text-white">{value}</span>
          {unit && <span className="text-xs font-semibold text-slate-400">{unit}</span>}
        </div>
        <p className="text-[11px] font-semibold text-slate-300 mt-0.5 truncate">{label}</p>
        {sublabel && (
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{sublabel}</p>
        )}
      </div>
    </div>
  );
};
