import pino, { type Logger } from "pino";
import { z } from "zod";

export const LogLevel = z.enum(["debug", "info", "warn", "error"]);
export type LogLevel = z.infer<typeof LogLevel>;

export function createLogger(level: string): Logger {
  return pino({
    base: {
      pid: undefined,
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    level,
  });
}
