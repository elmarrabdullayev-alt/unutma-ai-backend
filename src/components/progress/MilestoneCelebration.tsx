import React, { useEffect } from 'react';
import { Sparkles, Flame, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';

interface MilestoneCelebrationProps {
  milestone: number; // e.g. 3, 7, 14, 30
  onDismiss: () => void;
}

const MILESTONE_MESSAGES: Record<number, { title: string; subtitle: string }> = {
  3: {
    title: '3 gündür davam edirsən ✨',
    subtitle: 'İlk addımlar ən vacibidir. Ritmi qorumağa davam et.',
  },
  7: {
    title: '7 günlük seriya! Davamlılıq formalaşır.',
    subtitle: 'Bütöv bir həftə planlarına sadiq qaldın. Bu əla nəticədir.',
  },
  14: {
    title: '14 günlük seriya! Mükəmməl nizam.',
    subtitle: 'İki həftəlik davamlılıq artıq güclü bir vərdişə çevrilib.',
  },
  30: {
    title: '30 günlük seriya! Əsl vərdiş ustası 🌟',
    subtitle: 'Bir ay ərzində hər gün irəlilədin. İnanılmaz intizam.',
  },
};

export const MilestoneCelebration: React.FC<MilestoneCelebrationProps> = ({
  milestone,
  onDismiss,
}) => {
  const content = MILESTONE_MESSAGES[milestone] || {
    title: `${milestone} günlük seriya! ✨`,
    subtitle: 'Davamlılığın möhkəmlənir. Uğurlu addımlar atırsan.',
  };

  useEffect(() => {
    // Subtle haptic notification feedback
    try {
      if (Capacitor.isPluginAvailable('Haptics')) {
        Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      }
    } catch {
      // Haptics unavailable or web
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-b from-[#141A2E] via-[#0E1322] to-[#0A0D18] p-6 text-center shadow-2xl shadow-violet-900/30 animate-in zoom-in-95 duration-300">
        {/* Subtle Ambient Violet Glow */}
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-36 w-36 rounded-full bg-violet-600/25 blur-3xl" />

        {/* Ambient floating sparkles */}
        <div className="pointer-events-none absolute top-6 left-8 h-1.5 w-1.5 rounded-full bg-violet-300/60 animate-ping" />
        <div className="pointer-events-none absolute top-12 right-10 h-1.5 w-1.5 rounded-full bg-indigo-300/60 animate-pulse" />
        <div className="pointer-events-none absolute bottom-16 left-12 h-1 w-1 rounded-full bg-purple-300/40" />

        {/* Minimalist Trophy Icon */}
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/15 shadow-inner mb-4">
          <Flame className="h-8 w-8 text-violet-400 stroke-[2.2]" />
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-black text-white shadow">
            <Sparkles className="h-3 w-3" />
          </span>
        </div>

        {/* Title & Subtitle */}
        <h3 className="text-lg font-black tracking-tight text-white mb-1.5">
          {content.title}
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto mb-6">
          {content.subtitle}
        </p>

        {/* Dismiss Button */}
        <button
          onClick={onDismiss}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-xs font-black text-white shadow-lg shadow-violet-600/30 hover:opacity-95 active:scale-95 transition-all"
        >
          <Check className="h-4 w-4" />
          <span>Davam et</span>
        </button>
      </div>
    </div>
  );
};
