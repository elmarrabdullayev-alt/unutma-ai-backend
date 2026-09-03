import React from 'react';
import { FocusVisualTheme, FocusVisualProps } from '../../services/focusVisualPreferences';
import { MemoryRingFocusVisual } from './visuals/MemoryRingFocusVisual';
import { EnergyCoreFocusVisual } from './visuals/EnergyCoreFocusVisual';
import { SoundWaveFocusVisual } from './visuals/SoundWaveFocusVisual';

interface FocusVisualRendererProps extends FocusVisualProps {
  theme: FocusVisualTheme;
}

export const FocusVisualRenderer: React.FC<FocusVisualRendererProps> = ({
  theme,
  progress,
  isPaused,
}) => {
  // progress clamp: 0 to 1
  const clamped = Math.max(0, Math.min(1, progress));

  switch (theme) {
    case 'energy-core':
      return <EnergyCoreFocusVisual progress={clamped} isPaused={isPaused} />;
    case 'sound-wave':
      return <SoundWaveFocusVisual progress={clamped} isPaused={isPaused} />;
    case 'memory-ring':
    default:
      return <MemoryRingFocusVisual progress={clamped} isPaused={isPaused} />;
  }
};
