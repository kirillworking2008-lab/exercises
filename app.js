import {
  EXERCISES, STORAGE_KEY, TIMER_KEY, MAX_ENTRIES, emptyState, loadState, saveState,
  validateState, validateEntry, validateSettings, exerciseById, dateKey, validDate,
  sortEntries, sumReps, mergeEntries, timerRemaining, formatTimer,
} from './domain.js';
import {
  todayView, historyView, progressView, entrySheet, settingsSheet, timerSheet,
  restDock, deleteSheet, resetSheet, importSheet, esc, number,
} from './views.js';
import { exportFile, initializeNative, isNative } from './platform.js';

const app = document.querySelector('#app');
const main = document.querySelector('#main');
const sheet = document.querySelector('#sheet');
const sheetContent = document.querySelector('#sheet-content');
const dock = document.querySelector('#rest-dock');
const toast = document.querySelector('#toast');
const importInput = document.querySelector('#import-file');
let state;
let storageFault = false;
try {
  state = loadState(window.localStorage);
} catch {
  state = emptyState();
  storageFault = true;
}
let modalKind = '';
let sheetTrigger = null;
let draft = null;
let settingsDraft = null;
let pendingImport = null;
let undoEntry = null;
let historyFilter = 'all';
let historyDate = '';
let showDateFilter = false;
let historyLimit = 100;
let progressPeriod = 'week';
let timerDuration = state.settings.restSeconds;
let timer = null;
let toastTimeout;
let installPrompt = null;
let currentDay = dateKey();
let lastTimerValue = -1;

try {
  const raw = localStorage.getItem(TIMER_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed && Number.isFinite(parsed.endAt) && Number.isInteger(parsed.duration) && parsed.duration > 0 && parsed.duration <= 3600 && Number.isInteger(parsed.remaining) && parsed.remaining >= 0 && parsed.remaining <= 3600 && typeof parsed.paused === 'boolean' && exerciseById(parsed.exerciseId)) {
      // A finished timer from a previous visit need not interrupt a new session.
      if (timerRemaining(parsed) > 0) timer = parsed;
      else localStorage.removeItem(TIMER_KEY);
    } else localStorage.removeItem(TIMER_KEY);
  }
} catch { /* An unavailable timer does not affect saved approaches. */ }

function route() {
  const hash = location.hash.slice(1);
  return ['today', 'history', 'progress'].includes(hash) ? hash : 'today';
}

function applyTheme() {
  app.dataset.theme = modalKind === 'settings' && settingsDraft ? settingsDraft.theme : state.settings.theme;
}

function render() {
  const screen = route();
  const now = new Date();
  currentDay = dateKey(now);
  applyTheme();
  main.innerHTML = screen === 'history'
    ? historyView(state, historyFilter, historyDate, now, showDateFilter, historyLimit)
    : screen === 'progress' ? progressView(state, progressPeriod, now) : todayView(state, now);
  document.querySelectorAll('[data-screen]').forEach((link) => {
    if (link.dataset.screen === screen) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = `${screen === 'history' ? 'История' : screen === 'progress' ? 'Прогресс' : 'Сегодня'} · Повтор`;
  const warning = document.querySelector('#storage-warning');
  warning.hidden = !storageFault;
  warning.textContent = storageFault ? 'Не удалось прочитать сохранения. Старые данные не перезаписаны. Открой настройки, чтобы выгрузить исходный файл, импортировать резервную копию или очистить дневник.' : '';
  renderDock();
}

function showToast(message, options = {}) {
  clearTimeout(toastTimeout);
  (sheet.open ? sheet : app).append(toast);
  toast.innerHTML = `${esc(message)}${options.action ? `<button class="toast-action" type="button" data-action="${esc(options.action)}">${esc(options.label)}</button>` : ''}`;
  toast.inert = false;
  toast.classList.add('is-visible');
  toast.style.pointerEvents = options.action ? 'auto' : 'none';
  toastTimeout = setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.style.pointerEvents = 'none';
    toast.inert = true;
  }, options.duration || (options.action ? 8000 : 3800));
}

function showError(message) {
  const error = sheetContent.querySelector('#form-error');
  if (error) {
    error.textContent = message;
    error.hidden = false;
    error.tabIndex = -1;
    error.focus();
  } else showToast(message, { duration: 6500 });
}

