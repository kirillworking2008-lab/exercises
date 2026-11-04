import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY, MAX_ENTRIES, emptyState, dateKey, dayFromKey, addDays, validDate,
  validateEntry, validateSettings, validateState, loadState, saveState, mergeEntries,
  sortEntries, sumReps, getStreak, getPeriodRange, entriesInRange, daySeries, monthSeries,
  bestSet, plural, timerRemaining, formatTimer,
} from '../domain.js';
import { esc, todayView, historyView, progressView, entryRow } from '../views.js';

const now = new Date(2026, 10, 4, 12);
const entry = (overrides = {}) => ({ id: 'test_1', exerciseId: 'pullups', reps: 10, date: '2026-11-04', time: '12:00', note: '', createdAt: '2026-11-04T12:00:00.000Z', ...overrides });
const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test('local calendar keys, leap days and month boundaries', () => {
  assert.equal(dateKey(now), '2026-11-04');
  assert.equal(dateKey(dayFromKey('2026-11-04')), '2026-11-04');
  assert.equal(dateKey(addDays(new Date(2026, 10, 1, 12), -1)), '2026-10-31');
  assert.equal(validDate('2024-02-29', now), true);
  for (const bad of ['2026-02-29', '2026-11-31', '2026-11-05', '1999-12-31', '2026-1-1', '', null]) assert.equal(validDate(bad, now), false);
});

test('entries: bounded whole reps, known exercise, real local date and time', () => {
  assert.equal(validateEntry(entry({ note: '  Хорошо!  ' }), now).note, 'Хорошо!');
  for (const reps of [0, -1, 1.5, 10000, '10', Infinity, NaN]) assert.throws(() => validateEntry(entry({ reps }), now));
  for (const exerciseId of ['x', '', '__proto__']) assert.throws(() => validateEntry(entry({ exerciseId }), now));
  for (const time of ['24:00', '10:60', '4:00', '']) assert.throws(() => validateEntry(entry({ time }), now));
  assert.throws(() => validateEntry(entry({ id: '<script>' }), now));
  assert.throws(() => validateEntry(entry({ note: 'x'.repeat(241) }), now));
  assert.throws(() => validateEntry(entry({ createdAt: 'bad date' }), now));
});

test('settings are explicit and bounded', () => {
  assert.deepEqual(validateSettings(emptyState().settings), emptyState().settings);
  for (const goal of [0, -1, 10000, 2.3, '100']) assert.throws(() => validateSettings({ ...emptyState().settings, goal }));
  assert.throws(() => validateSettings({ ...emptyState().settings, theme: 'light' }));
  assert.throws(() => validateSettings({ ...emptyState().settings, autoRest: 'true' }));
  assert.throws(() => validateSettings({ ...emptyState().settings, restSeconds: 999 }));
});

test('backup schema rejects unsupported, duplicate, oversized and malformed data', () => {
  const data = { ...emptyState(), entries: [entry()] };
  assert.deepEqual(validateState(data, now), data);
  assert.throws(() => validateState({ ...data, version: 2 }, now));
  assert.throws(() => validateState({ ...data, entries: [entry(), entry()] }, now));
  assert.throws(() => validateState({ ...data, entries: Array(MAX_ENTRIES + 1).fill(null) }, now));
  assert.throws(() => validateState({ entries: [] }, now));
  assert.throws(() => validateState(null, now));
});

test('storage roundtrip and corruption never silently replace data', () => {
  const store = storage();
  assert.deepEqual(loadState(store, now), emptyState());
  const data = { ...emptyState(), entries: [entry()] };
  assert.deepEqual(saveState(store, data, now), data);
  assert.deepEqual(loadState(store, now), data);
  store.setItem(STORAGE_KEY, '{broken');
  assert.throws(() => loadState(store, now));
  assert.equal(store.getItem(STORAGE_KEY), '{broken');
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  assert.throws(() => saveState(full, data, now));
});

test('backup merge is idempotent and preserves existing records on conflicts', () => {
  const current = [entry()];
  const incoming = [entry({ reps: 99 }), entry({ id: 'new', reps: 20 })];
  const merged = mergeEntries(current, incoming);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].reps, 10);
  assert.deepEqual(mergeEntries(merged, incoming), merged);
  assert.equal(current.length, 1);
});

