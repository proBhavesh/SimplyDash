// This is a simple error logger. In a production environment, you might want to use a more robust logging solution.

class ErrorLogger {
  error(...args: any[]) {
    console.error(...args);
    // In a production environment, you might want to send this error to a logging service
  }

  warn(...args: any[]) {
    console.warn(...args);
  }

  info(...args: any[]) {
    console.info(...args);
  }

  debug(...args: any[]) {
    console.debug(...args);
  }
}

const errorLogger = new ErrorLogger();

export { errorLogger };