function commit(next, { force = false } = {}) {
  if (storageFault && !force) {
    showError('Сначала восстанови резервную копию или явно очисти повреждённый дневник в настройках. Исходные данные пока не изменены.');
    return false;
  }
  try {
    if (!force) {
      const latest = loadState(window.localStorage);
      if (JSON.stringify(latest) !== JSON.stringify(state)) {
        state = latest;
        render();
        showError('Дневник изменился в другой вкладке. Данные обновлены. Проверь результат и повтори сохранение — введённый текст не потерян.');
        return false;
      }
    }
    state = saveState(window.localStorage, next);
    storageFault = false;
    render();
    return true;
  } catch (error) {
    const storageError = ['QuotaExceededError', 'SecurityError'].includes(error.name);
    showError(storageError ? 'Не удалось сохранить на устройство. Освободи память или разреши хранение данных. Эта операция не записана.' : error.message || 'Не удалось сохранить данные.');
    return false;
  }
}

function openSheet(kind, html, focus = true) {
  if (!sheet.open) sheetTrigger = document.activeElement;
  modalKind = kind;
  sheetContent.innerHTML = html;
  sheet.classList.add('is-open');
  if (!sheet.open) sheet.showModal();
  document.body.classList.add('modal-open');
  applyTheme();
  if (focus) sheetContent.querySelector('#sheet-title')?.focus({ preventScroll: true });
}

function closeSheet() {
  if (sheet.open) sheet.close();
  modalKind = '';
  settingsDraft = null;
  sheet.classList.remove('is-open');
  document.body.classList.remove('modal-open');
  app.append(toast);
  applyTheme();
}

sheet.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const focusable = [...sheet.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')]
    .filter((element) => element.getClientRects().length && !element.closest('[hidden], [inert]'));
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first) { event.preventDefault(); return; }
  if (event.shiftKey && (document.activeElement === first || document.activeElement.id === 'sheet-title')) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first.focus();
  }
});
sheet.addEventListener('cancel', (event) => { event.preventDefault(); closeSheet(); });
sheet.addEventListener('close', () => {
  // Ignore a queued close event if the next sheet is already open.
  if (sheet.open) return;
  modalKind = '';
  settingsDraft = null;
  sheet.classList.remove('is-open');
  document.body.classList.remove('modal-open');
  app.append(toast);
  applyTheme();
  if (sheetTrigger?.isConnected) sheetTrigger.focus({ preventScroll: true });
});
sheet.addEventListener('click', (event) => {
  if (event.target !== sheet) return;
  const rect = sheet.getBoundingClientRect();
  if (event.clientY < rect.top || event.clientY > rect.bottom || event.clientX < rect.left || event.clientX > rect.right) closeSheet();
});

function newDraft(exerciseId) {
  const last = sortEntries(state.entries).find((entry) => !exerciseId || entry.exerciseId === exerciseId);
  const exercise = exerciseById(exerciseId || last?.exerciseId) || EXERCISES[0];
  const now = new Date();
  return {
    exerciseId: exercise.id, reps: last?.exerciseId === exercise.id ? last.reps : exercise.defaultReps,
    date: dateKey(now), time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, note: '',
  };
}

function openEntry(exerciseId, id) {
  const entry = id ? state.entries.find((item) => item.id === id) : null;
  if (id && !entry) return showToast('Этой записи больше нет.');
  draft = entry ? { ...entry } : newDraft(exerciseId);
  openSheet('entry', entrySheet(draft, state));
}

function readEntryDraft() {
  const form = sheetContent.querySelector('#entry-form');
  if (!form) return draft;
  const data = new FormData(form);
  draft = { ...draft, reps: data.get('reps'), date: data.get('date'), time: data.get('time'), note: data.get('note') };
  return draft;
}

