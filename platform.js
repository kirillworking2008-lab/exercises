export function isNative() {
  return !!window.Capacitor?.isNativePlatform?.();
}

function nativePlugin(name) {
  const capacitor = window.Capacitor;
  // In a no-bundler app Android injects the ready-made plugin proxies itself.
  // registerPlugin exists only if the optional JS core has also been loaded.
  const plugin = typeof capacitor.registerPlugin === 'function'
    ? capacitor.registerPlugin(name) : capacitor.Plugins?.[name];
  if (!plugin) throw new Error(`Нативный модуль ${name} недоступен. Переустанови актуальную сборку приложения.`);
  return plugin;
}

export async function exportFile(name, content) {
  if (isNative()) {
    // WebView does not handle <a download>. Share a real UTF-8 file instead.
    const filesystem = nativePlugin('Filesystem');
    const file = await filesystem.writeFile({ path: name, data: content, directory: 'CACHE', encoding: 'utf8' });
    await nativePlugin('Share').share({ title: 'Резервная копия «Повтор»', files: [file.uri], dialogTitle: 'Сохранить резервную копию' });
    return;
  }
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  (document.querySelector('dialog[open]') || document.body).append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function initializeNative(onBack) {
  if (!isNative()) return;
  const app = nativePlugin('App');
  await app.addListener('backButton', async () => {
    if (!onBack()) await app.exitApp();
  });
}
