export type LogContext = Record<string, unknown>;

type Level = 'debug' | 'info' | 'warn' | 'error';

const format = (level: Level, message: string, context?: LogContext) => {
  const timestamp = new Date().toISOString();
  return JSON.stringify({
    timestamp,
    level,
    message,
    ...(context ?? {})
  });
};

export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV === 'production') return;
    console.debug(format('debug', message, context));
  },
  info: (message: string, context?: LogContext) => {
    console.info(format('info', message, context));
  },
  warn: (message: string, context?: LogContext) => {
    console.warn(format('warn', message, context));
  },
  error: (message: string, context?: LogContext) => {
    console.error(format('error', message, context));
  }
};
