import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Clock,
  Flame,
  Volume2,
  VolumeX,
  X,
  Plus,
  Minus,
  Music,
  CloudRain,
  Coffee,
  Waves,
  Zap,
  Trees,
  ChevronRight,
  Orbit,
  Activity,
} from 'lucide-react';
import { Reminder, FocusTodayStats, FocusAudioPreset, FocusAudioSettings } from '../../types';
import { formatTimeOnly } from '../../utils/dateUtils';
import { focusAudioService, FOCUS_AUDIO_OPTIONS } from '../../services/focusAudioService';
import { FocusAudioBottomSheet } from './FocusAudioBottomSheet';
import {
  focusVisualPreferences,
  FocusVisualTheme,
  FOCUS_VISUAL_OPTIONS,
} from '../../services/focusVisualPreferences';
import { FocusVisualBottomSheet } from './FocusVisualBottomSheet';

interface FocusSetupScreenProps {
  reminders: Reminder[];
  initialReminder?: Reminder | null;
  todayStats: FocusTodayStats;
  onStartSession: (params: {
    taskTitle: string;
    plannedMinutes: number;
    linkedReminderId?: string;
    audioPreset: string;
  }) => void;
  onClose: () => void;
}

const PRESET_DURATIONS = [15, 25, 30, 45, 60];

