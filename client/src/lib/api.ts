export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export interface ApiErrorDetails {
  fieldErrors?: Record<string, string[]>;
}

export class ApiRequestError extends Error {
  readonly details?: ApiErrorDetails;

  constructor(message: string, details?: ApiErrorDetails) {
    super(message);
    this.name = 'ApiRequestError';
    this.details = details;
  }
}

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