function updateReps(value) {
  const input = sheetContent.querySelector('#reps');
  if (!input) return;
  input.value = String(Math.max(1, Math.min(9999, Math.round(value))));
  draft.reps = Number(input.value);
  sheetContent.querySelectorAll('[data-action="quick-reps"]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.reps) === draft.reps)));
}

function readSettingsDraft() {
  const form = sheetContent.querySelector('#settings-form');
  if (!form) return settingsDraft;
  settingsDraft = { ...settingsDraft, goal: Number(form.elements.goal.value), autoRest: form.elements.autoRest.checked };
  return settingsDraft;
}

function openSettings() {
  settingsDraft = { ...state.settings };
  openSheet('settings', settingsSheet(settingsDraft, state.entries.length, isNative()));
}

function persistTimer() {
  try {
    if (timer) localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
    else localStorage.removeItem(TIMER_KEY);
  } catch { /* Countdown still works during this visit if its optional persistence is blocked. */ }
}

function renderDock() {
  dock.hidden = !timer;
  app.classList.toggle('has-timer', !!timer);
  if (timer) dock.innerHTML = restDock(timer);
}

function updateTimerView() {
  renderDock();
  if (modalKind === 'timer' && sheet.open) openSheet('timer', timerSheet(timer, timerDuration), false);
  lastTimerValue = -1;
}

function startTimer(seconds = state.settings.restSeconds, exerciseId = 'pullups') {
  timer = { duration: seconds, remaining: seconds, endAt: Date.now() + seconds * 1000, paused: false, finished: false, exerciseId };
  persistTimer();
  updateTimerView();
}

function stopTimer() {
  timer = null;
  persistTimer();
  renderDock();
  if (modalKind === 'timer') closeSheet();
}

function tickTimer() {
  if (!timer || timer.paused) return;
  const remaining = timerRemaining(timer);
  if (remaining !== lastTimerValue) {
    document.querySelectorAll('[data-timer-display]').forEach((element) => { element.textContent = formatTimer(remaining); });
    const circle = modalKind === 'timer' ? sheetContent.querySelector('.ring-fill') : null;
    if (circle) circle.setAttribute('stroke-dashoffset', String(2 * Math.PI * 42 * (1 - Math.min(1, remaining / timer.duration))));
    lastTimerValue = remaining;
  }
  if (remaining === 0 && !timer.finished) {
    timer.finished = true;
    persistTimer();
    updateTimerView();
    showToast('Отдых завершён. Можно продолжать!');
    if (document.visibilityState === 'visible' && navigator.vibrate) navigator.vibrate([80, 60, 80]);
  }
}

async function exportBackup() {
  let content;
  if (storageFault) {
    content = localStorage.getItem(STORAGE_KEY);
    if (!content) throw new Error('Исходный файл недоступен. Проверь разрешение на хранение данных.');
  } else content = JSON.stringify({ ...state, app: 'povtor', exportedAt: new Date().toISOString() }, null, 2);
  await exportFile(`povtor-${storageFault ? 'recovery-' : ''}${dateKey()}.json`, content);
  showToast(storageFault ? 'Исходный файл выгружен без изменений.' : isNative() ? 'Выбери, где сохранить резервную копию.' : 'Резервная копия скачана. Сохрани её в надёжном месте.');
}

async function install() {
  if (installPrompt) {
    await installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    return;
  }
  if (matchMedia('(display-mode: standalone)').matches) return showToast('Приложение уже установлено.');
  openSheet('install', '<div class="sheet-heading"><h2 id="sheet-title" tabindex="-1">Всегда под рукой.</h2><p>Установи дневник на главный экран.</p></div><div class="card confirm-copy">В Chrome на Android открой меню <strong>⋮</strong> и выбери <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong>.<br><br>Если дневник открыт во встроенном предпросмотре, сначала открой его в отдельной вкладке Chrome.<br><br>На iPhone: Safari → «Поделиться» → «На экран Домой».</div>');
}

const actions = {
  'add-entry': (button) => openEntry(button.dataset.exercise),
  'edit-entry': (button) => openEntry(null, button.dataset.id),
  settings: openSettings,
  'close-sheet': closeSheet,
  'choose-exercise': (button) => {
    readEntryDraft();
    if (draft.exerciseId === button.dataset.exercise) return;
    const exercise = exerciseById(button.dataset.exercise);
    const last = sortEntries(state.entries).find((entry) => entry.exerciseId === exercise.id);
    draft = { ...draft, exerciseId: exercise.id, reps: last?.reps || exercise.defaultReps };
    openSheet('entry', entrySheet(draft, state), false);
    sheetContent.querySelector(`[data-exercise="${exercise.id}"]`)?.focus({ preventScroll: true });
  },
  'step-reps': (button) => updateReps((Number(sheetContent.querySelector('#reps')?.value) || 0) + Number(button.dataset.step)),
  'quick-reps': (button) => updateReps(Number(button.dataset.reps)),
  'history-filter': (button) => {
    historyFilter = button.dataset.exercise;
    historyLimit = 100;
    render();
    main.querySelector(`[data-action="history-filter"][data-exercise="${historyFilter}"]`)?.focus({ preventScroll: true });
  },
  'date-filter': () => {
    showDateFilter = !showDateFilter;
    render();
    if (showDateFilter) main.querySelector('#history-date')?.focus({ preventScroll: true });
  },
  'clear-date': () => { historyDate = ''; showDateFilter = false; render(); },
  'clear-filters': () => { historyFilter = 'all'; historyDate = ''; showDateFilter = false; historyLimit = 100; render(); },
  'load-more': () => { historyLimit += 100; const y = scrollY; render(); scrollTo(0, y); },
  'day-detail': (button) => {
    historyDate = button.dataset.date;
    showDateFilter = true;
    historyFilter = 'all';
    historyLimit = 100;
    if (route() !== 'history') location.hash = 'history';
    else render();
  },
  'month-detail': (button) => {
    const month = new Date(`${button.dataset.date}-01T12:00:00`).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    showToast(`${month}: ${number(Number(button.dataset.total))} повторений.`);
  },
  period: (button) => {
    progressPeriod = button.dataset.period;
    const y = scrollY;
    render();
    scrollTo(0, y);
    main.querySelector(`[data-period="${progressPeriod}"]`)?.focus({ preventScroll: true });
  },
  theme: (button) => {
    readSettingsDraft();
    settingsDraft.theme = button.dataset.themeOption;
    applyTheme();
    sheetContent.querySelectorAll('[data-action="theme"]').forEach((item) => item.setAttribute('aria-pressed', String(item.dataset.themeOption === settingsDraft.theme)));
  },
  'rest-duration': (button) => {
    readSettingsDraft();
    settingsDraft.restSeconds = Number(button.dataset.seconds);
    sheetContent.querySelectorAll('[data-action="rest-duration"]').forEach((item) => item.setAttribute('aria-pressed', String(Number(item.dataset.seconds) === settingsDraft.restSeconds)));
  },
  'timer-open': () => {
    timerDuration = state.settings.restSeconds;
    openSheet('timer', timerSheet(timer, timerDuration));
  },
  'timer-duration': (button) => {
    timerDuration = Number(button.dataset.seconds);
    openSheet('timer', timerSheet(timer, timerDuration), false);
    sheetContent.querySelector(`[data-seconds="${timerDuration}"]`)?.focus({ preventScroll: true });
  },
  'timer-start': () => startTimer(timerDuration, sortEntries(state.entries)[0]?.exerciseId || 'pullups'),
  'timer-toggle': () => {
    if (!timer) return;
    const remaining = timerRemaining(timer);
    if (!remaining) return startTimer(timer.duration, timer.exerciseId);
    if (timer.paused) timer = { ...timer, paused: false, endAt: Date.now() + timer.remaining * 1000 };
    else timer = { ...timer, paused: true, remaining };
    persistTimer();
    updateTimerView();
  },
  'timer-extend': () => {
    if (!timer) return;
    const remaining = Math.min(3600, timerRemaining(timer) + 30);
    timer = { ...timer, duration: Math.max(timer.duration, remaining), remaining, endAt: Date.now() + remaining * 1000, finished: false };
    persistTimer();
    updateTimerView();
  },
  'timer-stop': stopTimer,
  'next-set': () => {
    const exercise = timer?.exerciseId;
    stopTimer();
    openEntry(exercise);
  },
  'delete-confirm': (button) => {
    readEntryDraft();
    const entry = state.entries.find((item) => item.id === button.dataset.id);
    if (entry) openSheet('delete', deleteSheet(entry));
  },
  'cancel-delete': () => openSheet('entry', entrySheet(draft, state)),
  'delete-entry': (button) => {
    const entry = state.entries.find((item) => item.id === button.dataset.id);
    if (!entry || !commit({ ...state, entries: state.entries.filter((item) => item.id !== entry.id) })) return;
    undoEntry = entry;
    closeSheet();
    showToast('Подход удалён.', { action: 'undo-delete', label: 'Вернуть' });
  },
  'undo-delete': () => {
    if (!undoEntry) return;
    if (state.entries.some((entry) => entry.id === undoEntry.id)) return;
    if (commit({ ...state, entries: [...state.entries, undoEntry] })) {
      undoEntry = null;
      showToast('Подход восстановлен.');
    }
  },
  export: exportBackup,
  import: () => { importInput.value = ''; importInput.click(); },
  'confirm-import': () => {
    if (!pendingImport) return;
    const next = storageFault ? pendingImport : { ...state, entries: mergeEntries(state.entries, pendingImport.entries) };
    const added = next.entries.length - state.entries.length;
    if (!commit(next, { force: storageFault })) return;
    pendingImport = null;
    closeSheet();
    showToast(added ? `Импорт завершён. Добавлено подходов: ${added}.` : 'Все записи из копии уже есть в дневнике.');
  },
  'reset-confirm': () => openSheet('reset', resetSheet()),
  install,
};

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || !actions[button.dataset.action]) return;
  event.preventDefault();
  try { await actions[button.dataset.action](button); }
  catch (error) { showError(error.message || 'Не удалось выполнить действие. Попробуй ещё раз.'); }
});