export const FocusSetupScreen: React.FC<FocusSetupScreenProps> = ({
  reminders,
  initialReminder,
  todayStats,
  onStartSession,
  onClose,
}) => {
  const [taskSource, setTaskSource] = useState<'reminder' | 'manual'>(
    initialReminder ? 'reminder' : 'manual'
  );
  const [selectedReminderId, setSelectedReminderId] = useState<string>(
    initialReminder?.id || ''
  );
  const [manualTitle, setManualTitle] = useState<string>(
    initialReminder?.title || ''
  );
  const [selectedMinutes, setSelectedMinutes] = useState<number>(25);
  const [isCustomDuration, setIsCustomDuration] = useState<boolean>(false);
  const [audioSettings, setAudioSettings] = useState<FocusAudioSettings>(() =>
    focusAudioService.getSettings()
  );
  const [isAudioModalOpen, setIsAudioModalOpen] = useState<boolean>(false);
  const [visualTheme, setVisualTheme] = useState<FocusVisualTheme>(() =>
    focusVisualPreferences.getTheme()
  );
  const [isVisualModalOpen, setIsVisualModalOpen] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string>('');

  useEffect(() => {
    focusVisualPreferences.init().then((t) => setVisualTheme(t));
    const unsubAudio = focusAudioService.subscribe((settings) => {
      setAudioSettings(settings);
    });
    const unsubVisual = focusVisualPreferences.subscribe((theme) => {
      setVisualTheme(theme);
    });
    return () => {
      unsubAudio();
      unsubVisual();
    };
  }, []);

  const activeReminders = reminders.filter((r) => !r.isCompleted);

  const selectedAudioOption =
    FOCUS_AUDIO_OPTIONS.find((opt) => opt.id === audioSettings.preset) ||
    FOCUS_AUDIO_OPTIONS[0];

  const selectedVisualOption =
    FOCUS_VISUAL_OPTIONS.find((opt) => opt.id === visualTheme) ||
    FOCUS_VISUAL_OPTIONS[0];

  const renderVisualIcon = (themeId: FocusVisualTheme) => {
    switch (themeId) {
      case 'memory-ring':
        return <Orbit className="h-4 w-4 text-zer-400" />;
      case 'energy-core':
        return <Zap className="h-4 w-4 text-zer-400" />;
      case 'sound-wave':
        return <Activity className="h-4 w-4 text-zer-400" />;
      default:
        return <Orbit className="h-4 w-4 text-zer-400" />;
    }
  };

  const renderAudioIcon = (iconName: string) => {
    switch (iconName) {
      case 'Music':
        return <Music className="h-4 w-4 text-zer-400" />;
      case 'CloudRain':
        return <CloudRain className="h-4 w-4 text-cyan-400" />;
      case 'Coffee':
        return <Coffee className="h-4 w-4 text-amber-400" />;
      case 'Waves':
        return <Waves className="h-4 w-4 text-blue-400" />;
      case 'Zap':
        return <Zap className="h-4 w-4 text-zer-400" />;
      case 'Trees':
        return <Trees className="h-4 w-4 text-pista-400" />;
      case 'VolumeX':
      default:
        return <VolumeX className="h-4 w-4 text-ink-400" />;
    }
  };

  const handleStart = () => {
    let finalTitle = '';
    let linkedId: string | undefined = undefined;

    if (taskSource === 'reminder') {
      const found = activeReminders.find((r) => r.id === selectedReminderId);
      if (!found) {
        setErrorText('Zəhmət olmasa bir xatırlatma seçin və ya sərbəst tapşırıq yazın.');
        return;
      }
      finalTitle = found.title;
      linkedId = found.id;
    } else {
      if (!manualTitle.trim()) {
        setErrorText('Zəhmət olmasa fokuslanacağınız tapşırığı qeyd edin.');
        return;
      }
      finalTitle = manualTitle.trim();
    }

    setErrorText('');
    onStartSession({
      taskTitle: finalTitle,
      plannedMinutes: selectedMinutes,
      linkedReminderId: linkedId,
      audioPreset: audioSettings.preset,
    });
  };

  return (
    <div
      className="flex flex-col h-full bg-[#130e13] text-white px-5 pb-5 overflow-y-auto select-none relative"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 20px)',
      }}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zer-500/10 border border-zer-500/20 text-zer-300 text-[13px] font-bold mb-1.5">
            <Flame className="h-3.5 w-3.5 text-zer-400" />
            Fokus Rejimi
          </div>
          <h2 className="font-display text-[30px] leading-[1.1] font-normal text-ink-50">Fokuslan</h2>
          <p className="text-xs text-ink-400 mt-0.5">
            Bir iş seç və diqqətini yalnız ona ver.
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Bağla"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-ink-400 hover:text-white transition-colors active:scale-95 shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Today Stats Summary Bar */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-[#1d161c] border border-white/5 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zer-500/15 text-zer-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[12px] font-extrabold text-ink-400">
              Bu gün
            </p>
            <p className="text-xs font-bold text-ink-200">
              {todayStats.count > 0
                ? `${todayStats.count} sessiya • ${todayStats.totalMinutes} dəqiqə`
                : 'Hələ fokus sessiyası olmayıb'}
            </p>
          </div>
        </div>
        <span className="text-[13px] font-semibold text-zer-400">Daimi inkişaf</span>
      </div>

      {/* SECTION 1: TASK SELECTION */}
      <div className="space-y-3 mb-6">
        <label className="block text-[13px] font-extrabold text-ink-400">
          Tapşırıq Seçimi
        </label>

        {/* Source Segmented Control */}
        <div className="flex bg-[#1d161c] p-1 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => {
              setTaskSource('manual');
              setErrorText('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              taskSource === 'manual'
                ? ' btn-gold text-ink-950 shadow-md'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            Sərbəst Tapşırıq
          </button>
          <button
            type="button"
            onClick={() => {
              setTaskSource('reminder');
              setErrorText('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              taskSource === 'reminder'
                ? ' btn-gold text-ink-950 shadow-md'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            Xatırlatmalardan ({activeReminders.length})
          </button>
        </div>

        {/* Manual Input */}
        {taskSource === 'manual' && (
          <div>
            <input
              type="text"
              value={manualTitle}
              onChange={(e) => {
                setManualTitle(e.target.value);
                if (errorText) setErrorText('');
              }}
              placeholder="İndi nəyə fokuslanırsan? (məs: Yarımçıq hesabatı bitir)"
              className="w-full h-12 px-4 rounded-xl bg-[#1d161c] border border-white/10 text-white placeholder-ink-500 text-xs focus:border-zer-500 outline-none transition-colors"
            />
          </div>
        )}

        {/* Existing Reminder Select */}
        {taskSource === 'reminder' && (
          <div>
            {activeReminders.length > 0 ? (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {activeReminders.map((r) => {
                  const isSelected = selectedReminderId === r.id;
                  const time = formatTimeOnly(r.dueDateTime);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelectedReminderId(r.id);
                        if (errorText) setErrorText('');
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-zer-500/15 border-zer-500 text-white'
                          : 'bg-[#1d161c] border-white/5 text-ink-300 hover:bg-[#251c24]'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-bold truncate">{r.title}</p>
                        {time && (
                          <p className="text-[12px] text-ink-400 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3 text-zer-400" />
                            {time}
                          </p>
                        )}
                      </div>
                      <div
                        className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-zer-400 btn-gold text-ink-950'
                            : 'border-ink-600'
                        }`}
                      >
                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#1d161c] border border-white/5 text-center">
                <p className="text-xs text-ink-400">Aktiv xatırlatma tapılmadı.</p>
                <button
                  type="button"
                  onClick={() => setTaskSource('manual')}
                  className="mt-2 text-xs font-bold text-zer-400 hover:underline"
                >
                  Sərbəst tapşırıq yazın
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 2: DURATION SELECTOR (Presets: 15, 25, 30, 45, 60) */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-extrabold text-ink-400">
            Fokus Müddəti
          </label>
          <span className="text-xs font-black text-zer-400">
            {selectedMinutes} dəqiqə
          </span>
        </div>

        {/* Quick Presets */}
        <div className="grid grid-cols-5 gap-1.5">
          {PRESET_DURATIONS.map((min) => {
            const isSelected = !isCustomDuration && selectedMinutes === min;
            return (
              <button
                key={min}
                type="button"
                onClick={() => {
                  setSelectedMinutes(min);
                  setIsCustomDuration(false);
                }}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  isSelected
                    ? ' border-zer-400 btn-gold text-ink-950 shadow-md'
                    : 'bg-[#1d161c] border-white/5 text-ink-300 hover:bg-[#251c24]'
                }`}
              >
                {min} dəq
              </button>
            );
          })}
        </div>

        {/* Custom Duration Option */}
        <div className="p-3 rounded-xl bg-[#1d161c] border border-white/5 flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-300">Xüsusi vaxt (5–180 dəq)</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCustomDuration(true);
                setSelectedMinutes((prev) => Math.max(5, prev - 5));
              }}
              className="h-8 w-8 rounded-lg bg-[#251c24] flex items-center justify-center text-ink-300 active:scale-95"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-12 text-center text-xs font-extrabold text-white">
              {selectedMinutes}m
            </span>
            <button
              type="button"
              onClick={() => {
                setIsCustomDuration(true);
                setSelectedMinutes((prev) => Math.min(180, prev + 5));
              }}
              className="h-8 w-8 rounded-lg bg-[#251c24] flex items-center justify-center text-ink-300 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: FOCUS AUDIO PRESET */}
      <div className="space-y-2 mb-6">
        <div>
          <h4 className="text-[13px] font-extrabold text-ink-400">
            Fokus səsi
          </h4>
          <p className="text-xs text-ink-400 mt-0.5">
            Diqqətini toplamağa kömək edən fon səsini seç.
          </p>
        </div>

        {/* Selected Audio Trigger Card */}
        <button
          type="button"
          onClick={() => setIsAudioModalOpen(true)}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#1d161c] border border-white/5 hover:border-zer-500/30 transition-all text-left group"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 rounded-xl bg-zer-500/15 border border-zer-500/20 flex items-center justify-center shrink-0">
              {renderAudioIcon(selectedAudioOption.iconName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-white group-hover:text-zer-300 transition-colors">
                  {selectedAudioOption.name}
                </p>
                {audioSettings.preset !== 'silent' && (
                  <span className="px-1.5 py-0.5 rounded-md bg-zer-500/20 text-[12px] font-bold text-zer-300 font-mono">
                    {Math.round(audioSettings.volume * 100)}%
                  </span>
                )}
              </div>
              <p className="text-[13px] text-ink-400 truncate mt-0.5">
                {selectedAudioOption.subtitle || 'Səssiz mühit'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-ink-400 group-hover:text-zer-400 transition-colors text-xs font-bold pl-2">
            <span>Seç</span>
            <ChevronRight className="h-4 w-4" />
          </div>
        </button>
      </div>

      {/* SECTION 4: FOCUS VISUAL THEME SELECTOR */}
      <div className="space-y-2 mb-6">
        <div>
          <h4 className="text-[13px] font-extrabold text-ink-400">
            Fokus görünüşü
          </h4>
          <p className="text-xs text-ink-400 mt-0.5">
            Sessiya zamanı göstəriləcək animasiya üslubunu seç.
          </p>
        </div>

        {/* Selected Visual Trigger Card */}
        <button
          type="button"
          onClick={() => setIsVisualModalOpen(true)}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#1d161c] border border-white/5 hover:border-zer-500/30 transition-all text-left group"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 rounded-xl bg-zer-500/15 border border-zer-500/20 flex items-center justify-center shrink-0">
              {renderVisualIcon(visualTheme)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-white group-hover:text-zer-300 transition-colors">
                  {selectedVisualOption.title}
                </p>
                <span className="px-1.5 py-0.5 rounded-md bg-zer-500/20 text-[12px] font-bold text-zer-300">
                  Animasiya
                </span>
              </div>
              <p className="text-[13px] text-ink-400 truncate mt-0.5">
                {selectedVisualOption.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-ink-400 group-hover:text-zer-400 transition-colors text-xs font-bold pl-2">
            <span>Dəyiş</span>
            <ChevronRight className="h-4 w-4" />
          </div>
        </button>
      </div>

      {errorText && (
        <p className="text-xs text-nar-400 font-semibold mb-4 text-center animate-fade-in">
          {errorText}
        </p>
      )}

      {/* Primary Start Button */}
      <div className="mt-auto pt-4 pb-2">
        <button
          type="button"
          onClick={handleStart}
          className="w-full h-12 rounded-2xl btn-gold text-ink-950 font-extrabold text-sm shadow-lg shadow-zer-600/30 active:scale-[0.98] hover:brightness-110 transition-all flex items-center justify-center gap-2"
        >
          <Flame className="h-4 w-4" />
          Fokuslan ({selectedMinutes} dəq)
        </button>
      </div>

      {/* Audio Selection Bottom Sheet */}
      <FocusAudioBottomSheet
        isOpen={isAudioModalOpen}
        settings={audioSettings}
        isPlaying={focusAudioService.isAudioPlaying()}
        onSelectPreset={(p) => focusAudioService.setPreset(p, false)}
        onChangeVolume={(v) => focusAudioService.setVolume(v)}
        onToggleAutoPlay={(a) => focusAudioService.setAutoPlay(a)}
        onClose={() => setIsAudioModalOpen(false)}
      />

      {/* Focus Visual Theme Bottom Sheet */}
      <FocusVisualBottomSheet
        isOpen={isVisualModalOpen}
        selectedTheme={visualTheme}
        onSelectTheme={(t) => {
          focusVisualPreferences.setTheme(t);
        }}
        onClose={() => setIsVisualModalOpen(false)}
      />
    </div>
  );
};

