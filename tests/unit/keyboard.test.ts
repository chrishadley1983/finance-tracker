import { describe, it, expect } from 'vitest';
import { isTypingTarget } from '@/lib/keyboard';

const input = (type: string) => Object.assign(document.createElement('input'), { type });

describe('isTypingTarget', () => {
  it('treats text fields as typing', () => {
    expect(isTypingTarget(input('text'))).toBe(true);
    expect(isTypingTarget(input('search'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
  });
  it('lets shortcuts through from checkboxes, buttons and the page', () => {
    expect(isTypingTarget(input('checkbox'))).toBe(false);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
