import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const fixedDate = new Date('2026-11-04T12:00:00Z');
const entry = (overrides = {}) => ({ id: 'test-1', exerciseId: 'pullups', reps: 10, date: '2026-11-04', time: '12:00', note: '', createdAt: '2026-11-04T12:00:00.000Z', ...overrides });
const data = (entries = [], settings = {}) => ({ version: 1, entries, settings: { goal: 100, theme: 'mint', restSeconds: 60, autoRest: true, ...settings } });
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('povtor.data.v1')));
async function addSet(page, reps = 10) {
  await page.getByRole('button', { name: 'Записать подход', exact: true }).click();
  await page.getByLabel('Количество повторений', { exact: true }).fill(String(reps));
  await page.getByRole('button', { name: 'Сохранить подход', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: fixedDate });
});

test('first visit has no fake data, records and persists a real approach', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('today-reps')).toHaveText('0');
  await addSet(page, 12);
  await expect(page.getByTestId('today-reps')).toHaveText('12');
  await expect(page.locator('#rest-dock')).toBeVisible();
  expect((await stored(page)).entries).toHaveLength(1);
  await page.reload();
  await expect(page.getByTestId('today-reps')).toHaveText('12');
  await page.getByRole('link', { name: 'История', exact: true }).click();
  await expect(page.locator('.entry-row')).toHaveCount(1);
  await expect(page.locator('.entry-reps strong')).toHaveText('12');
  await page.getByRole('link', { name: 'Прогресс', exact: true }).click();
  await expect(page.getByTestId('progress-reps')).toHaveText('12');
  expect(errors).toEqual([]);
});

