/**
 * 1.0.0: YUIChat 项目 - 日志工具
 * Logger utility for conditional logging in development vs production
 * Only logs in development mode to avoid exposing sensitive information in production
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    // Only log errors in development
    if (isDev) {
      console.error(...args);
    }
  },
};

