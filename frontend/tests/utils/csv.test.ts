import { describe, expect, it } from 'vitest';

import { toCsv } from '../../src/utils/csv';

/**
 * CSV escaping.
 *
 * Worth testing because the failure is silent and expensive: a member called
 * `Khan, Ali` or a note reading `paid 2,500 "cash"` does not throw — it shifts
 * every following column by one, and the gym reads the wrong number against
 * the wrong person in a spreadsheet nobody thinks to doubt.
 */

describe('toCsv', () => {
  it('writes a header and its rows', () => {
    const csv = toCsv(['Name', 'Amount'], [['Ali', 2500]]);

    // CRLF, because that is what Excel expects from a .csv.
    expect(csv).toBe('Name,Amount\r\nAli,2500');
  });

  it('quotes a field containing a comma', () => {
    const csv = toCsv(['Name'], [['Khan, Ali']]);

    // Unquoted, this one value would read as two columns.
    expect(csv).toBe('Name\r\n"Khan, Ali"');
  });

  it('doubles an inner quote, and quotes the field', () => {
    const csv = toCsv(['Notes'], [['paid "cash"']]);

    expect(csv).toBe('Notes\r\n"paid ""cash"""');
  });

  it('quotes a field containing a newline', () => {
    const csv = toCsv(['Address'], [['12 Mall Road\nLahore']]);

    // A bare newline inside a field would otherwise start a new record.
    expect(csv).toBe('Address\r\n"12 Mall Road\nLahore"');
  });

  it('writes null and undefined as empty, not as the words', () => {
    const csv = toCsv(['Phone', 'Email'], [[null, undefined]]);

    // `String(null)` is "null", which a gym would read as a phone number.
    expect(csv).toBe('Phone,Email\r\n,');
  });

  it('leaves a plain field alone', () => {
    const csv = toCsv(['Name'], [['Ali Khan']]);

    // Quoting everything would be valid CSV and unreadable in a text editor.
    expect(csv).toBe('Name\r\nAli Khan');
  });

  it('keeps a number a number', () => {
    const csv = toCsv(['Amount'], [[1234.56]]);

    expect(csv).toBe('Amount\r\n1234.56');
  });

  it('writes just the header when there are no rows', () => {
    expect(toCsv(['Name', 'Amount'], [])).toBe('Name,Amount');
  });

  it('escapes a header the same way it escapes a field', () => {
    const csv = toCsv(['Name, full'], [['Ali']]);

    expect(csv).toBe('"Name, full"\r\nAli');
  });

  it('handles a row where every field needs escaping', () => {
    const csv = toCsv(
      ['Name', 'Notes'],
      [['Khan, Ali', 'said "yes"\nthen left']],
    );

    expect(csv).toBe('Name,Notes\r\n"Khan, Ali","said ""yes""\nthen left"');
  });
});
