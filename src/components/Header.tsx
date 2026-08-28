import React from 'react';
import { Sparkles, Bell, BellRing, Bot, CheckCircle2 } from 'lucide-react';
import { requestNotificationPermission } from '../utils/notificationUtils';

interface HeaderProps {
  activeCount: number;
  completedCount: number;
  notificationPermission: NotificationPermission;
  onPermissionChange: (perm: NotificationPermission) => void;
  onOpenVoice: () => void;
  onOpenAssistant: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeCount,
  completedCount,
  notificationPermission,
  onPermissionChange,
  onOpenVoice,
  onOpenAssistant,
}) => {
  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    onPermissionChange(perm);
  };

  return (
    <header className="relative z-10 w-full border-b border-white/5 bg-[#0F172A]/80 backdrop-blur-xl px-4 py-3.5 sm:px-6">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
        {/* Brand & Slogan */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 p-[1px] shadow-lg shadow-violet-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-[#111827]">
              <Sparkles className="h-5 w-5 text-violet-400" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#111827] bg-violet-400" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg tracking-tight text-white sm:text-xl">
                Unutma <span className="text-violet-500">AI</span>
              </h1>
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300 uppercase tracking-wider">
                Səsli Yaddaş
              </span>
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">
              Şəxsi köməkçiniz
            </p>
          </div>
        </div>

        {/* Quick action buttons & status */}
        <div className="flex items-center gap-2.5">
          {/* Notification permission button */}
          {notificationPermission !== 'granted' ? (
            <button
              id="enable-notifications-btn"
              onClick={handleEnableNotifications}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-300 transition-all hover:bg-amber-500/20 active:scale-95"
              title="Bildirişləri aktivləşdir"
            >
              <BellRing className="h-3.5 w-3.5 animate-pulse text-amber-400" />
              <span className="hidden sm:inline">Bildirişləri aç</span>
            </button>
          ) : (
            <div
              className="flex items-center gap-1 rounded-xl border border-white/5 bg-slate-800/40 px-2.5 py-1.5 text-xs font-medium text-slate-300"
              title="Bildirişlər aktivdir"
            >
              <Bell className="h-3.5 w-3.5 text-violet-400" />
              <span className="hidden md:inline text-[11px]">Aktivdir</span>
            </div>
          )}

          {/* Stats Badge */}
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-white/5 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-400 shadow-sm shadow-violet-400/50" />
              <strong className="text-white font-semibold">{activeCount}</strong> aktiv
            </span>
            {completedCount > 0 && (
              <>
                <span className="text-slate-600">|</span>
                <span className="flex items-center gap-1 text-slate-400">
                  <CheckCircle2 className="h-3 w-3 text-slate-500" />
                  {completedCount}
                </span>
              </>
            )}
          </div>

          {/* Assistant shortcut Avatar */}
          <button
            id="open-assistant-btn"
            onClick={onOpenAssistant}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg shadow-violet-500/20 border border-white/10 hover:brightness-110 active:scale-95 transition-all"
            title="AI Köməkçini aç"
          >
            <Bot className="h-4 w-4 text-violet-200" />
            <span className="hidden sm:inline font-semibold">AI Köməkçi</span>
          </button>
        </div>
      </div>
    </header>
  );
};
