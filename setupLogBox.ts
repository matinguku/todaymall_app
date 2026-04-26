/**
 * Runs before App — filters transient network/socket/cart noise from LogBox.
 * Import this first from index.ts.
 */
import { LogBox } from 'react-native';

LogBox.ignoreAllLogs(false);
LogBox.ignoreLogs([
  'SocketService',
  'socket.io',
  'Connection error',
  'Connection attempt',
  'xhr poll error',
  'Max retries reached',
  'App will use REST',
  'GET CART',
  '[cartApi.getCart]',
  'Network Error',
  '[Socket] Failed to connect',
  '[Socket][OrderInquiry]',
]);

function argsToText(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (a != null && typeof a === 'object') {
        try {
          return JSON.stringify(a);
        } catch {
          return '';
        }
      }
      return String(a ?? '');
    })
    .join(' ');
}

function isTransientConsoleNoise(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('socketservice') ||
    t.includes('xhr poll error') ||
    t.includes('poll error') ||
    t.includes('max retries reached') ||
    (t.includes('cooldown') && t.includes('rest')) ||
    t.includes('get cart') ||
    t.includes('[cartapi.getcart]') ||
    t.includes('network error') ||
    t.includes('[socket] failed to connect') ||
    t.includes('[socket][orderinquiry]') ||
    /connection error\s*\(\d+\s*\/\s*\d+\)/i.test(text) ||
    /connection attempt\s*\(\d+\s*\/\s*\d+\)/i.test(text)
  );
}

const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  if (isTransientConsoleNoise(argsToText(args))) {
    console.debug(...args);
    return;
  }
  originalConsoleError(...args);
};