test('exercise selection, presets, stepper, note and past date all work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Записать отжимания' }).click();
  await expect(page.locator('[data-action="choose-exercise"][data-exercise="pushups"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action="quick-reps"][data-reps="20"]').click();
  await page.getByRole('button', { name: 'На одно повторение больше' }).click();
  await expect(page.getByLabel('Количество повторений', { exact: true })).toHaveValue('21');
  await page.getByLabel('Дата', { exact: true }).fill('2026-11-03');
  await page.getByLabel('Время', { exact: true }).fill('18:45');
  await page.getByLabel(/Заметка/).fill('Медленно, с паузой');
  await page.getByRole('button', { name: 'Сохранить подход', exact: true }).click();
  await expect(page.getByTestId('today-reps')).toHaveText('0');
  await expect(page.locator('#rest-dock')).not.toBeVisible();
  const saved = (await stored(page)).entries[0];
  expect(saved).toMatchObject({ exerciseId: 'pushups', reps: 21, date: '2026-11-03', time: '18:45', note: 'Медленно, с паузой' });
  await page.getByRole('link', { name: 'История', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Вчера' })).toBeVisible();
  await page.locator('[data-action="history-filter"][data-exercise="pullups"]').click();
  await expect(page.getByRole('heading', { name: 'Пока без подходов' })).toBeVisible();
  await page.getByRole('button', { name: 'Показать все записи' }).click();
  await expect(page.locator('.entry-row')).toHaveCount(1);
});

test('edit, confirmed deletion, and undo update every metric', async ({ page }) => {
  await page.goto('/');
  await addSet(page, 10);
  await page.getByRole('link', { name: 'История', exact: true }).click();
  await page.locator('.entry-row').click();
  await page.getByLabel('Количество повторений', { exact: true }).fill('16');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.locator('.entry-reps strong')).toHaveText('16');
  await page.locator('.entry-row').click();
  await page.getByRole('button', { name: 'Удалить подход', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Удалить этот подход?' })).toBeVisible();
  await page.getByRole('button', { name: 'Оставить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Твой подход' })).toBeVisible();
  await page.getByRole('button', { name: 'Удалить подход', exact: true }).click();
  await page.getByRole('button', { name: 'Удалить подход', exact: true }).click();
  await expect(page.locator('.entry-row')).toHaveCount(0);
  expect((await stored(page)).entries).toHaveLength(0);
  await page.getByRole('button', { name: 'Вернуть', exact: true }).click();
  await expect(page.locator('.entry-row')).toHaveCount(1);
  expect((await stored(page)).entries[0].reps).toBe(16);
});

test('theme preview cancels, saved settings persist, goal celebration is real', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Лаванда' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-theme', 'violet');
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-theme', 'mint');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByLabel('Сумма повторений всех упражнений за день').fill('20');
  await page.getByRole('button', { name: 'Персик' }).click();
  await page.getByLabel('Отдых после подхода').uncheck();
  await page.getByRole('button', { name: '90 с', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-theme', 'amber');
  await addSet(page, 20);
  await expect(page.locator('.hero-message')).toContainText('Дневная цель достигнута');
  await expect(page.locator('#rest-dock')).not.toBeVisible();
  expect((await stored(page)).settings).toMatchObject({ theme: 'amber', goal: 20, autoRest: false, restSeconds: 90 });
});

test('rest timer pauses, extends, survives reload and opens next approach cleanly', async ({ page }) => {
  await page.goto('/');
  await addSet(page, 10);
  await page.locator('#rest-dock [data-action="timer-toggle"]').click();
  const paused = await page.locator('#rest-dock [data-timer-display]').textContent();
  await page.clock.fastForward(10000);
  await expect(page.locator('#rest-dock [data-timer-display]')).toHaveText(paused);
  await page.locator('#rest-dock [data-action="timer-open"]').click();
  await page.getByRole('button', { name: '30 секунд', exact: true }).click();
  await expect(page.locator('#sheet [data-timer-display]')).toHaveText('01:30');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.clock.fastForward(90000);
  await expect(page.locator('#sheet [data-timer-display]')).toHaveText('00:00');
  await expect(page.locator('#rest-dock')).toContainText('Можно продолжать');
  await page.locator('#sheet').getByRole('button', { name: 'Следующий подход', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ещё один шаг вперёд.' })).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/modal-open/);
  await page.getByRole('button', { name: 'Сохранить подход', exact: true }).click();
  await page.reload();
  await expect(page.locator('#rest-dock')).toBeVisible();
  await expect(page.getByTestId('today-reps')).toHaveText('20');
});

test('export is usable JSON, import merges safely and is idempotent', async ({ page }) => {
  await page.goto('/');
  await addSet(page, 7);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('povtor-2026-11-04.json');
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(backup.entries[0].reps).toBe(7);
  const incoming = data([...backup.entries, entry({ id: 'imported-2', exerciseId: 'abs', reps: 30 })]);
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    await page.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) });
    await page.locator('[data-action="confirm-import"]').click();
    expect((await stored(page)).entries).toHaveLength(2);
  }
  await expect(page.getByTestId('today-reps')).toHaveText('37');
});

test('invalid backup is rejected without changing the diary', async ({ page }) => {
  await page.goto('/');
  await addSet(page, 9);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data([entry({ reps: -12 })]))) });
  await expect(page.locator('#form-error')).toBeVisible();
  expect((await stored(page)).entries[0].reps).toBe(9);
});

test('storage errors never report a successful save', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'povtor.data.v1') throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Записать подход', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить подход', exact: true }).click();
  await expect(page.locator('#form-error')).toContainText('Не удалось сохранить');
  await expect(page.getByTestId('today-reps')).toHaveText('0');
  expect(await stored(page)).toBeNull();
});

test('corrupt storage stays untouched until explicit backup recovery', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('povtor.data.v1', '{broken'));
  await page.goto('/');
  await expect(page.locator('#storage-warning')).toBeVisible();
  await page.getByRole('button', { name: 'Записать подход', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить подход', exact: true }).click();
  await expect(page.locator('#form-error')).toContainText('Сначала восстанови');
  expect(await page.evaluate(() => localStorage.getItem('povtor.data.v1'))).toBe('{broken');
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data([entry()], { theme: 'violet' }))) });
  await expect(page.getByText(/Повреждённый дневник будет заменён/)).toBeVisible();
  await page.locator('[data-action="confirm-import"]').click();
  await expect(page.locator('#storage-warning')).not.toBeVisible();
  await expect(page.getByTestId('today-reps')).toHaveText('10');
  await expect(page.locator('#app')).toHaveAttribute('data-theme', 'violet');
});

