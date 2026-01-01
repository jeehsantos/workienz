/**
 * Format hourly rate range for display
 * Returns clean string without redundant currency symbols
 */
export function formatHourlyRate(
  min: number | null,
  max: number | null
): string | null {
  if (!min && !max) return null;
  
  if (min && max) {
    return `${min}–${max}/hr`;
  }
  
  if (min) {
    return `From ${min}/hr`;
  }
  
  if (max) {
    return `Up to ${max}/hr`;
  }
  
  return null;
}
