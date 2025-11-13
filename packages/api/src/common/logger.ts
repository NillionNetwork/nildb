import { SeverityNumber } from "@opentelemetry/api-logs";
import type { LoggerProvider } from "@opentelemetry/sdk-logs";
import pino, { type Logger } from "pino";
import packageJson from "../../package.json";

export function createLogger(
  level: string,
  loggerProvider?: LoggerProvider,
): Logger {
  // Always create Pino logger for stdout/stderr visibility
  const pinoLogger = pino({
    base: {
      pid: undefined,
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    level,
    serializers: {
      error: pino.stdSerializers.err,
    },
  });

  // If OTel logger provider is available, bridge to it
  if (loggerProvider) {
    const otelLogger = loggerProvider.getLogger("nildb", packageJson.version);

    // Wrap Pino to emit to both stdout and OTel
    return new Proxy(pinoLogger, {
      get(target, prop) {
        // Intercept log methods to emit to OTel
        if (
          typeof prop === "string" &&
          ["trace", "debug", "info", "warn", "error", "fatal"].includes(prop)
        ) {
          return function (this: Logger, ...args: unknown[]) {
            // Call original Pino method
            const result = (
              target as unknown as Record<
                string,
                (...args: unknown[]) => unknown
              >
            )[prop].apply(this, args);

            // Emit to OTel
            const [messageOrObj, ...rest] = args;
            const message =
              typeof messageOrObj === "string"
                ? messageOrObj
                : String(rest[0] || "");

            // Convert attributes to proper type for OTel
            const attributes: Record<string, string | number | boolean> = {};
            if (typeof messageOrObj === "object" && messageOrObj !== null) {
              const obj = messageOrObj as Record<string, unknown>;
              for (const [key, value] of Object.entries(obj)) {
                // Only include primitive types that OTel supports
                if (
                  typeof value === "string" ||
                  typeof value === "number" ||
                  typeof value === "boolean"
                ) {
                  attributes[key] = value;
                } else if (value !== null && value !== undefined) {
                  try {
                    attributes[key] = JSON.stringify(value);
                  } catch {
                    // Fallback to String() if JSON.stringify fails (e.g., circular refs)
                    attributes[key] = String(value);
                  }
                }
              }
            }

            otelLogger.emit({
              severityNumber: mapPinoLevelToOtel(prop),
              severityText: prop.toUpperCase(),
              body: message,
              attributes,
            });

            return result;
          };
        }

        return target[prop as keyof Logger];
      },
    });
  }

  return pinoLogger;
}

function mapPinoLevelToOtel(level: string): SeverityNumber {
  switch (level) {
    case "trace":
      return SeverityNumber.TRACE;
    case "debug":
      return SeverityNumber.DEBUG;
    case "info":
      return SeverityNumber.INFO;
    case "warn":
      return SeverityNumber.WARN;
    case "error":
      return SeverityNumber.ERROR;
    case "fatal":
      return SeverityNumber.FATAL;
    default:
      return SeverityNumber.UNSPECIFIED;
  }
}
