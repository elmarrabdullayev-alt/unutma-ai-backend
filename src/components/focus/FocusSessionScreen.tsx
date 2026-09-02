import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Plus,
  Square,
  Flame,
  Volume2,
  VolumeX,
  Music,
  CloudRain,
  Coffee,
  Waves,
  Zap,
  Trees,
} from 'lucide-react';
import { FocusSession, FocusAudioSettings, FocusAudioPreset } from '../../types';
import { focusService } from '../../services/focusService';
import { focusAudioService, FOCUS_AUDIO_OPTIONS } from '../../services/focusAudioService';
import { FocusAudioBottomSheet } from './FocusAudioBottomSheet';
import { HourglassFocusTimer } from './HourglassFocusTimer';

interface FocusSessionScreenProps {
  session: FocusSession;
  onSessionFinished: () => void;
  onStopEarly: () => void;
}

export const FocusSessionScreen: React.FC<FocusSessionScreenProps> = ({
  session,
  onSessionFinished,
  onStopEarly,
}) => {
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    focusService.getRemainingMs(session)
  );
  const [showConfirmStop, setShowConfirmStop] = useState<boolean>(false);
  const [audioSettings, setAudioSettings] = useState<FocusAudioSettings>(() =>
    focusAudioService.getSettings()
  );
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(() =>
    focusAudioService.isAudioPlaying()
  );
  const [isAudioSheetOpen, setIsAudioSheetOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsub = focusAudioService.subscribe((settings, playing) => {
      setAudioSettings(settings);
      setIsAudioPlaying(playing);
    });
    return unsub;
  }, []);

  // High-precision ticker based on timestamps
  useEffect(() => {
    const updateTick = () => {
      const ms = focusService.getRemainingMs(session);
      setRemainingMs(ms);

      if (ms <= 0 && session.status === 'running') {
        onSessionFinished();
      }
    };

    updateTick();
    const interval = setInterval(updateTick, 500);

    return () => clearInterval(interval);
  }, [session, onSessionFinished]);

  // Handle Pause / Resume
  const handleTogglePause = async () => {
    if (session.status === 'running') {
      await focusService.pauseSession();
    } else {
      await focusService.resumeSession();
    }
  };

  // Handle +1 Minute (Preserves audio state without interruption)
  const handleAddMinute = async () => {
    await focusService.addMinutes(1);
  };

  const handleAudioPresetChange = async (preset: FocusAudioPreset) => {
    await focusService.setSessionAudioPreset(preset);
  };

  // Format Time Display
  const totalPlannedSeconds = session.plannedMinutes * 60;
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  const startTimeStr = new Date(session.startedAt).toLocaleTimeString('az-AZ', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTimeStr = new Date(session.expectedEndAt).toLocaleTimeString('az-AZ', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const selectedAudioOption =
    FOCUS_AUDIO_OPTIONS.find((opt) => opt.id === (session.audioPreset || audioSettings.preset)) ||
    FOCUS_AUDIO_OPTIONS[0];

  const renderAudioIcon = (iconName: string) => {
    switch (iconName) {
      case 'Music':
        return <Music className="h-3.5 w-3.5 text-violet-400" />;
      case 'CloudRain':
        return <CloudRain className="h-3.5 w-3.5 text-cyan-400" />;
      case 'Coffee':
        return <Coffee className="h-3.5 w-3.5 text-amber-400" />;
      case 'Waves':
        return <Waves className="h-3.5 w-3.5 text-blue-400" />;
      case 'Zap':
        return <Zap className="h-3.5 w-3.5 text-indigo-400" />;
      case 'Trees':
        return <Trees className="h-3.5 w-3.5 text-emerald-400" />;
      case 'VolumeX':
      default:
        return <VolumeX className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0D1322] via-[#090D16] to-[#070A12] text-white p-4 sm:p-5 justify-between relative select-none rounded-[28px] sm:rounded-[32px] border border-violet-500/20 shadow-[0_0_50px_rgba(139,92,246,0.12)] overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 z-10">
        {/* Top Left: Focus Brand & Time Span */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400 shadow-inner">
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
              FOKUS
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              {startTimeStr} → {endTimeStr}
            </p>
          </div>
        </div>

        {/* Top Right: Audio Pill & Status Badge */}
        <div className="flex items-center gap-2">
          {/* Audio Quick Pill */}
          <button
            type="button"
            onClick={() => setIsAudioSheetOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#121826]/90 border border-white/10 hover:border-violet-500/40 text-[11px] font-bold text-slate-300 transition-all active:scale-95 shadow-sm"
            title="Fon səsini dəyişdir"
          >
            {isAudioPlaying ? (
              <Volume2 className="h-3.5 w-3.5 text-violet-400" />
            ) : (
              renderAudioIcon(selectedAudioOption.iconName)
            )}
            <span className="text-[10px] hidden xs:inline sm:inline max-w-[65px] truncate">
              {selectedAudioOption.name}
            </span>
            {isAudioPlaying && (
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500"></span>
              </span>
            )}
          </button>

          {/* Status Badge */}
          <div
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
              session.status === 'running'
                ? 'bg-[#2BE58C]/10 border-[#2BE58C]/30 text-[#2BE58C]'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            {session.status === 'running' ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-[#2BE58C] shadow-[0_0_8px_#2BE58C] animate-pulse"></span>
                <span>Aktiv</span>
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                <span>Fasilədə</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Center Section: Dominant Animated Hourglass */}
      <div className="flex flex-col items-center justify-center my-auto py-2 z-10">
        <HourglassFocusTimer
          totalSeconds={totalPlannedSeconds}
          remainingSeconds={remainingSeconds}
          isPaused={session.status !== 'running'}
          taskTitle={session.taskTitle}
        />

        {/* Motivational Guidance Line */}
        <p className="text-xs text-slate-400 mt-2.5 text-center max-w-[270px] leading-relaxed">
          {session.status === 'running'
            ? 'Diqqətini cəmlə və diqqətini yayındıran amillərdən uzaq dur.'
            : 'Fokus donduruldu. Hazır olduqda davam et.'}
        </p>
      </div>

      {/* Primary Session Controls: 3 Equal Rounded Actions */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-2 z-10">
        {/* Pause / Resume Button */}
        <button
          type="button"
          onClick={handleTogglePause}
          className={`h-12 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md ${
            session.status === 'running'
              ? 'bg-[#131A2B]/90 border border-white/10 hover:border-violet-500/40 text-slate-200 hover:text-white'
              : 'bg-gradient-to-r from-violet-600 to-indigo-600 border border-violet-400 text-white shadow-lg shadow-violet-600/30'
          }`}
        >
          {session.status === 'running' ? (
            <>
              <Pause className="h-4 w-4 text-amber-400" />
              <span>Pauza</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-white" />
              <span>Davam et</span>
            </>
          )}
        </button>

        {/* +1 Minute Button */}
        <button
          type="button"
          onClick={handleAddMinute}
          className="h-12 rounded-2xl bg-[#131A2B]/90 border border-white/10 hover:border-violet-500/40 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all shadow-md"
          title="1 dəqiqə əlavə et"
        >
          <Plus className="h-3.5 w-3.5 text-violet-400" />
          <span>+1 dəq</span>
        </button>

        {/* Finish / Stop Button */}
        <button
          type="button"
          onClick={() => setShowConfirmStop(true)}
          className="h-12 rounded-2xl bg-[#131A2B]/90 border border-white/10 hover:border-rose-500/40 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
        >
          <Square className="h-3.5 w-3.5" />
          <span>Bitir</span>
        </button>
      </div>

      {/* Early Finish Confirmation Modal */}
      {showConfirmStop && (
        <div className="absolute inset-0 bg-[#070A12]/95 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="w-full max-w-xs rounded-2xl bg-[#121826] border border-white/10 p-5 text-center shadow-2xl space-y-4">
            <div className="h-10 w-10 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
              <Square className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                Fokus sessiyasını bitirmək istəyirsən?
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                İndiyə qədər olan fokus vaxtınız qeyd olunacaq.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmStop(false)}
                className="flex-1 h-10 rounded-xl bg-white/5 text-slate-300 text-xs font-bold hover:bg-white/10 active:scale-95 transition-all"
              >
                Davam et
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmStop(false);
                  onStopEarly();
                }}
                className="flex-1 h-10 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 active:scale-95 transition-all shadow-lg shadow-rose-600/30"
              >
                Bitir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio Bottom Sheet during active session */}
      <FocusAudioBottomSheet
        isOpen={isAudioSheetOpen}
        settings={audioSettings}
        isPlaying={isAudioPlaying}
        onSelectPreset={handleAudioPresetChange}
        onChangeVolume={(v) => focusAudioService.setVolume(v)}
        onToggleAutoPlay={(a) => focusAudioService.setAutoPlay(a)}
        onClose={() => setIsAudioSheetOpen(false)}
      />
    </div>
  );
};


