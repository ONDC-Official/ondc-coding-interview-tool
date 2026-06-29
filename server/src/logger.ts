/** Minimal timestamped logger. Keeps the server dependency-light. */
function stamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info: (...args: unknown[]) => console.log(`[${stamp()}] [info] `, ...args),
  warn: (...args: unknown[]) => console.warn(`[${stamp()}] [warn] `, ...args),
  error: (...args: unknown[]) => console.error(`[${stamp()}] [error]`, ...args),
};
