import React from 'react';
import { motion } from 'motion/react';
import { Home, User, Mic } from 'lucide-react';

export type MobileTab = 'home' | 'calendar' | 'ai' | 'profile';

interface MobileBottomNavProps {
  currentTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onMicClick: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onTabChange,
  onMicClick,
}) => {
  return (
    <nav
      aria-label="Əsas naviqasiya"
      className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto pointer-events-none"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)',
      }}
    >
      {/* Premium Minimalist Bar: 3 elements (Ana səhifə, Mikrofon, Profil) */}
      <div className="mx-4 mb-1 rounded-[22px] border border-white/[0.08] bg-[#0D1220]/95 shadow-[0_8px_28px_rgba(0,0,0,0.5)] backdrop-blur-2xl px-6 py-1 pointer-events-auto">
        <div className="flex items-center justify-between relative">
          {/* 1. Ana səhifə (Sol) */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            id="nav-tab-home"
            onClick={() => onTabChange('home')}
            className={`flex flex-col items-center justify-center py-1 px-3 transition-colors ${
              currentTab === 'home' ? 'text-[#A78BFA]' : 'text-[#94A3B8] hover:text-[#F5F6FA]'
            }`}
            aria-label="Ana səhifə"
          >
            <div
              className={`p-1 rounded-xl transition-all duration-200 ${
                currentTab === 'home' ? 'bg-[#7C3AED]/15 text-[#A78BFA]' : ''
              }`}
            >
              <Home className="h-5 w-5 stroke-[2]" />
            </div>
            <span
              className={`text-[10px] tracking-tight mt-0.5 ${
                currentTab === 'home' ? 'font-semibold text-[#F5F6FA]' : 'font-normal'
              }`}
            >
              Ana səhifə
            </span>
          </motion.button>

          {/* 2. Mərkəzi Mikrofon Düyməsi (52px, kompakt, minimal glow) */}
          <div className="relative -top-2">
            <motion.button
              whileTap={{ scale: 0.94 }}
              whileHover={{ scale: 1.03 }}
              id="main-floating-ai-mic-btn"
              onClick={onMicClick}
              aria-label="Səsli köməkçi ilə danış"
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-[#F5F6FA] shadow-[0_4px_16px_rgba(124,58,237,0.3)] ring-3 ring-[#080B14] border border-white/20 transition-all duration-150 active:scale-95"
            >
              <Mic className="h-5 w-5 text-white stroke-[2.2]" />
            </motion.button>
          </div>

          {/* 3. Profil (Sağ) */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            id="nav-tab-profile"
            onClick={() => onTabChange('profile')}
            className={`flex flex-col items-center justify-center py-1 px-3 transition-colors ${
              currentTab === 'profile' ? 'text-[#A78BFA]' : 'text-[#94A3B8] hover:text-[#F5F6FA]'
            }`}
            aria-label="Profil"
          >
            <div
              className={`p-1 rounded-xl transition-all duration-200 ${
                currentTab === 'profile' ? 'bg-[#7C3AED]/15 text-[#A78BFA]' : ''
              }`}
            >
              <User className="h-5 w-5 stroke-[2]" />
            </div>
            <span
              className={`text-[10px] tracking-tight mt-0.5 ${
                currentTab === 'profile' ? 'font-semibold text-[#F5F6FA]' : 'font-normal'
              }`}
            >
              Profil
            </span>
          </motion.button>
        </div>
      </div>
    </nav>
  );
};
