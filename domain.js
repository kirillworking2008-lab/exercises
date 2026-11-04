export const STORAGE_KEY = 'povtor.data.v1';
export const TIMER_KEY = 'povtor.timer.v1';
export const MAX_ENTRIES = 25000;
export const EXERCISES = Object.freeze([
  { id: 'pullups', name: 'Подтягивания', short: 'Турник', muscle: 'Спина · бицепс', icon: 'pullups', defaultReps: 5 },
  { id: 'pushups', name: 'Отжимания', short: 'Отжимания', muscle: 'Грудь · трицепс', icon: 'pushups', defaultReps: 15 },
  { id: 'abs', name: 'Пресс', short: 'Пресс', muscle: 'Мышцы кора', icon: 'abs', defaultReps: 20 },
]);
export const DEFAULT_SETTINGS = Object.freeze({ goal: 100, theme: 'mint', restSeconds: 60, autoRest: true });
export const exerciseById = (id) => EXERCISES.find((exercise) => exercise.id === id);
export const sumReps = (entries) => entries.reduce((sum, entry) => sum + entry.reps, 0);

export function emptyState() {
  return { version: 1, entries: [], settings: { ...DEFAULT_SETTINGS } };
}

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dayFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function validDate(value, now = new Date()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = dayFromKey(value);
  return Number.isFinite(parsed.getTime()) && dateKey(parsed) === value && value >= '2000-01-01' && value <= dateKey(now);
}

export function validateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Некорректные настройки.');
  if (!Number.isInteger(input.goal) || input.goal < 1 || input.goal > 9999) throw new Error('Дневная цель — целое число от 1 до 9999.');
  if (!['mint', 'violet', 'amber'].includes(input.theme)) throw new Error('Неизвестная цветовая тема.');
  if (![30, 60, 90, 120].includes(input.restSeconds)) throw new Error('Выбери длительность отдыха: 30, 60, 90 или 120 секунд.');
  if (typeof input.autoRest !== 'boolean') throw new Error('Некорректная настройка таймера.');
  return { goal: input.goal, theme: input.theme, restSeconds: input.restSeconds, autoRest: input.autoRest };
}

export function validateEntry(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Некорректная запись подхода.');
  if (typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.id)) throw new Error('Некорректный идентификатор подхода.');
  if (!exerciseById(input.exerciseId)) throw new Error('Неизвестное упражнение.');
  if (!Number.isInteger(input.reps) || input.reps < 1 || input.reps > 9999) throw new Error('Количество повторений — целое число от 1 до 9999.');
  if (!validDate(input.date, now)) throw new Error('Укажи существующую дату с 2000 года, не позже сегодняшней.');
  if (typeof input.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new Error('Укажи корректное время.');
  if (typeof input.note !== 'string' || input.note.length > 240) throw new Error('Заметка должна быть не длиннее 240 символов.');
  if (typeof input.createdAt !== 'string' || !Number.isFinite(Date.parse(input.createdAt))) throw new Error('Некорректная дата создания записи.');
  return {
    id: input.id, exerciseId: input.exerciseId, reps: input.reps,
    date: input.date, time: input.time, note: input.note.trim(), createdAt: input.createdAt,
  };
}

export function validateState(input, now = new Date()) {
  if (!input || input.version !== 1 || !Array.isArray(input.entries)) throw new Error('Это не резервная копия «Повтор» версии 1.');
  if (input.entries.length > MAX_ENTRIES) throw new Error(`В дневнике может быть не больше ${MAX_ENTRIES} подходов.`);
  const entries = input.entries.map((entry) => validateEntry(entry, now));
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error('В копии есть повторяющиеся идентификаторы.');
  return { version: 1, entries, settings: validateSettings(input.settings) };
}

export function loadState(storage, now = new Date()) {
  const raw = storage.getItem(STORAGE_KEY);
  return raw === null ? emptyState() : validateState(JSON.parse(raw), now);
}

export function saveState(storage, state, now = new Date()) {
  const clean = validateState(state, now);
  storage.setItem(STORAGE_KEY, JSON.stringify(clean));
  return clean;
}

export function mergeEntries(current, incoming) {
  const known = new Set(current.map((entry) => entry.id));
  const additions = incoming.filter((entry) => !known.has(entry.id));
  if (current.length + additions.length > MAX_ENTRIES) throw new Error(`Слишком много записей. Лимит — ${MAX_ENTRIES}.`);
  return [...current, ...additions];
}

export function sortEntries(entries) {
  return [...entries].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function getStreak(entries, now = new Date()) {
  const days = new Set(entries.map((entry) => entry.date));
  let cursor = new Date(now);
  if (!days.has(dateKey(cursor))) cursor = addDays(cursor, -1);
  let count = 0;
  while (days.has(dateKey(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function getPeriodRange(period, now = new Date(), previous = false) {
  if (period === 'all') return { start: '2000-01-01', end: dateKey(now) };
  const days = period === 'month' ? 30 : 7;
  const end = addDays(now, previous ? -days : 0);
  return { start: dateKey(addDays(end, -(days - 1))), end: dateKey(end) };
}

export function entriesInRange(entries, range) {
  return entries.filter((entry) => entry.date >= range.start && entry.date <= range.end);
}

export function daySeries(entries, days = 7, now = new Date()) {
  const totals = new Map();
  for (const entry of entries) totals.set(entry.date, (totals.get(entry.date) || 0) + entry.reps);
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(now, index - days + 1);
    const key = dateKey(date);
    return { key, date, total: totals.get(key) || 0 };
  });
}

export function monthSeries(entries, now = new Date()) {
  const totals = new Map();
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    totals.set(month, (totals.get(month) || 0) + entry.reps);
  }
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index - 11, 1, 12);
    const key = dateKey(date).slice(0, 7);
    return { key, date, total: totals.get(key) || 0 };
  });
}

export function bestSet(entries, exerciseId) {
  return sortEntries(entries.filter((entry) => entry.exerciseId === exerciseId)).reduce((best, entry) => !best || entry.reps > best.reps ? entry : best, null);
}

export function plural(number, forms) {
  const abs = Math.abs(number) % 100;
  if (abs >= 11 && abs <= 19) return forms[2];
  const digit = abs % 10;
  return digit === 1 ? forms[0] : digit >= 2 && digit <= 4 ? forms[1] : forms[2];
}

export function timerRemaining(timer, now = Date.now()) {
  if (!timer) return 0;
  return timer.paused ? Math.max(0, timer.remaining) : Math.max(0, Math.ceil((timer.endAt - now) / 1000));
}

export function formatTimer(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
