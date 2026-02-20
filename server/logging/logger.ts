import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function currentLevel(): LogLevel {
  const value = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return levelOrder[level] >= levelOrder[currentLevel()];
}

function emit(level: LogLevel, event: string, meta?: LogMeta): void {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(meta ?? {})
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === "warn") {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

export const logger = {
  debug: (event: string, meta?: LogMeta) => emit("debug", event, meta),
  info: (event: string, meta?: LogMeta) => emit("info", event, meta),
  warn: (event: string, meta?: LogMeta) => emit("warn", event, meta),
  error: (event: string, meta?: LogMeta) => emit("error", event, meta)
};