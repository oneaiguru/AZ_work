let debug = false;
function log(...args) {
  if (debug) {
    console.log(...args);
  }
}

async function updateLastOpened(text) {
  const iso = new Date().toISOString();
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (fm) {
    let body = fm[1];
    if (/lastOpened:\s*.*/.test(body)) {
      body = body.replace(/lastOpened:\s*.*/, `lastOpened: ${iso}`);
      log('Replaced existing lastOpened with', iso);
    } else {
      body += `\nlastOpened: ${iso}`;
      log('Added lastOpened to front matter', iso);
    }
    return { text: `---\n${body}\n---\n` + text.slice(fm[0].length), iso };
  }
  log('Created front matter with lastOpened', iso);
  return { text: `---\nlastOpened: ${iso}\n---\n` + text, iso };
}

document.addEventListener('DOMContentLoaded', () => {
  const folderBtn = document.getElementById('select-folder');
  const debugChk = document.getElementById('debug');

  chrome.storage.sync.get({ debug: false }, ({ debug: stored }) => {
    debug = stored;
    debugChk.checked = debug;
    log('Initial debug mode', debug);
  });

  debugChk.addEventListener('change', () => {
    debug = debugChk.checked;
    chrome.storage.sync.set({ debug });
    log('Debug mode set to', debug);
  });

  folderBtn.addEventListener('click', async () => {
    const dirHandle = await window.showDirectoryPicker();
    log('Selected directory', dirHandle.name);
    let processed = 0;
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'file' && name.endsWith('.md')) {
        log('Processing file', name);
        const file = await handle.getFile();
        log('Read file', name);
        const originalText = await file.text();
        const { text, iso } = await updateLastOpened(originalText);
        log('lastOpened set to', iso);
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        log('Wrote updated Markdown to', name);

        const html = marked.parse(text);
        const htmlName = name.replace(/\.md$/, '.html');
        log('Generated HTML for', name);
        const htmlHandle = await dirHandle.getFileHandle(htmlName, {
          create: true,
        });
        const htmlWritable = await htmlHandle.createWritable();
        await htmlWritable.write(html);
        await htmlWritable.close();
        log('Wrote HTML to', htmlName);

        processed++;
        log('Processed files count', processed);
        if (debug && processed >= 1) {
          log('Debug mode: stopping after first file');
          break;
        }
      }
    }
    log('Finished processing', processed, 'files');
  });
});
