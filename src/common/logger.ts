import pino, { type Logger } from "pino";

export function createLogger(level: string): Logger {
  return pino({
    base: {
      pid: undefined,
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    level,
  });
}
