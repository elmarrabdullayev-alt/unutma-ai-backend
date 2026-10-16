import React from 'react';
import { motion } from 'motion/react';
import { Home, User, Mic } from 'lucide-react';
import { springPress } from '../utils/motion';

export type MobileTab = 'home' | 'calendar' | 'ai' | 'profile';

interface MobileBottomNavProps {
  currentTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onMicClick: () => void;
}

const TabButton: React.FC<{
  id: string;
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ id, active, label, icon, onClick }) => (
  <motion.button
    id={id}
    type="button"
    whileTap={{ scale: 0.9 }}
    transition={springPress}
    onClick={onClick}
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    className={`relative flex h-14 w-[92px] flex-col items-center justify-center gap-1 rounded-2xl transition-colors duration-200 ${
      active ? 'text-ink-50' : 'text-ink-400 hover:text-ink-200'
    }`}
  >
    {active && (
      <motion.span
        layoutId="nav-active-pill"
        className="absolute inset-x-2 inset-y-1 -z-0 rounded-2xl bg-white/[0.07]"
        transition={{ type: 'spring', stiffness: 460, damping: 36 }}
      />
    )}
    <span className="relative">{icon}</span>
    <span className={`relative text-[12px] ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
  </motion.button>
);

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentTab, onTabChange, onMicClick }) => {
  return (
    <nav
      aria-label="Əsas naviqasiya"
      className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto pointer-events-none"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
    >
      {/* fade the content out under the bar */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent" />

      <div className="relative mx-5 pointer-events-auto rounded-[28px] border border-white/[0.08] bg-ink-900/85 px-3 shadow-[0_1px_0_0_rgb(255_240_225/0.06)_inset,0_20px_40px_-12px_rgb(0_0_0/0.9)] backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex items-center justify-between">
          <TabButton
            id="nav-tab-home"
            active={currentTab === 'home'}
            label="Ana səhifə"
            icon={<Home className="h-[22px] w-[22px]" strokeWidth={currentTab === 'home' ? 2.2 : 1.8} />}
            onClick={() => onTabChange('home')}
          />

          {/* The voice orb: the app's signature control */}
          <div className="relative -mt-8">
            <span aria-hidden="true" className="absolute inset-0 rounded-full bg-zer-400/30 animate-ripple" />
            <motion.button
              type="button"
              id="main-floating-ai-mic-btn"
              onClick={onMicClick}
              aria-label="Səsli köməkçi ilə danış"
              whileTap={{ scale: 0.88 }}
              transition={springPress}
              className="btn-gold animate-breathing-mic relative flex h-[64px] w-[64px] items-center justify-center rounded-full ring-[6px] ring-ink-950"
            >
              <Mic className="h-[26px] w-[26px]" strokeWidth={2.2} />
            </motion.button>
          </div>

          <TabButton
            id="nav-tab-profile"
            active={currentTab === 'profile'}
            label="Profil"
            icon={<User className="h-[22px] w-[22px]" strokeWidth={currentTab === 'profile' ? 2.2 : 1.8} />}
            onClick={() => onTabChange('profile')}
          />
        </div>
      </div>
    </nav>
  );
};
