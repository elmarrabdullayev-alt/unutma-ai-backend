import React from 'react';
import { Home, Calendar, Bot, User, Mic } from 'lucide-react';

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
    <div className="fixed bottom-0 left-0 right-0 z-40 max-w-lg mx-auto pointer-events-none">
      {/* Floating Prompt Pill: "Danış, mən xatırladım" */}
      <div className="flex justify-center mb-1.5 pointer-events-auto">
        <button
          id="mic-prompt-pill"
          onClick={onMicClick}
          className="group flex items-center gap-1.5 rounded-full bg-[#101726]/90 border border-violet-500/30 px-3.5 py-1 text-[11px] font-semibold text-violet-300 shadow-xl backdrop-blur-xl hover:border-violet-400 hover:text-white transition-all active:scale-95"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
          <span>Danış, mən xatırladım</span>
        </button>
      </div>

      {/* Main Native Bottom Navigation Bar */}
      <div className="mx-3 mb-2 rounded-[28px] border border-white/10 bg-[#0C121E]/95 shadow-2xl backdrop-blur-2xl px-2 py-1.5 pointer-events-auto">
        <div className="flex items-center justify-around relative">
          {/* TAB 1: Ana səhifə */}
          <button
            id="nav-tab-home"
            onClick={() => onTabChange('home')}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              currentTab === 'home' ? 'text-violet-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${currentTab === 'home' ? 'bg-violet-500/15' : ''}`}>
              <Home className="h-5 w-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">Ana səhifə</span>
          </button>

          {/* TAB 2: Təqvim */}
          <button
            id="nav-tab-calendar"
            onClick={() => onTabChange('calendar')}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              currentTab === 'calendar' ? 'text-violet-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${currentTab === 'calendar' ? 'bg-violet-500/15' : ''}`}>
              <Calendar className="h-5 w-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">Təqvim</span>
          </button>

          {/* CENTER SIGNATURE FLOATING AI MICROPHONE */}
          <div className="relative -top-5 px-1.5">
            <button
              id="main-floating-ai-mic-btn"
              onClick={onMicClick}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 text-white shadow-xl shadow-violet-600/40 ring-4 ring-[#090D16] border-2 border-white/25 transition-all duration-200 hover:scale-105 active:scale-90 animate-breathing-mic"
              title="Danış, mən xatırladım"
            >
              <Mic className="h-6 w-6 text-white stroke-[2.4]" />
            </button>
          </div>

          {/* TAB 3: AI köməkçi */}
          <button
            id="nav-tab-ai"
            onClick={() => onTabChange('ai')}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              currentTab === 'ai' ? 'text-violet-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${currentTab === 'ai' ? 'bg-violet-500/15' : ''}`}>
              <Bot className="h-5 w-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">AI köməkçi</span>
          </button>

          {/* TAB 4: Profil */}
          <button
            id="nav-tab-profile"
            onClick={() => onTabChange('profile')}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              currentTab === 'profile' ? 'text-violet-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${currentTab === 'profile' ? 'bg-violet-500/15' : ''}`}>
              <User className="h-5 w-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">Profil</span>
          </button>
        </div>
      </div>
    </div>
  );
};
