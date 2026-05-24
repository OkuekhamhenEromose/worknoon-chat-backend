/**
 * Winston Logger
 * Outputs logs to console (dev) and rotating file (production)
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
  return `${ts} [${level}]: ${stack || message}`;
});

const transports = [
  new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      logFormat
    ),
  }),
];

// Only write to files in non-test environments
if (process.env.NODE_ENV !== 'test') {
  const logDir = process.env.LOG_DIR || './logs';

  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      format: combine(timestamp(), errors({ stack: true }), winston.format.json()),
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: combine(timestamp(), winston.format.json()),
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: combine(timestamp(), errors({ stack: true })),
  transports,
  exceptionHandlers: transports,
  rejectionHandlers: transports,
});

module.exports = logger;
