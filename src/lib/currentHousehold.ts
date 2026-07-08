/**
 * Aussie Grid — Current household helpers
 * File: src/lib/currentHousehold.ts
 * Version: v0.1.2.24
 * Lines: 32
 * Updated: 8 Jul 2026 — clearCurrentHouseholdId for sign-out (reset dev switcher state).
 */
// Simple helper to manage the current pilot household during development/testing

const STORAGE_KEY = 'aussie_grid_current_household_id';
const DEFAULT_HOUSEHOLD_ID = 'sungrow-test-001';

export function getCurrentHouseholdId(): string {
  if (typeof window === 'undefined') return DEFAULT_HOUSEHOLD_ID;
  
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored || DEFAULT_HOUSEHOLD_ID;
}

export function setCurrentHouseholdId(householdId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, householdId);
}

/** Remove stored household override (e.g. on sign-out). Does not reload the page. */
export function clearCurrentHouseholdId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// Helper for dev/testing — you can call this from browser console if needed
export function resetToDefaultHousehold(): void {
  clearCurrentHouseholdId();
  window.location.reload();
}