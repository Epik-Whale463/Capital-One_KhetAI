// Shared layout & spacing constants to promote consistent, calm UI rhythm
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18
};

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

// A simple vertical rhythm helper (returns marginBottom style)
export const vr = (mult = 1) => ({ marginBottom: spacing.sm * mult });
