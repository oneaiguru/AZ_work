const chooseBtn = document.getElementById('choose');
const folderLabel = document.getElementById('folder');
const processBtn = document.getElementById('process');
const logEl = document.getElementById('log');
let dirHandle = null;

function log(msg) {
  logEl.textContent += msg + '\n';
}


chooseBtn.addEventListener('click', async () => {
  try {
    dirHandle = await window.showDirectoryPicker();
    const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      dirHandle = null;
      log('Нет доступа к папке');
      return;
    }
    folderLabel.textContent = dirHandle.name;
  } catch (e) {
    log('Не удалось получить доступ к папке');
  }
});

processBtn.addEventListener('click', async () => {
  if (!dirHandle) {
    log('Выберите папку');
    return;
  }
  const debug = document.getElementById('debug').checked;
  const processed = await getProcessed();

  let count = 0;
  for await (const { path, handle } of walkDir(dirHandle)) {
    if (processed[path]) continue;
    const file = await handle.getFile();
    const text = await file.text();
    if (!/tag\s*:\s*job/.test(text)) continue;
    log(`Processing ${path}`);
    const result = await parseJob(text);
    if (!result) {
      log('Не удалось обработать файл');
      continue;
    }
    const updated = addMeta(text, result.attrs);
    const writable = await handle.createWritable();
    await writable.write(updated);
    await writable.close();
    processed[path] = true;
    await setProcessed(processed);
    log(`Готово: ${path}`);
    count++;
    if (debug && count >= 1) break;
  }
});

async function* walkDir(dir, prefix = '') {
  for await (const [name, handle] of dir.entries()) {
    const path = `${prefix}${name}`;
    if (handle.kind === 'file' && name.endsWith('.md')) {
      yield { path, handle };
    } else if (handle.kind === 'directory') {
      yield* walkDir(handle, `${path}/`);
    }
  }
}

async function ensureChatTab() {
  const tabs = await chrome.tabs.query({ url: 'https://chat.openai.com/*' });
  if (tabs.length) return tabs[0];
  const tab = await chrome.tabs.create({ url: 'https://chat.openai.com/' });
  await new Promise(resolve => {
    chrome.tabs.onUpdated.addListener(function listener(id, info) {
      if (id === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
  return tab;
}

async function parseJob(text) {
  const tab = await ensureChatTab();
  const prompt = `Выступи как парсер вакансии.\nНа входе ты получаешь описание вакансии в произвольном виде (с датой публикации,\n названием компании и позицией в тексте). Твоя задача:\n1. Извлечь:\n   - дату публикации (формат YYYY-MM-DD),\n   - компанию,\n   - позицию (название роли),\n   - контрольную сумму (MD5) для чистого текста описания вакансии.\n2. Вернуть результат в виде Markdown‑блока:\n---\nPublicationDate: <YYYY-MM-DD>\nCompany: <Компания>\nPosition: <Позиция>\nDescriptionChecksum: <md5>\n---\n<чистый текст описания>`;
  const content = await chrome.tabs.sendMessage(tab.id, {
    action: 'runPrompt',
    text: prompt + "\n" + text
  });
  if (!content) return null;
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/m.exec(content.trim());
  if (!match) return null;
  const attrs = {};
  match[1].split(/\n/).forEach(line => {
    const [k, v] = line.split(':').map(s => s.trim());
    if (k && v) attrs[k] = v;
  });
  return { attrs, description: match[2].trim() };
}

function addMeta(text, attrs) {
  const lines = Object.entries(attrs).map(([k, v]) => `${k}: ${v}`);
  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3);
    if (end !== -1) {
      const header = text.slice(0, end);
      const rest = text.slice(end + 4);
      return `${header}\n${lines.join('\n')}\n---${rest}`;
    }
  }
  return `---\n${lines.join('\n')}\n---\n${text}`;
}

function getProcessed() {
  return new Promise(resolve => chrome.storage.local.get({ processed: {} }, data => resolve(data.processed)));
}

function setProcessed(obj) {
  return new Promise(resolve => chrome.storage.local.set({ processed: obj }, resolve));
}
