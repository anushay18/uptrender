/**
 * Unified Logger for AlgoEngine
 * Handles logging across all modules
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  constructor(options = {}) {
    this.level = LOG_LEVELS[options.level || 'info'] || LOG_LEVELS.info;
    this.useConsole = options.useConsole !== false;
    this.useFile = options.useFile !== false;
    this.logPath = options.logPath || path.join(__dirname, '../../logs');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB

    // Ensure logs directory exists
    if (this.useFile && !fs.existsSync(this.logPath)) {
      fs.mkdirSync(this.logPath, { recursive: true });
    }
  }

  /**
   * Format log message
   * @private
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  /**
   * Log message
   * @private
   */
  log(level, message, meta = {}) {
    const levelValue = LOG_LEVELS[level] || LOG_LEVELS.info;

    if (levelValue < this.level) {
      return;
    }

    const formatted = this.formatMessage(level, message, meta);

    // Console output
    if (this.useConsole) {
      const colors = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m', // Red
        reset: '\x1b[0m',
      };

      const color = colors[level] || colors.reset;
      console.log(`${color}${formatted}${colors.reset}`);
    }

    // File output
    if (this.useFile) {
      this.writeToFile(formatted, level);
    }
  }

  /**
   * Write to log file
   * @private
   */
  writeToFile(message, level) {
    try {
      const logFile = path.join(this.logPath, `algoengine-${level}.log`);
      const allFile = path.join(this.logPath, 'algoengine.log');

      // Check file size and rotate if necessary
      if (fs.existsSync(logFile) && fs.statSync(logFile).size > this.maxFileSize) {
        const timestamp = new Date().getTime();
        fs.renameSync(logFile, `${logFile}.${timestamp}`);
      }

      fs.appendFileSync(logFile, `${message}\n`);
      fs.appendFileSync(allFile, `${message}\n`);
    } catch (error) {
      console.error(`Failed to write log: ${error.message}`);
    }
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  /**
   * Get log level name
   */
  getLevel() {
    for (const [name, value] of Object.entries(LOG_LEVELS)) {
      if (value === this.level) {
        return name;
      }
    }
    return 'unknown';
  }

  /**
   * Set log level
   */
  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      this.level = LOG_LEVELS[level];
    }
  }
}

// Export singleton logger
export const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  useConsole: true,
  useFile: true,
  logPath: './logs',
});

export default Logger;
