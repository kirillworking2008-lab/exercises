import {
  EXERCISES, exerciseById, sumReps, dateKey, dayFromKey, daySeries, monthSeries,
  getStreak, getPeriodRange, entriesInRange, sortEntries, bestSet, plural, formatTimer, timerRemaining,
} from './domain.js';
import { icon } from './icons.js';

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const number = (value) => new Intl.NumberFormat('ru-RU').format(value);
const shortDate = (key) => dayFromKey(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
const dayLabel = (key, now) => {
  if (key === dateKey(now)) return 'Сегодня';
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (key === dateKey(yesterday)) return 'Вчера';
  return dayFromKey(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(dayFromKey(key).getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
};
const heading = (title, action = '', caption = '') => `<div class="section-heading"><h2>${title}</h2>${action || `<span class="section-kicker">${caption}</span>`}</div>`;
const sheetHeading = (title, subtitle) => `<div class="sheet-heading"><h2 id="sheet-title" tabindex="-1">${title}</h2><p>${subtitle}</p></div>`;
const formError = '<p class="form-error" id="form-error" role="alert" hidden></p>';
export const localNote = () => `<p class="local-note">${icon('shield')}Только на твоём устройстве. Без регистрации.</p>`;

export function ring(value, inside, size = 96) {
  const circumference = 2 * Math.PI * 42;
  const progress = Math.max(0, Math.min(100, value));
  return `<div class="progress-ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 96 96" fill="none" aria-hidden="true"><circle class="ring-track" cx="48" cy="48" r="42" stroke-width="3"/><circle class="ring-fill" cx="48" cy="48" r="42" stroke-width="3" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - progress / 100)}"/></svg><div class="ring-copy">${inside}</div></div>`;
}

function activityChart(series, now, mode = 'days') {
  const max = Math.max(1, ...series.map((item) => item.total));
  const dense = series.length > 14;
  return `<div class="${dense ? 'dense-chart' : ''}"><div class="day-bars" aria-label="Повторения по ${mode === 'months' ? 'месяцам' : 'дням'}">${series.map((item, index) => {
    const today = mode === 'days' && item.key === dateKey(now);
    const readable = item.date.toLocaleDateString('ru-RU', mode === 'months' ? { month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' });
    const label = mode === 'months' ? item.date.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '') : dense ? (index === 0 || index === series.length - 1 || index % 7 === 0 ? item.date.getDate() : '') : item.date.toLocaleDateString('ru-RU', { weekday: 'short' });
    return `<button type="button" class="day-column ${today ? 'is-today' : ''}" data-action="${mode === 'months' ? 'month-detail' : 'day-detail'}" data-date="${esc(item.key)}" data-total="${item.total}" aria-label="${esc(readable)}: ${number(item.total)} повторений" title="${esc(readable)} · ${number(item.total)} повторений"><span class="day-bar-track"><span class="day-bar-fill ${item.total ? '' : 'is-empty'}" style="height:${item.total ? Math.max(5, item.total / max * 100) : 3}%"></span></span><span class="day-label">${esc(label)}</span></button>`;
  }).join('')}</div></div>`;
}

export function todayView(state, now = new Date()) {
  const today = state.entries.filter((entry) => entry.date === dateKey(now));
  const reps = sumReps(today);
  const goal = state.settings.goal;
  const progress = Math.min(100, Math.round(reps / goal * 100));
  const streak = getStreak(state.entries, now);
  const week = daySeries(state.entries, 7, now);
  const activeDays = week.filter((day) => day.total > 0).length;
  const day = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  return `<section class="page-intro"><div class="intro-meta"><p class="eyebrow">${esc(day)}</p><span class="local-badge"><span class="status-dot" aria-hidden="true"></span>На устройстве</span></div><h1>Каждый повтор<br><span class="muted">имеет значение.</span></h1></section>
  <section class="card card-hero today-card" aria-labelledby="today-title">
    <div class="hero-topline"><span class="hero-label" id="today-title">${icon('target')}Твой день</span><button class="text-button" data-action="settings" type="button" aria-label="Изменить дневную цель">Цель ${number(goal)} ${icon('chevron')}</button></div>
    <div class="hero-metrics"><div><div class="hero-number ${reps >= 10000000 ? 'is-extra-wide' : reps >= 10000 ? 'is-wide' : ''}" data-testid="today-reps">${number(reps)}</div><div class="hero-number-label">${plural(reps, ['повторение', 'повторения', 'повторений'])} сегодня</div></div>${ring(progress, `<strong>${progress}<span class="percent">%</span></strong><span>дневной цели</span>`)}</div>
    <p class="hero-message ${reps >= goal ? 'is-complete' : ''}">${reps >= goal ? `${icon('check')}Дневная цель достигнута. Отличная работа!` : reps ? `Ещё ${number(goal - reps)} ${plural(goal - reps, ['повторение', 'повторения', 'повторений'])} до твоей цели` : 'Большой прогресс начинается с маленького подхода.'}</p>
    <button class="primary-button" type="button" data-action="add-entry">${icon('plus')}Записать подход</button>
  </section>
  <section class="stat-grid three today-stats" aria-label="Итоги дня">
    <div class="stat-card"><span class="stat-caption">${icon('layers')}Подходов</span><div class="stat-value">${today.length}<small>за день</small></div></div>
    <div class="stat-card"><span class="stat-caption">${icon('logo')}Упражнений</span><div class="stat-value">${new Set(today.map((entry) => entry.exerciseId)).size}<small>из 3</small></div></div>
    <div class="stat-card"><span class="stat-caption">${icon('flame')}Серия</span><div class="stat-value">${streak}<small>${plural(streak, ['день', 'дня', 'дней'])}</small></div></div>
  </section>
  ${heading('Твои упражнения', '', 'С собственным весом')}
  <section class="exercise-list" aria-label="Записать упражнение">${EXERCISES.map((exercise) => {
    const entries = today.filter((entry) => entry.exerciseId === exercise.id);
    return `<article class="card exercise-card"><div class="exercise-symbol">${icon(exercise.icon)}</div><div class="exercise-copy"><h3>${exercise.name}</h3><p>${exercise.muscle}</p>${entries.length ? `<span class="today-line">${sumReps(entries)} повторений · ${entries.length} ${plural(entries.length, ['подход', 'подхода', 'подходов'])}</span>` : ''}</div><button class="exercise-add" type="button" data-action="add-entry" data-exercise="${exercise.id}" aria-label="Записать ${exercise.name.toLowerCase()}">${icon('plus')}</button></article>`;
  }).join('')}</section>
  ${heading('Твоя активность', `<a href="#progress" class="text-button">За 7 дней ${icon('arrow')}</a>`)}
  <section class="card activity-card"><div class="activity-topline"><div><div class="activity-total">${number(week.reduce((total, day) => total + day.total, 0))}<small>повторений</small></div><p class="activity-subtitle">${activeDays ? `${activeDays} ${plural(activeDays, ['активный день', 'активных дня', 'активных дней'])} из 7` : 'Твой ритм только начинается'}</p></div><span class="chart-tag">${shortDate(week[0].key)} — ${shortDate(week[6].key)}</span></div>${activityChart(week, now)}</section>
  ${localNote()}`;
}

export function entryRow(entry) {
  const exercise = exerciseById(entry.exerciseId);
  return `<button class="card entry-row" type="button" data-action="edit-entry" data-id="${esc(entry.id)}" aria-label="${exercise.name}, ${entry.reps} повторений, ${entry.time}. Редактировать"><span class="exercise-symbol">${icon(exercise.icon)}</span><span class="entry-copy"><strong>${exercise.name}</strong><small>${entry.time}${entry.note ? ` · ${esc(entry.note)}` : ' · Собственный вес'}</small></span><span class="entry-reps"><strong>${number(entry.reps)}</strong><small>повт.</small></span>${icon('chevron')}</button>`;
}

export function historyView(state, filter = 'all', date = '', now = new Date(), showDate = false, limit = 100) {
  const entries = sortEntries(state.entries.filter((entry) => (filter === 'all' || entry.exerciseId === filter) && (!date || entry.date === date)));
  const groups = new Map();
  for (const entry of entries.slice(0, limit)) {
    if (!groups.has(entry.date)) groups.set(entry.date, []);
    groups.get(entry.date).push(entry);
  }
  return `<section class="page-intro"><div class="intro-meta"><p class="eyebrow">ТВОЯ ЛИЧНАЯ ХРОНОЛОГИЯ</p><span class="local-badge">${icon('shield')}</span></div><h1>История подходов<span class="brand-dot">.</span></h1><p class="page-subtitle">Маленькие шаги. Настоящие результаты.</p></section>
  <div class="filters" role="group" aria-label="Фильтр по упражнению">${[{ id: 'all', short: 'Все' }, ...EXERCISES].map((exercise) => `<button class="chip" type="button" data-action="history-filter" data-exercise="${exercise.id}" aria-pressed="${filter === exercise.id}">${exercise.short}</button>`).join('')}</div>
  <div class="history-toolbar"><span class="history-summary">${number(entries.length)} ${plural(entries.length, ['подход', 'подхода', 'подходов'])} · ${number(sumReps(entries))} повт.</span><button class="text-button" type="button" data-action="date-filter" aria-expanded="${showDate || !!date}" aria-controls="date-filter">${icon('calendar')}По дате</button></div>
  <div class="date-filter" id="date-filter" ${showDate || date ? '' : 'hidden'}><label for="history-date" class="eyebrow">Дата</label><input class="input" id="history-date" type="date" min="2000-01-01" max="${dateKey(now)}" value="${esc(date)}" aria-label="Дата подходов"><button class="text-button" data-action="clear-date" type="button">Сбросить</button></div>
  ${entries.length ? `<div class="history-groups">${[...groups].map(([key, items]) => `<section class="history-day"><div class="history-day-heading"><h2>${esc(dayLabel(key, now))}</h2><span>${sumReps(items)} повт.</span></div><div class="entry-list">${items.map(entryRow).join('')}</div></section>`).join('')}</div>${entries.length > limit ? `<button class="ghost-button load-more" type="button" data-action="load-more">Показать ещё ${Math.min(100, entries.length - limit)} подходов</button>` : ''}<button type="button" class="ghost-button history-add" data-action="add-entry">${icon('plus')}Записать подход</button>` : `<section class="card empty-state"><div class="empty-art">${icon(date || filter !== 'all' ? 'calendar' : 'history')}</div><h2>${date || filter !== 'all' ? 'Пока без подходов' : 'Здесь начинается история'}</h2><p>${date || filter !== 'all' ? 'На выбранную дату или для этого упражнения записей пока нет.' : 'Запиши первый подход — он появится здесь. А потом станет частью большого прогресса.'}</p><button class="primary-button" type="button" data-action="${date || filter !== 'all' ? 'clear-filters' : 'add-entry'}">${icon(date || filter !== 'all' ? 'back' : 'plus')}${date || filter !== 'all' ? 'Показать все записи' : 'Первый подход'}</button></section>`}
  ${localNote()}`;
}

export function progressView(state, period = 'week', now = new Date()) {
  const range = getPeriodRange(period, now);
  const entries = entriesInRange(state.entries, range);
  const reps = sumReps(entries);
  const previous = sumReps(entriesInRange(state.entries, getPeriodRange(period, now, true)));
  const difference = previous ? Math.round((reps - previous) / previous * 100) : null;
  const series = period === 'all' ? monthSeries(state.entries, now) : daySeries(state.entries, period === 'month' ? 30 : 7, now);
  const rhythm = daySeries(state.entries, 28, now);
  const activeDays = rhythm.filter((day) => day.total > 0).length;
  const caption = period === 'all' ? 'За всё время' : `${shortDate(range.start)} — ${shortDate(range.end)}`;
  return `<section class="page-intro"><div class="intro-meta"><p class="eyebrow">ВИДЕН КАЖДЫЙ ШАГ</p><span class="local-badge">${icon('trend')}</span></div><h1>Твой прогресс<span class="brand-dot">.</span></h1><p class="page-subtitle">Не сравнивай себя с другими. Сравнивай со вчера.</p></section>
  <div class="segmented" role="group" aria-label="Период статистики">${[{ id: 'week', label: '7 дней' }, { id: 'month', label: '30 дней' }, { id: 'all', label: 'Всё время' }].map((item) => `<button type="button" data-action="period" data-period="${item.id}" aria-pressed="${item.id === period}">${item.label}</button>`).join('')}</div>
  <section class="card card-hero progress-hero"><div class="hero-topline"><span class="eyebrow">Общий объём</span><span class="chart-tag">${caption}</span></div><div class="hero-number"><span data-testid="progress-reps">${number(reps)}</span> <small>повторений</small></div><div class="progress-change">${icon(reps ? 'trend' : 'leaf')}${!reps && !previous ? 'Начни с подхода. Остальное посчитаем мы.' : period === 'all' ? 'Каждый из них — твой вклад в себя.' : difference !== null ? `${difference > 0 ? '+' : ''}${difference}% к предыдущим ${period === 'month' ? '30' : '7'} дням` : 'Первый шаг сделан. Продолжай в своём темпе.'}</div><div class="progress-facts"><div><strong>${number(entries.length)}</strong><span>${plural(entries.length, ['подход', 'подхода', 'подходов'])}</span></div><div><strong>${new Set(entries.map((entry) => entry.date)).size}</strong><span>${plural(new Set(entries.map((entry) => entry.date)).size, ['день активности', 'дня активности', 'дней активности'])}</span></div></div></section>
  ${heading('Объём тренировок', '', period === 'all' ? 'Последние 12 месяцев' : 'По дням')}
  <section class="card activity-card">${activityChart(series, now, period === 'all' ? 'months' : 'days')}<p class="chart-caption">${period === 'all' ? 'Все повторы входят в общий объём; на графике — последние 12 месяцев.' : 'Нажми на столбик, чтобы посмотреть подходы за день.'}</p></section>
  ${heading('По упражнениям', '', caption)}
  <section class="card distribution">${EXERCISES.map((exercise) => {
    const total = sumReps(entries.filter((entry) => entry.exerciseId === exercise.id));
    return `<div><div class="distribution-topline"><strong>${exercise.name}</strong><span>${number(total)} повт. <span class="faint">/ ${reps ? Math.round(total / reps * 100) : 0}%</span></span></div><div class="bar-track" role="meter" aria-label="${exercise.name}: доля повторений" aria-valuenow="${reps ? Math.round(total / reps * 100) : 0}" aria-valuemin="0" aria-valuemax="100"><span class="bar-fill" style="width:${reps ? total / reps * 100 : 0}%"></span></div></div>`;
  }).join('')}</section>
  ${heading('Личные рекорды', '', 'Лучший подход · всё время')}
  <section class="card records">${EXERCISES.map((exercise) => {
    const best = bestSet(state.entries, exercise.id);
    return `<div class="record-row">${icon('trophy')}<div class="entry-copy"><strong>${exercise.name}</strong><small>${best ? shortDate(best.date) : 'Первый рекорд впереди'}</small></div><div class="entry-reps"><strong>${best ? best.reps : '—'}</strong><small>повт.</small></div></div>`;
  }).join('')}</section>
  ${heading('Ритм тренировок', '', '28 дней')}
  <section class="card"><div class="activity-total">${activeDays}<small>${plural(activeDays, ['активный день', 'активных дня', 'активных дней'])} из 28</small></div><div class="heatmap" aria-label="Активность за последние 28 дней">${rhythm.map((day) => `<span class="heatmap-day ${day.total ? 'is-active' : ''} ${day.total >= state.settings.goal ? 'is-goal' : ''}" role="img" aria-label="${shortDate(day.key)}: ${day.total} повторений" title="${shortDate(day.key)} · ${day.total} повторений"></span>`).join('')}</div><div class="heatmap-legend"><span>${shortDate(rhythm[0].key)}</span><span>Сегодня</span></div></section>
  ${localNote()}`;
}

export function entrySheet(draft, state, now = new Date()) {
  const exercise = exerciseById(draft.exerciseId);
  const count = state.entries.filter((entry) => entry.date === draft.date && entry.exerciseId === draft.exerciseId).length + 1;
  return `${sheetHeading(draft.id ? 'Твой подход' : 'Ещё один шаг вперёд.', draft.id ? 'Можно исправить результат, дату и заметку.' : 'Один подход. Твой вклад в сегодняшнего себя.')}
  <form class="sheet-form" id="entry-form">
    <div class="exercise-picker" role="group" aria-label="Упражнение">${EXERCISES.map((item) => `<button class="exercise-choice" type="button" data-action="choose-exercise" data-exercise="${item.id}" aria-pressed="${draft.exerciseId === item.id}">${icon(item.icon)}<span>${item.name}</span></button>`).join('')}</div>
    <div class="reps-field"><label class="reps-label" for="reps">${draft.id ? 'Количество повторений' : `Подход ${count} · повторения`}</label><div class="reps-control"><button class="step-button" type="button" data-action="step-reps" data-step="-1" aria-label="На одно повторение меньше">${icon('minus')}</button><input class="reps-input" id="reps" name="reps" inputmode="numeric" type="number" step="1" min="1" max="9999" required value="${esc(draft.reps)}" aria-label="Количество повторений"><button class="step-button" type="button" data-action="step-reps" data-step="1" aria-label="На одно повторение больше">${icon('plus')}</button></div><div class="quick-reps" role="group" aria-label="Быстрое количество">${[5, 10, 15, 20, 30].map((value) => `<button class="chip" type="button" data-action="quick-reps" data-reps="${value}" aria-pressed="${Number(draft.reps) === value}">${value}</button>`).join('')}</div></div>
    <div class="form-row"><div class="field"><label for="entry-date">Дата</label><input class="input" id="entry-date" name="date" type="date" min="2000-01-01" max="${dateKey(now)}" value="${esc(draft.date)}" required></div><div class="field"><label for="entry-time">Время</label><input class="input" id="entry-time" name="time" type="time" value="${esc(draft.time)}" required></div></div>
    <div class="field"><label for="entry-note">Заметка <span class="faint">· необязательно</span></label><textarea class="input" id="entry-note" name="note" rows="2" maxlength="240" placeholder="Как прошёл подход?">${esc(draft.note)}</textarea></div>
    ${formError}
    <button class="primary-button" type="submit">${icon('check')}${draft.id ? 'Сохранить изменения' : `Сохранить подход`}</button>
    <p class="form-note">${icon('shield')}${!draft.id && state.settings.autoRest ? `После записи за сегодня начнётся отдых · ${state.settings.restSeconds} сек` : 'Сохраняется только на этом устройстве'}</p>
  </form>${draft.id ? `<button class="text-button delete-entry-button" type="button" data-action="delete-confirm" data-id="${esc(draft.id)}">${icon('trash')}Удалить подход</button>` : ''}`;
}

export function settingsSheet(settings, count, native = false) {
  return `${sheetHeading('В твоём ритме.', 'Настрой дневник под себя.')}
  <form class="sheet-form" id="settings-form">
    <section class="settings-group"><h3 class="settings-label">Дневная цель</h3><div class="field"><label for="daily-goal">Сумма повторений всех упражнений за день</label><div class="input-wrap"><input class="input goal-input" id="daily-goal" name="goal" inputmode="numeric" type="number" min="1" max="9999" step="1" required value="${settings.goal}"><span class="input-suffix">повторений</span></div></div></section>
    <section class="settings-group"><h3 class="settings-label">Твой акцент</h3><div class="theme-picker" role="group" aria-label="Цветовая тема">${[{ id: 'mint', name: 'Мятный' }, { id: 'violet', name: 'Лаванда' }, { id: 'amber', name: 'Персик' }].map((theme) => `<button class="theme-option" type="button" data-action="theme" data-theme-option="${theme.id}" aria-pressed="${theme.id === settings.theme}"><span class="theme-swatch" aria-hidden="true"></span>${theme.name}</button>`).join('')}</div></section>
    <section class="settings-group"><label class="toggle-label" for="auto-rest"><span class="toggle-copy"><strong>Отдых после подхода</strong><small>Таймер запустится автоматически</small></span><input class="toggle" id="auto-rest" name="autoRest" type="checkbox" ${settings.autoRest ? 'checked' : ''}></label><div class="duration-picker" role="group" aria-label="Длительность отдыха">${[30, 60, 90, 120].map((seconds) => `<button class="chip" type="button" data-action="rest-duration" data-seconds="${seconds}" aria-pressed="${settings.restSeconds === seconds}">${seconds} с</button>`).join('')}</div></section>
    <section class="settings-group"><h3 class="settings-label">Твои данные — у тебя</h3><p class="settings-description">В дневнике ${number(count)} ${plural(count, ['подход', 'подхода', 'подходов'])}. Сделай резервную копию перед переустановкой или очисткой данных. Облачной синхронизации нет.</p><div class="backup-buttons"><button class="ghost-button" type="button" data-action="export">${icon('download')}${native ? 'Сохранить копию' : 'Экспорт JSON'}</button><button class="ghost-button" type="button" data-action="import">${icon('upload')}Импорт JSON</button></div>${!native ? `<button class="ghost-button" type="button" data-action="install">${icon('plus')}На главный экран</button>` : ''}</section>
    ${formError}<button class="primary-button" type="submit">${icon('check')}Сохранить настройки</button><button class="text-button" type="button" data-action="reset-confirm">${icon('trash')}Очистить дневник</button><div class="settings-version">${icon('logo')}Повтор · 1.0.0 · Сделано для твоего прогресса</div>
  </form>`;
}

export function timerSheet(timer, seconds = 60) {
  const remaining = timer ? timerRemaining(timer) : seconds;
  const finished = timer && remaining === 0;
  return `${sheetHeading('Время выдохнуть.', 'Восстановись. Следующий подход будет ещё лучше.')}
  <div class="timer-view">${ring(timer ? Math.min(100, remaining / timer.duration * 100) : 100, `<strong data-timer-display>${formatTimer(remaining)}</strong><span data-timer-status>${finished ? 'Можно продолжать' : timer?.paused ? 'На паузе' : timer ? 'Отдых между подходами' : 'Твой перерыв'}</span>`, 204)}
  ${!timer ? `<div class="duration-picker" role="group" aria-label="Время таймера">${[30, 60, 90, 120].map((value) => `<button class="chip" type="button" data-action="timer-duration" data-seconds="${value}" aria-pressed="${value === seconds}">${value} с</button>`).join('')}</div><button class="primary-button timer-start" type="button" data-action="timer-start">${icon('play')}Начать отдых</button>` : `<div class="timer-actions"><button class="ghost-button" type="button" data-action="timer-toggle">${icon(finished ? 'play' : timer.paused ? 'play' : 'pause')}${finished ? 'Ещё раз' : timer.paused ? 'Продолжить' : 'Пауза'}</button><button class="ghost-button" type="button" data-action="timer-extend">${icon('plus')}30 секунд</button></div><button class="primary-button" type="button" data-action="next-set">${icon('plus')}Следующий подход</button><button class="text-button" type="button" data-action="timer-stop">${icon('close')}Закрыть таймер</button>`}</div>`;
}

export function restDock(timer) {
  const remaining = timerRemaining(timer);
  return `<button class="rest-open" type="button" data-action="timer-open" aria-label="Открыть таймер отдыха">${icon(remaining ? 'timer' : 'check')}<span class="rest-label"><strong>${remaining ? 'Время отдохнуть' : 'Можно продолжать'}</strong><small>${remaining ? timer.paused ? 'Таймер на паузе' : 'Не спеши. Восстановись.' : 'Готов к следующему подходу?'}</small></span><span class="rest-countdown" data-timer-display>${formatTimer(remaining)}</span></button><button class="header-icon" type="button" data-action="${remaining ? 'timer-toggle' : 'next-set'}" aria-label="${remaining ? timer.paused ? 'Продолжить таймер' : 'Приостановить таймер' : 'Следующий подход'}">${icon(remaining ? timer.paused ? 'play' : 'pause' : 'plus')}</button><button class="header-icon" type="button" data-action="timer-stop" aria-label="Закрыть таймер">${icon('close')}</button>`;
}

export function deleteSheet(entry) {
  return `${sheetHeading('Удалить этот подход?', 'Иногда нужно начать заново. Это нормально.')}<div class="card confirm-copy"><strong>${exerciseById(entry.exerciseId).name}</strong><br>${entry.reps} повторений · ${shortDate(entry.date)} · ${entry.time}</div><p class="settings-description confirm-description">Запись исчезнет из истории и статистики. Сразу после удаления её можно будет восстановить.</p><div class="confirm-actions"><button class="ghost-button" type="button" data-action="cancel-delete">Оставить</button><button class="primary-button" type="button" data-action="delete-entry" data-id="${esc(entry.id)}">Удалить подход</button></div>`;
}

export function resetSheet() {
  return `${sheetHeading('С чистого листа?', 'Это действие нельзя отменить.')}<p class="confirm-copy">Все подходы, рекорды и настройки будут удалены с этого устройства. Сначала сохрани резервную копию, если хочешь вернуться к ним позже.</p><button class="ghost-button backup-before-reset" type="button" data-action="export">${icon('download')}Сначала сохранить копию</button><form class="sheet-form reset-form" id="reset-form"><div class="field"><label for="reset-word">Для подтверждения введи УДАЛИТЬ</label><input class="input" id="reset-word" name="confirmation" autocomplete="off" required pattern="УДАЛИТЬ" placeholder="УДАЛИТЬ"></div>${formError}<div class="confirm-actions"><button class="ghost-button" type="button" data-action="settings">Отмена</button><button class="primary-button" type="submit">Очистить дневник</button></div></form>`;
}

export function importSheet(incoming, added, currentCount, recovering = false) {
  return `${sheetHeading('Вернуть свой прогресс.', 'Импорт резервной копии «Повтор».')}<div class="card import-summary"><div><span>В резервной копии</span><strong>${incoming.entries.length} подходов</strong></div><div><span>Новых записей</span><strong>${added}</strong></div><div><span>Уже в дневнике</span><strong>${incoming.entries.length - added}</strong></div></div><p class="settings-description">${recovering ? 'Повреждённый дневник будет заменён этой проверенной копией. Записи и настройки из копии будут восстановлены. При необходимости сначала выгрузи исходный файл через экспорт.' : `Записи будут объединены с ${currentCount} ${plural(currentCount, ['текущим подходом', 'текущими подходами', 'текущими подходами'])}. Дубликаты по идентификатору пропустим. Текущие настройки не изменятся.`}</p>${formError}<div class="confirm-actions"><button class="ghost-button" type="button" data-action="settings">Отмена</button><button class="primary-button" type="button" data-action="confirm-import">${icon('upload')}Добавить ${added}</button></div>`;
}
