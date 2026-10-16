import React from 'react';
import {
  VolumeX,
  Music,
  CloudRain,
  Coffee,
  Waves,
  Zap,
  Trees,
  Check,
  X,
  Volume2,
  Volume1,
  Sparkles,
} from 'lucide-react';
import { FocusAudioPreset, FocusAudioSettings } from '../../types';
import { FOCUS_AUDIO_OPTIONS } from '../../services/focusAudioService';

interface FocusAudioBottomSheetProps {
  isOpen: boolean;
  settings: FocusAudioSettings;
  isPlaying: boolean;
  onSelectPreset: (preset: FocusAudioPreset) => void;
  onChangeVolume: (volume: number) => void;
  onToggleAutoPlay: (autoPlay: boolean) => void;
  onTogglePlay?: () => void;
  onClose: () => void;
}

export const FocusAudioBottomSheet: React.FC<FocusAudioBottomSheetProps> = ({
  isOpen,
  settings,
  isPlaying,
  onSelectPreset,
  onChangeVolume,
  onToggleAutoPlay,
  onClose,
}) => {
  if (!isOpen) return null;

  const renderIcon = (iconName: string, isSelected: boolean) => {
    const cls = `h-4 w-4 ${isSelected ? 'text-zer-400' : 'text-ink-400'}`;
    switch (iconName) {
      case 'Music':
        return <Music className={cls} />;
      case 'CloudRain':
        return <CloudRain className={cls} />;
      case 'Coffee':
        return <Coffee className={cls} />;
      case 'Waves':
        return <Waves className={cls} />;
      case 'Zap':
        return <Zap className={cls} />;
      case 'Trees':
        return <Trees className={cls} />;
      case 'VolumeX':
      default:
        return <VolumeX className={cls} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-[#130e13] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] flex flex-col animate-slide-up select-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-white/5">
          <div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zer-500/10 border border-zer-500/20 text-zer-300 text-[12px] font-bold mb-1">
              <Sparkles className="h-3 w-3 text-zer-400" />
              Fon Səsi
            </div>
            <h3 className="text-base font-black text-white tracking-tight">Fokus səsi</h3>
            <p className="text-xs text-ink-400 mt-0.5">
              Diqqətini toplamağa kömək edən fon səsini seç.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Bağla"
            className="h-11 w-11 -mr-2 rounded-xl bg-white/5 hover:bg-white/10 text-ink-400 hover:text-white flex items-center justify-center transition-colors active:scale-95 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Audio Options List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-1.5 pr-1 max-h-64">
          {FOCUS_AUDIO_OPTIONS.map((opt) => {
            const isSelected = settings.preset === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectPreset(opt.id)}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left ${
                  isSelected
                    ? 'bg-zer-500/15 border-zer-500/50 text-white shadow-sm'
                    : 'bg-[#1d161c] border-white/5 text-ink-300 hover:bg-[#251c24]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-zer-600/30 text-zer-300 border border-zer-500/40'
                        : 'bg-white/5 text-ink-400'
                    }`}
                  >
                    {renderIcon(opt.iconName, isSelected)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{opt.name}</p>
                    {opt.subtitle && (
                      <p className="text-[12px] text-ink-400 truncate mt-0.5">
                        {opt.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pl-2">
                  {isSelected ? (
                    <div className="h-5 w-5 rounded-full flex items-center justify-center btn-gold text-ink-950 shadow-md">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="h-5 w-5 rounded-full border border-ink-700" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Volume & AutoPlay Controls */}
        <div className="pt-3 border-t border-white/5 space-y-3">
          {/* Volume Slider */}
          <div className="p-3 rounded-2xl bg-[#1d161c] border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-ink-300 flex items-center gap-1.5 text-[13px]">
                {settings.volume === 0 ? (
                  <VolumeX className="h-3.5 w-3.5 text-ink-500" />
                ) : settings.volume < 0.5 ? (
                  <Volume1 className="h-3.5 w-3.5 text-zer-400" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5 text-zer-400" />
                )}
                Səs səviyyəsi
              </span>
              <span className="font-black text-zer-400 text-xs font-mono">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-ink-800 rounded-lg appearance-none cursor-pointer accent-zer-500"
            />
          </div>

          {/* AutoPlay Toggle */}
          <div className="p-3 rounded-2xl bg-[#1d161c] border border-white/5 flex items-center justify-between">
            <div className="pr-3">
              <p className="text-xs font-bold text-ink-200">
                Fokus başlayanda avtomatik səsləndir
              </p>
              <p className="text-[12px] text-ink-400">
                Sessiya başlayan kimi seçilmiş səs oxunacaq
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggleAutoPlay(!settings.autoPlay)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                settings.autoPlay ? 'bg-zer-600' : 'bg-ink-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.autoPlay ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Confirm / Close button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-2xl btn-gold text-ink-950 text-xs font-extrabold shadow-lg shadow-zer-600/25 active:scale-[0.98] transition-all"
          >
            Təsdiq et
          </button>
        </div>
      </div>
    </div>
  );
};
