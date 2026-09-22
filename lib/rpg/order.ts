// Deterministic string order for tie-breaks. localeCompare depends on the
// runtime's locale and ICU data, so server and browser could disagree.
export const compareIds = (a: string, b: string) =>
  a < b ? -1 : a > b ? 1 : 0;
