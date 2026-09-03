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
  Orbit,
  Activity,
} from 'lucide-react';
import { FocusSession, FocusAudioSettings, FocusAudioPreset } from '../../types';
import { focusService } from '../../services/focusService';
import { focusAudioService, FOCUS_AUDIO_OPTIONS } from '../../services/focusAudioService';
import { FocusAudioBottomSheet } from './FocusAudioBottomSheet';
import {
  focusVisualPreferences,
  FocusVisualTheme,
} from '../../services/focusVisualPreferences';
import { FocusVisualRenderer } from './FocusVisualRenderer';
import { FocusVisualBottomSheet } from './FocusVisualBottomSheet';

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
  const [visualTheme, setVisualTheme] = useState<FocusVisualTheme>(() =>
    focusVisualPreferences.getTheme()
  );
  const [isVisualSheetOpen, setIsVisualSheetOpen] = useState<boolean>(false);

  useEffect(() => {
    focusVisualPreferences.init().then((t) => setVisualTheme(t));
    const unsubAudio = focusAudioService.subscribe((settings, playing) => {
      setAudioSettings(settings);
      setIsAudioPlaying(playing);
    });
    const unsubVisual = focusVisualPreferences.subscribe((theme) => {
      setVisualTheme(theme);
    });
    return () => {
      unsubAudio();
      unsubVisual();
    };
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
  const clampedSeconds = Math.max(0, remainingSeconds);
  const minutes = Math.floor(clampedSeconds / 60);
  const seconds = clampedSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progress =
    totalPlannedSeconds > 0
      ? Math.max(0, Math.min(1, 1 - remainingSeconds / totalPlannedSeconds))
      : 0;

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
      {/* 1. TOP HEADER */}
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

        {/* Top Right: Discreet Secondary Audio/Visual buttons & Status */}
        <div className="flex items-center gap-1.5">
          {/* Visual Theme Quick Button */}
          <button
            type="button"
            onClick={() => setIsVisualSheetOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
            title="Görünüş"
          >
            {visualTheme === 'memory-ring' ? (
              <Orbit className="h-3.5 w-3.5 text-violet-400" />
            ) : visualTheme === 'energy-core' ? (
              <Zap className="h-3.5 w-3.5 text-fuchsia-400" />
            ) : (
              <Activity className="h-3.5 w-3.5 text-indigo-400" />
            )}
          </button>

          {/* Audio Quick Button */}
          <button
            type="button"
            onClick={() => setIsAudioSheetOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors relative"
            title="Səs"
          >
            {isAudioPlaying ? (
              <Volume2 className="h-3.5 w-3.5 text-violet-400" />
            ) : (
              renderAudioIcon(selectedAudioOption.iconName)
            )}
            {isAudioPlaying && (
              <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5">
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-400"></span>
              </span>
            )}
          </button>

          {/* Status Badge */}
          <div
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
              session.status === 'running'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            {session.status === 'running' ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
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

      {/* 2. TASK PILL */}
      {session.taskTitle && (
        <div className="flex justify-center my-1 z-10">
          <div className="max-w-[85%] px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-center backdrop-blur-md">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {session.taskTitle}
            </p>
          </div>
        </div>
      )}

      {/* 3. CENTER: ANIMATED FOCUS VISUAL & COUNTDOWN */}
      <div className="flex flex-col items-center justify-center my-auto py-1 z-10 w-full">
        <FocusVisualRenderer
          theme={visualTheme}
          progress={progress}
          isPaused={session.status !== 'running'}
        />

        {/* Large Digital Countdown Display & Label */}
        <div className="flex flex-col items-center justify-center text-center mt-2">
          <div className="text-4xl sm:text-5xl font-black tracking-tight text-white font-mono drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
            {timeFormatted}
          </div>
          <div className="text-[10px] sm:text-[11px] font-bold text-violet-300 mt-1.5 uppercase tracking-[0.25em] flex items-center justify-center gap-1.5">
            {session.status !== 'running' ? (
              <span className="text-amber-400 font-extrabold">• FASİLƏDƏ •</span>
            ) : remainingSeconds <= 0 ? (
              <span className="text-violet-400 font-extrabold">• TAMAMLANDI •</span>
            ) : (
              <span>• QALAN VAXT •</span>
            )}
          </div>
        </div>

        {/* 4. MOTIVATION TEXT */}
        <p className="text-xs text-slate-400 mt-2 text-center max-w-[270px] leading-relaxed line-clamp-2">
          {session.status === 'running'
            ? 'Diqqətini cəmlə və diqqətini yayındıran amillərdən uzaq dur.'
            : 'Fokus donduruldu. Hazır olduqda davam et.'}
        </p>
      </div>

      {/* 5. CONTROLS (3 Equal Action Buttons) */}
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

      {/* Focus Visual Theme Bottom Sheet */}
      <FocusVisualBottomSheet
        isOpen={isVisualSheetOpen}
        selectedTheme={visualTheme}
        onSelectTheme={(t) => {
          focusVisualPreferences.setTheme(t);
        }}
        onClose={() => setIsVisualSheetOpen(false)}
      />
    </div>
  );
};


