import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sun, Moon, X, BatteryLow } from 'lucide-react';
import { Reminder } from '../../types';
import { buildDaySummary, buildMorningBriefing } from '../../services/daySummary';
import { setTiredToday } from '../../services/energyMode';
import { springPress } from '../../utils/motion';

interface DayBriefingCardProps {
  reminders: Reminder[];
  now: Date;
  routineCount: number;
  tired: boolean;
  /** Heavy items that can move to tomorrow while the user is tired. */
  heavyIds: string[];
  energyMessage: string;
  onMoveHeavyToTomorrow: (ids: string[]) => void;
  onTiredChange: () => void;
}

const dismissKey = (now: Date) => `unutma_ai_briefing_dismissed_v1:${now.toDateString()}`;

function isDismissed(now: Date): boolean {
  try {
    return localStorage.getItem(dismissKey(now)) === '1';
  } catch {
    return false;
  }
}

/**
 * Morning (before 18:00): what the day holds. Evening: how the day went.
 * Dismissable per day. Shows the energy toggle in both.
 */
export const DayBriefingCard: React.FC<DayBriefingCardProps> = ({
  reminders,
  now,
  routineCount,
  tired,
  heavyIds,
  energyMessage,
  onMoveHeavyToTomorrow,
  onTiredChange,
}) => {
  const [dismissed, setDismissed] = useState(() => isDismissed(now));
  const evening = now.getHours() >= 18;
  if (dismissed) return null;

  const text = evening
    ? buildDaySummary(reminders, now).message
    : buildMorningBriefing(reminders, now, routineCount).message;

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(now), '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springPress}
      aria-label={evening ? 'Gün xülasəsi' : 'Səhər brifinqi'}
      className="surface-quiet mb-4 rounded-card p-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zer-500/15 text-zer-300">
          {evening ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
        </span>
        <p className="flex-1 pt-1 text-[15px] leading-relaxed text-ink-100">{text}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Bağla"
          className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-400 active:bg-white/[0.05]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {tired && energyMessage && (
        <p className="mt-3 text-[14px] leading-relaxed text-ink-300">{energyMessage}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          transition={springPress}
          aria-pressed={tired}
          onClick={() => {
            setTiredToday(!tired, now);
            onTiredChange();
          }}
          className={`flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors ${
            tired ? 'bg-zer-500/20 text-zer-200 border border-zer-500/40' : 'border border-white/[0.08] text-ink-200'
          }`}
        >
          <BatteryLow className="h-4 w-4" />
          {tired ? 'Yorğunluq aktivdir' : 'Bu gün yorğunam'}
        </motion.button>

        {tired && heavyIds.length > 0 && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            transition={springPress}
            onClick={() => onMoveHeavyToTomorrow(heavyIds)}
            className="flex h-10 items-center rounded-full border border-white/[0.08] px-4 text-[14px] font-medium text-ink-200"
          >
            Ağır işləri sabaha köçür ({heavyIds.length})
          </motion.button>
        )}
      </div>
    </motion.section>
  );
};
