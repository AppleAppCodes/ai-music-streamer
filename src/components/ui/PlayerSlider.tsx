'use client';

import type { CSSProperties } from 'react';

type PlayerSliderProps = {
  value: number;
  ariaLabel: string;
  min?: number;
  max?: number;
  step?: number | string;
  thickness?: string;
  className?: string;
  disabled?: boolean;
  onValueChange: (value: number) => void;
};

export default function PlayerSlider({
  value,
  ariaLabel,
  min = 0,
  max = 100,
  step = 'any',
  thickness = '3px',
  className = '',
  disabled = false,
  onValueChange,
}: PlayerSliderProps) {
  const safeValue = Number.isFinite(value) ? value : min;
  const clampedValue = Math.max(min, Math.min(max, safeValue));
  const scale = max === min ? 0 : (clampedValue - min) / (max - min);

  const style = {
    '--player-slider-scale': String(scale),
    '--player-slider-position': `${scale * 100}%`,
    '--player-slider-height': thickness,
  } as CSSProperties;

  return (
    <div
      className={`player-slider-shell ${disabled ? 'player-slider-shell--disabled' : ''} ${className}`}
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="player-slider-fill" aria-hidden="true" />
      <span className="player-slider-knob" aria-hidden="true" />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clampedValue}
        aria-label={ariaLabel}
        className="player-slider-input"
        disabled={disabled}
        onChange={(event) => onValueChange(Number(event.currentTarget.value))}
      />
    </div>
  );
}
