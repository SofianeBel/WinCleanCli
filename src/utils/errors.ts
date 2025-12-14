/**
 * Error classification utilities for standardized error handling across scanners.
 */

export type ErrorCode =
  | 'PERMISSION_DENIED'
  | 'FILE_NOT_FOUND'
  | 'FILE_LOCKED'
  | 'PATH_TOO_LONG'
  | 'DISK_FULL'
  | 'TIMEOUT'
  | 'UNKNOWN';

export interface ScannerError {
  code: ErrorCode;
  message: string;
  path?: string;
  originalError?: Error;
}

/**
 * Classify a Node.js error into a standardized ScannerError.
 * @param error - The error to classify
 * @param path - Optional path associated with the error
 * @returns A standardized ScannerError
 */
export function classifyError(error: unknown, path?: string): ScannerError {
  if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException;
    const code = nodeError.code;

    switch (code) {
      case 'EACCES':
      case 'EPERM':
        return {
          code: 'PERMISSION_DENIED',
          message: 'Access denied',
          path,
          originalError: error,
        };
      case 'ENOENT':
        return {
          code: 'FILE_NOT_FOUND',
          message: 'File or directory not found',
          path,
          originalError: error,
        };
      case 'EBUSY':
      case 'ENOTEMPTY':
        return {
          code: 'FILE_LOCKED',
          message: 'File or directory is in use',
          path,
          originalError: error,
        };
      case 'ENAMETOOLONG':
        return {
          code: 'PATH_TOO_LONG',
          message: 'Path exceeds maximum length',
          path,
          originalError: error,
        };
      case 'ENOSPC':
        return {
          code: 'DISK_FULL',
          message: 'No space left on device',
          path,
          originalError: error,
        };
      case 'ETIMEDOUT':
        return {
          code: 'TIMEOUT',
          message: 'Operation timed out',
          path,
          originalError: error,
        };
      default:
        return {
          code: 'UNKNOWN',
          message: error.message,
          path,
          originalError: error,
        };
    }
  }

  return {
    code: 'UNKNOWN',
    message: String(error),
    path,
  };
}

/**
 * Get a user-friendly message for an error code with suggested action.
 * @param error - The scanner error
 * @returns A user-friendly error message with suggestion
 */
export function getErrorSuggestion(error: ScannerError): string {
  switch (error.code) {
    case 'PERMISSION_DENIED':
      return `${error.path ?? 'File'} - Access denied. Try running as administrator.`;
    case 'FILE_NOT_FOUND':
      return `${error.path ?? 'File'} - Not found. It may have been moved or deleted.`;
    case 'FILE_LOCKED':
      return `${error.path ?? 'File'} - In use. Close related applications and try again.`;
    case 'PATH_TOO_LONG':
      return `${error.path ?? 'File'} - Path too long. Try moving to a shorter path.`;
    case 'DISK_FULL':
      return `${error.path ?? 'File'} - Disk full. Free up space and try again.`;
    case 'TIMEOUT':
      return `${error.path ?? 'Operation'} - Timed out. Try again or check system resources.`;
    default:
      return `${error.path ?? 'Operation'} - ${error.message}`;
  }
}

/**
 * Check if an error is recoverable (can be retried).
 * @param error - The scanner error
 * @returns true if the error might be resolved by retrying
 */
export function isRecoverableError(error: ScannerError): boolean {
  return error.code === 'FILE_LOCKED' || error.code === 'TIMEOUT';
}
