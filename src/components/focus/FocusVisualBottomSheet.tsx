import React from 'react';
import { Sparkles, Check, X, Orbit, Zap, Activity } from 'lucide-react';
import {
  FocusVisualTheme,
  FOCUS_VISUAL_OPTIONS,
} from '../../services/focusVisualPreferences';

interface FocusVisualBottomSheetProps {
  isOpen: boolean;
  selectedTheme: FocusVisualTheme;
  onSelectTheme: (theme: FocusVisualTheme) => void;
  onClose: () => void;
}

export const FocusVisualBottomSheet: React.FC<FocusVisualBottomSheetProps> = ({
  isOpen,
  selectedTheme,
  onSelectTheme,
  onClose,
}) => {
  if (!isOpen) return null;

  const renderThemeIcon = (themeId: FocusVisualTheme, isSelected: boolean) => {
    const iconClass = `h-5 w-5 ${isSelected ? 'text-zer-300' : 'text-ink-400'}`;
    switch (themeId) {
      case 'memory-ring':
        return <Orbit className={iconClass} />;
      case 'energy-core':
        return <Zap className={iconClass} />;
      case 'sound-wave':
        return <Activity className={iconClass} />;
      default:
        return <Sparkles className={iconClass} />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-visual-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#130e13] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] flex flex-col animate-slide-up select-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-white/5">
          <div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zer-500/10 border border-zer-500/20 text-zer-300 text-[12px] font-bold mb-1">
              <Sparkles className="h-3 w-3 text-zer-400" />
              Vizual Üslub
            </div>
            <h3 id="focus-visual-modal-title" className="text-base font-black text-white tracking-tight">
              Fokus görünüşü
            </h3>
            <p className="text-xs text-ink-400 mt-0.5">
              Fokus sessiyası zamanı göstəriləcək animasiya tərzini seçin.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-11 -mr-2 rounded-xl bg-white/5 hover:bg-white/10 text-ink-400 hover:text-white flex items-center justify-center transition-colors active:scale-95 shrink-0"
            aria-label="Bağla"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Visual Themes Options List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-0.5">
          {FOCUS_VISUAL_OPTIONS.map((opt) => {
            const isSelected = selectedTheme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelectTheme(opt.id);
                }}
                className={`w-full flex items-start gap-3.5 p-3.5 rounded-2xl border text-left transition-all group ${
                  isSelected
                    ? 'bg-zer-600/15 border-zer-500 shadow-md shadow-zer-950/30'
                    : 'bg-[#1d161c] border-white/5 hover:border-zer-500/20 hover:bg-[#251c24]'
                }`}
              >
                {/* Visual Icon Badge */}
                <div
                  className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                    isSelected
                      ? 'bg-zer-600/25 border-zer-400/40 text-zer-300 shadow-inner'
                      : 'bg-[#2e242d] border-white/5 text-ink-400 group-hover:text-ink-300'
                  }`}
                >
                  {renderThemeIcon(opt.id, isSelected)}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center justify-between gap-1">
                    <h4
                      className={`text-xs font-bold truncate ${
                        isSelected ? 'text-zer-200' : 'text-white'
                      }`}
                    >
                      {opt.title}
                    </h4>
                    {isSelected && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full btn-gold text-ink-950 shrink-0">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] font-semibold text-zer-400/90 mt-0.5">
                    {opt.subtitle}
                  </p>
                  <p className="text-[13px] text-ink-400 mt-1 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer info note */}
        <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[13px] text-ink-400">
          <span>Seçim avtomatik yadda saxlanılır</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl btn-gold text-ink-950 font-bold text-xs active:scale-95 transition-all shadow-sm"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
