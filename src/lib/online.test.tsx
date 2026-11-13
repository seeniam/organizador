import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useOnline } from './online';

describe('useOnline', () => {
  it('acompanha os eventos online/offline', () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });
});
