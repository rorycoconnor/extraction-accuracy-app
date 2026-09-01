import { describe, test, expect } from 'vitest';
import { isAllowedBoxHost, rewriteBoxUrlToProxy } from '@/lib/box-proxy-hosts';

describe('isAllowedBoxHost', () => {
  test.each([
    'api.box.com',
    'boxcloud.com',
    'dl.boxcloud.com',
    'dl3.boxcloud.com',
    'cdn01.boxcdn.net',
    'app.box.com',
    'enterprise.app.box.com',
  ])('allows Box host %s', host => {
    expect(isAllowedBoxHost(host)).toBe(true);
  });

  // Lookalike domains an attacker can register. A pattern using `\.?` instead of
  // an anchored subdomain boundary would let these through.
  test.each([
    'evilboxcloud.com',
    'attacker-boxcloud.com',
    'notboxcdn.net',
    'myapp.box.com.evil.com',
    'boxcloud.com.evil.com',
    'box.com',
    'evil.com',
    'localhost',
    '127.0.0.1',
    '169.254.169.254',
    '',
  ])('blocks non-Box host %s', host => {
    expect(isAllowedBoxHost(host)).toBe(false);
  });

  test('is case insensitive', () => {
    expect(isAllowedBoxHost('DL.BoxCloud.CoM')).toBe(true);
  });
});

describe('rewriteBoxUrlToProxy', () => {
  test('rewrites an allow-listed Box URL through the proxy', () => {
    expect(rewriteBoxUrlToProxy('https://api.box.com/2.0/files/123?fields=name'))
      .toBe('/api/box-proxy/api.box.com/2.0/files/123?fields=name');
  });

  test('preserves path and query', () => {
    expect(rewriteBoxUrlToProxy('https://dl.boxcloud.com/api/2.0/files/1/content?v=2'))
      .toBe('/api/box-proxy/dl.boxcloud.com/api/2.0/files/1/content?v=2');
  });

  test('leaves lookalike hosts untouched', () => {
    const url = 'https://evilboxcloud.com/steal';
    expect(rewriteBoxUrlToProxy(url)).toBe(url);
  });

  test('leaves non-Box hosts untouched', () => {
    const url = 'https://example.com/thing';
    expect(rewriteBoxUrlToProxy(url)).toBe(url);
  });

  test('leaves unparseable input untouched', () => {
    expect(rewriteBoxUrlToProxy('not a url')).toBe('not a url');
  });

  test('leaves non-http schemes untouched', () => {
    const url = 'data:text/html;base64,PHNjcmlwdD4=';
    expect(rewriteBoxUrlToProxy(url)).toBe(url);
  });
});
