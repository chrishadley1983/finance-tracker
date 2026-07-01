import { describe, it, expect } from 'vitest';
import { normaliseDescription, merchantKey, isMineablePattern } from '@/lib/categorisation/normalise';

// Real descriptors from the June 2026 TrueLayer import.
describe('normaliseDescription', () => {
  it('strips INT\'L wrapper and keeps the merchant', () => {
    expect(normaliseDescription("INT'L 0088890845 ANTHROPIC* CLAUDE ANTHROPIC.COM")).toBe(
      'anthropic claude anthropic com'
    );
  });

  it('strips FX-rate suffix and contactless marker', () => {
    expect(normaliseDescription('OK Hoezaar ZEGGE EUR 3.55 @ 1.1525 Visa Rate )))')).toBe(
      'ok hoezaar zegge'
    );
  });

  it('strips stacked INT\'L + FX noise', () => {
    expect(
      normaliseDescription("INT'L 0002211029 Pandreitje 1806 Br Brugge EUR 5.30 @ 1.1521 Visa Rate )))")
    ).toBe('pandreitje 1806 br brugge');
  });

  it('strips Zettle prefix', () => {
    expect(normaliseDescription('ZETTLE_*CABLE 8 LTLONDON')).toBe('cable 8 ltlondon');
    expect(normaliseDescription('Zettle_*GamekeeperLondon')).toBe('gamekeeperlondon');
  });

  it('strips SumUp / SQ / TST / SP prefixes', () => {
    expect(normaliseDescription('SumUp *Mochafellatonbridge')).toBe('mochafellatonbridge');
    expect(normaliseDescription('SQ *HAVET RESTAURASevenoaks')).toBe('havet restaurasevenoaks');
    expect(normaliseDescription('TST-The Vineyard -Lamberhurst')).toBe('the vineyard lamberhurst');
    expect(normaliseDescription('SP KAREN ALEXANDRATONBRIDGE')).toBe('karen alexandratonbridge');
  });

  it('drops Amazon order references', () => {
    expect(normaliseDescription('AMAZON* NQ70H8U14 - Markers')).toBe('amazon markers');
    expect(normaliseDescription('AMAZON UK* NL19K3JLONDON')).toBe('amazon uk');
  });

  it('strips payment-type suffixes', () => {
    expect(normaliseDescription('TALKMOBILE DD')).toBe('talkmobile');
    expect(normaliseDescription('Hadley Bricks CR')).toBe('hadley bricks');
    expect(normaliseDescription('SAINSBURYS.CO.UK 0800 328 1700 VIS')).toBe('sainsburys co uk');
  });

  it('drops card fragments and long numeric refs', () => {
    expect(normaliseDescription('HSBC PREMIER543458 543458******8906 BP')).toBe('hsbc premier');
    expect(normaliseDescription('EM FORSTER THEATRE01732304241')).toBe('em forster theatre');
  });

  it('leaves plain merchants intact', () => {
    expect(normaliseDescription('ALDI TONBRIDGE')).toBe('aldi tonbridge');
    expect(normaliseDescription('PAYMENT - THANK YOU')).toBe('payment thank you');
  });

  it('strips PayPal prefix', () => {
    expect(normaliseDescription('PAYPAL *NETFLIX 35314369001 VIS')).toBe('netflix');
    expect(normaliseDescription('PAYPAL *DISNEYPLUS35314369001')).toBe('disneyplus');
  });
});

describe('merchantKey', () => {
  it('caps at three tokens', () => {
    expect(merchantKey('WELCOME B/WAITROSEWARWICK')).toBe('welcome b waitrosewarwick');
    expect(merchantKey('CO-OP GROUP 520016 HIGHAM LANE )))')).toBe('co op group');
  });

  it('groups repeat merchants to the same key', () => {
    const a = merchantKey('HILDEN SF CONNECT TONBRIDGE KEN )))');
    const b = merchantKey('HILDEN SF CONNECT TONBRIDGE KEN');
    expect(a).toBe(b);
    expect(a).toBe('hilden sf connect');
  });

  it('returns empty string for pure-noise descriptors', () => {
    expect(merchantKey('543458******8906')).toBe('');
  });
});

describe('isMineablePattern', () => {
  it('accepts specific keys', () => {
    expect(isMineablePattern('aldi tonbridge')).toBe(true);
    expect(isMineablePattern('pret a manger')).toBe(true);
  });

  it('rejects short or numeric keys', () => {
    expect(isMineablePattern('ok')).toBe(false);
    expect(isMineablePattern('12345')).toBe(false);
    expect(isMineablePattern('')).toBe(false);
  });
});
