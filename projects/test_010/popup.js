const DEBUG = false;

function log(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

async function handleDirectory() {
  try {
    const dirHandle = await window.showDirectoryPicker();
    const mdFiles = [];
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'file' && name.endsWith('.md')) {
        mdFiles.push({ name, handle });
      }
    }
    const filesToProcess = DEBUG ? mdFiles.slice(0, 1) : mdFiles;
    for (const { name, handle } of filesToProcess) {
      log('Processing', name);
      const file = await handle.getFile();
      let text = await file.text();
      const now = new Date().toISOString();
      if (text.startsWith('---')) {
        const end = text.indexOf('---', 3);
        if (end !== -1) {
          let header = text.slice(3, end).trim();
          if (/lastOpened:/.test(header)) {
            header = header.replace(/lastOpened:.*/, 'lastOpened: ' + now);
          } else {
            header += `\nlastOpened: ${now}`;
          }
          text = `---\n${header}\n---` + text.slice(end + 3);
        }
      } else {
        text = `---\nlastOpened: ${now}\n---\n` + text;
      }
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      log('Updated metadata for', name);
      const content = text.replace(/^---[\s\S]*?---/, '');
      const html = marked.parse(content);
      const section = document.createElement('section');
      section.innerHTML = `<h2>${name}</h2>${html}`;
      document.getElementById('output').appendChild(section);
      log('Rendered', name);
    }
  } catch (err) {
    log('Error', err);
  }
}

document.getElementById('select-folder').addEventListener('click', handleDirectory);
