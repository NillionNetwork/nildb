/**
 * HTTP client function type for making requests.
 * Allows dependency injection for testing or custom fetch implementations.
 */
export type HttpClient = (url: string, init?: RequestInit) => Response | Promise<Response>;
