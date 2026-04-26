import axios from 'axios';

/**
 * Expected API failures (offline, DNS, TLS, timeout) should not use console.error
 * (React Native LogBox full-screen). Use this in catch / onError instead.
 */
export function logDevApiFailure(scope: string, error: unknown): void {
  if (!__DEV__) {
    return;
  }

  const transient =
    axios.isAxiosError(error) &&
    (!error.response ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.message === 'Network Error');

  const msg = axios.isAxiosError(error)
    ? `${error.message}${error.response ? ` (${error.response.status})` : ''}`
    : error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  if (transient) {
    console.debug(`[${scope}]`, msg || error);
  } else {
    console.warn(`[${scope}]`, msg || error);
  }
}
