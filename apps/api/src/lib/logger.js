const format = (level, message, context) => {
  const timestamp = new Date().toISOString();
  return JSON.stringify({
    timestamp,
    level,
    message,
    ...(context ?? {})
  });
};

export const logger = {
  debug: (message, context) => {
    if (process.env.NODE_ENV === 'production') return;
    console.debug(format('debug', message, context));
  },
  info: (message, context) => {
    console.info(format('info', message, context));
  },
  warn: (message, context) => {
    console.warn(format('warn', message, context));
  },
  error: (message, context) => {
    console.error(format('error', message, context));
  }
};
