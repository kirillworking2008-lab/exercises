import test from 'node:test';
import assert from 'node:assert/strict';
import { isNative, initializeNative, exportFile } from '../platform.js';

test('web does not attempt to load native plugins', async () => {
  global.window = {};
  assert.equal(isNative(), false);
  await initializeNative(() => { throw new Error('not called'); });
  delete global.window;
});

test('Android injected proxies work without registerPlugin or a JS bundler', async () => {
  let listener;
  let exits = 0;
  let wrote;
  let shared;
  let handled = true;
  global.window = { Capacitor: { isNativePlatform: () => true, Plugins: {
    App: {
      addListener: async (event, callback) => { assert.equal(event, 'backButton'); listener = callback; },
      exitApp: async () => { exits += 1; },
    },
    Filesystem: { writeFile: async (options) => { wrote = options; return { uri: 'content://local/povtor.json' }; } },
    Share: { share: async (options) => { shared = options; } },
  } } };
  assert.equal(isNative(), true);
  await initializeNative(() => handled);
  await listener();
  assert.equal(exits, 0);
  handled = false;
  await listener();
  assert.equal(exits, 1);
  await exportFile('povtor.json', '{"note":"Прогресс"}');
  assert.deepEqual(wrote, { path: 'povtor.json', data: '{"note":"Прогресс"}', directory: 'CACHE', encoding: 'utf8' });
  assert.deepEqual(shared.files, ['content://local/povtor.json']);
  delete global.window;
});

test('missing native plugins fail explicitly rather than losing an export', async () => {
  global.window = { Capacitor: { isNativePlatform: () => true, Plugins: {} } };
  await assert.rejects(exportFile('copy.json', '{}'), /Нативный модуль Filesystem недоступен/);
  delete global.window;
});
