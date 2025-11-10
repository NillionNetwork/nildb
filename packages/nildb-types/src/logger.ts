import { z } from "zod";

export const LogLevel = z.enum(["debug", "info", "warn", "error"]);
export type LogLevel = z.infer<typeof LogLevel>;