document.addEventListener('input', (event) => {
  if (event.target.id !== 'reps') return;
  sheetContent.querySelectorAll('[data-action="quick-reps"]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.reps) === Number(event.target.value))));
});

document.addEventListener('change', (event) => {
  if (event.target.id !== 'history-date') return;
  historyDate = validDate(event.target.value) ? event.target.value : '';
  historyLimit = 100;
  render();
});

document.addEventListener('submit', (event) => {
  const form = event.target;
  event.preventDefault();
  try {
    if (form.id === 'entry-form') {
      readEntryDraft();
      const editing = !!draft.id;
      if (editing && !state.entries.some((entry) => entry.id === draft.id)) throw new Error('Эта запись уже удалена в другой вкладке. Закрой окно или запиши новый подход.');
      if (!editing && state.entries.length >= MAX_ENTRIES) throw new Error(`Достигнут лимит ${MAX_ENTRIES} подходов. Сохрани резервную копию и удали ненужные записи.`);
      const entry = validateEntry({ ...draft, reps: Number(draft.reps), id: draft.id || crypto.randomUUID(), createdAt: draft.createdAt || new Date().toISOString() });
      const entries = editing ? state.entries.map((item) => item.id === entry.id ? entry : item) : [...state.entries, entry];
      const wasUnderGoal = sumReps(state.entries.filter((item) => item.date === dateKey())) < state.settings.goal;
      if (!commit({ ...state, entries })) return;
      closeSheet();
      if (!editing && state.settings.autoRest && entry.date === dateKey()) startTimer(state.settings.restSeconds, entry.exerciseId);
      const goalReached = entry.date === dateKey() && wasUnderGoal && sumReps(state.entries.filter((item) => item.date === dateKey())) >= state.settings.goal;
      showToast(goalReached ? 'Дневная цель достигнута. Отличная работа!' : editing ? 'Подход обновлён.' : `${exerciseById(entry.exerciseId).name} · ${entry.reps} повторений. Сохранено!`);
    } else if (form.id === 'settings-form') {
      const settings = validateSettings(readSettingsDraft());
      if (!commit({ ...state, settings })) return;
      closeSheet();
      showToast('Настройки сохранены. Твой дневник — твои правила.');
    } else if (form.id === 'reset-form') {
      if (form.elements.confirmation.value !== 'УДАЛИТЬ') throw new Error('Для подтверждения введи УДАЛИТЬ без пробелов.');
      if (!commit(emptyState(), { force: true })) return;
      stopTimer();
      undoEntry = null;
      pendingImport = null;
      historyFilter = 'all'; historyDate = ''; showDateFilter = false; historyLimit = 100;
      closeSheet();
      location.hash = 'today';
      render();
      showToast('Дневник очищен. Впереди новая история.');
    }
  } catch (error) { showError(error.message); }
});

importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0];
  if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('Копия слишком большая. Выбери JSON-файл до 10 МБ.');
    let parsed;
    try { parsed = JSON.parse(await file.text()); }
    catch { throw new Error('Не удалось прочитать JSON. Выбери резервную копию, созданную в «Повтор».'); }
    pendingImport = validateState(parsed);
    const merged = mergeEntries(state.entries, pendingImport.entries);
    openSheet('import', importSheet(pendingImport, merged.length - state.entries.length, state.entries.length, storageFault));
  } catch (error) {
    pendingImport = null;
    showError(error.message);
  }
});

window.addEventListener('hashchange', () => {
  closeSheet();
  render();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
});
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY || sheet.open) return;
  try { state = loadState(localStorage); storageFault = false; render(); }
  catch { storageFault = true; render(); }
});
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event; });
window.addEventListener('appinstalled', () => { installPrompt = null; showToast('Повтор теперь на твоём главном экране.'); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (currentDay !== dateKey() && !sheet.open) render();
    tickTimer();
  }
});
setInterval(tickTimer, 500);
setInterval(() => { if (currentDay !== dateKey() && !sheet.open) render(); }, 30000);

initializeNative(() => {
  if (sheet.open) closeSheet();
  else if (route() !== 'today') location.hash = 'today';
  else return false;
  return true;
}).catch(() => { /* Browser UI and local saving remain available if a platform feature fails. */ });

if ('serviceWorker' in navigator && !isNative()) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {
    showToast('Офлайн-режим пока недоступен. Открой приложение в отдельной вкладке и загрузи ещё раз.', { duration: 6000 });
  }));
}
render();