test('reset requires explicit confirmation and clears both data and timer', async ({ page }) => {
  await page.goto('/');
  await addSet(page);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Очистить дневник', exact: true }).click();
  await page.getByRole('button', { name: 'Очистить дневник', exact: true }).click();
  expect((await stored(page)).entries).toHaveLength(1);
  await page.getByLabel('Для подтверждения введи УДАЛИТЬ').fill('УДАЛИТЬ');
  await page.getByRole('button', { name: 'Очистить дневник', exact: true }).click();
  await expect(page.getByTestId('today-reps')).toHaveText('0');
  expect((await stored(page)).entries).toHaveLength(0);
  await expect(page.locator('#rest-dock')).not.toBeVisible();
});

test('notes cannot execute HTML, date drill-down and period filters are real', async ({ page }) => {
  await page.addInitScript((value) => localStorage.setItem('povtor.data.v1', JSON.stringify(value)), data([
    entry({ note: '<img src=x onerror="window.hacked=true">' }),
    entry({ id: 'older', date: '2026-10-01', reps: 40 }),
  ]));
  await page.goto('/#progress');
  await expect(page.getByTestId('progress-reps')).toHaveText('10');
  await page.getByRole('button', { name: 'Всё время', exact: true }).click();
  await expect(page.getByTestId('progress-reps')).toHaveText('50');
  await page.getByRole('button', { name: '7 дней', exact: true }).click();
  await page.locator('[data-action="day-detail"][data-date="2026-11-04"]').click();
  await expect(page.locator('.entry-row')).toHaveCount(1);
  await expect(page.locator('.entry-row small').first()).toContainText('<img');
  expect(await page.evaluate(() => window.hacked)).toBeUndefined();
  expect(await page.locator('.entry-row img').count()).toBe(0);
});

for (const width of [320, 360, 440, 1000]) {
  test(`no horizontal overflow or console errors at ${width}px`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    for (const screen of ['today', 'history', 'progress']) {
      await page.locator(`[data-screen="${screen}"]`).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole('button', { name: 'Настройки', exact: true }).click();
      expect(await page.locator('#sheet').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
    }
    expect(errors).toEqual([]);
  });
}

test('dialog traps focus and Escape closes it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Записать подход', exact: true }).click();
  for (let index = 0; index < 24; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.closest('dialog') !== null)).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('another tab cannot be silently overwritten by an open entry editor', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Записать подход', exact: true }).click();
  await page.getByLabel('Количество повторений', { exact: true }).fill('15');
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate((value) => localStorage.setItem('povtor.data.v1', JSON.stringify(value)), data([entry({ id: 'other-tab', reps: 22 })]));
  await page.getByRole('button', { name: 'Сохранить подход', exact: true }).click();
  await expect(page.locator('#form-error')).toContainText('другой вкладке');
  await expect(page.getByLabel('Количество повторений', { exact: true })).toHaveValue('15');
  await page.getByRole('button', { name: 'Сохранить подход', exact: true }).click();
  expect((await stored(page)).entries).toHaveLength(2);
  await expect(page.getByTestId('today-reps')).toHaveText('37');
  await other.close();
});

test('cached app reopens and records approaches with no network', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'allow', locale: 'ru-RU' });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await addSet(page, 8);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('today-reps')).toHaveText('8');
  await addSet(page, 5);
  await expect(page.getByTestId('today-reps')).toHaveText('13');
  await page.getByRole('link', { name: 'Прогресс', exact: true }).click();
  await expect(page.getByTestId('progress-reps')).toHaveText('13');
  await context.close();
});