test('sorting newest first is stable and does not mutate original', () => {
  const entries = [entry({ id: 'a', date: '2026-11-03' }), entry({ id: 'b', time: '09:00' }), entry({ id: 'c', time: '13:00' })];
  assert.deepEqual(sortEntries(entries).map((item) => item.id), ['c', 'b', 'a']);
  assert.equal(entries[0].id, 'a');
});

test('streak counts days, not approaches, and allows training later today', () => {
  const entries = ['2026-11-04', '2026-11-04', '2026-11-03', '2026-11-02', '2026-10-31'].map((date, id) => entry({ id: `id_${id}`, date }));
  assert.equal(getStreak(entries, now), 3);
  assert.equal(getStreak(entries.filter((item) => item.date !== '2026-11-04'), now), 2);
  assert.equal(getStreak([entry({ date: '2026-11-02' })], now), 0);
  assert.equal(getStreak([], now), 0);
});

test('periods include today, cross month boundaries, and do not overlap comparisons', () => {
  assert.deepEqual(getPeriodRange('week', now), { start: '2026-10-29', end: '2026-11-04' });
  assert.deepEqual(getPeriodRange('week', now, true), { start: '2026-10-22', end: '2026-10-28' });
  assert.deepEqual(getPeriodRange('month', now), { start: '2026-10-06', end: '2026-11-04' });
  const entries = [entry(), entry({ id: 'old', date: '2026-10-28', reps: 20 })];
  assert.equal(sumReps(entriesInRange(entries, getPeriodRange('week', now))), 10);
  assert.equal(sumReps(entriesInRange(entries, getPeriodRange('all', now))), 30);
});

test('charts contain real zeroes, sum multiple sets and cover exact calendar days', () => {
  const entries = [entry(), entry({ id: 'b', reps: 20 }), entry({ id: 'c', date: '2026-10-30', reps: 5 })];
  const series = daySeries(entries, 7, now);
  assert.equal(series.length, 7);
  assert.equal(series[0].key, '2026-10-29');
  assert.equal(series[0].total, 0);
  assert.equal(series[1].total, 5);
  assert.equal(series[6].total, 30);
  const months = monthSeries(entries, now);
  assert.equal(months.length, 12);
  assert.equal(months[0].key, '2025-12');
  assert.equal(months[10].total, 5);
  assert.equal(months[11].total, 30);
});

test('records reflect the best single set, newest tie wins', () => {
  const entries = [entry({ id: 'old', date: '2026-11-03', reps: 20 }), entry({ id: 'new', reps: 20 }), entry({ id: 'other', exerciseId: 'abs', reps: 50 })];
  assert.equal(bestSet(entries, 'pullups').id, 'new');
  assert.equal(bestSet(entries, 'pushups'), null);
});

test('Russian pluralization covers 1/2/5/11/21/22/111', () => {
  const forms = ['подход', 'подхода', 'подходов'];
  assert.deepEqual([1, 2, 5, 11, 21, 22, 111].map((value) => plural(value, forms)), ['подход', 'подхода', 'подходов', 'подходов', 'подход', 'подхода', 'подходов']);
});

test('timers use wall time and do not drift or go negative while backgrounded', () => {
  assert.equal(timerRemaining({ paused: false, endAt: 61000 }, 1500), 60);
  assert.equal(timerRemaining({ paused: false, endAt: 61000 }, 100000), 0);
  assert.equal(timerRemaining({ paused: true, remaining: 45 }, 100000), 45);
  assert.equal(formatTimer(90), '01:30');
  assert.equal(formatTimer(-5), '00:00');
});

test('user notes are escaped in visible text and attributes', () => {
  const payload = '<img src=x onerror="alert(1)">';
  const html = entryRow(entry({ note: payload }));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
  assert.equal(esc('"\'&<>'), '&quot;&#39;&amp;&lt;&gt;');
});

test('empty views do not seed fake exercise data', () => {
  const state = emptyState();
  assert.ok(todayView(state, now).includes('data-testid="today-reps">0'));
  assert.ok(historyView(state, 'all', '', now).includes('Здесь начинается история'));
  assert.ok(progressView(state, 'week', now).includes('data-testid="progress-reps">0'));
  assert.equal(state.entries.length, 0);
});
