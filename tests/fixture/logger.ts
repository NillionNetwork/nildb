import pino, { type Logger } from "pino";

export function createTestLogger(id: string): Logger {
  return pino({
    transport: {
      target: "pino-pretty",
      options: {
        sync: true,
        singleLine: true,
        messageFormat: `${id} - {msg}`,
      },
    },
  });
}
