const debugToggle = document.getElementById('debugToggle');
const pickFolder = document.getElementById('pickFolder');
const folderDisplay = document.getElementById('folderDisplay');
const fileList = document.getElementById('fileList');

let debug = false;
let logHandle;
let pendingLogs = [];

function logToConsole(...args) {
  if (debug) {
    console.log(...args);
  }
}

async function appendLog(message) {
  if (!logHandle) {
    pendingLogs.push(message);
    return;
  }
  const writable = await logHandle.createWritable({ keepExistingData: true });
  await writable.write(message + "\n");
  await writable.close();
}

async function flushPending() {
  if (!logHandle) return;
  for (const msg of pendingLogs) {
    const writable = await logHandle.createWritable({ keepExistingData: true });
    await writable.write(msg + "\n");
    await writable.close();
  }
  pendingLogs = [];
}

debugToggle.addEventListener('change', () => {
  debug = debugToggle.checked;
  logToConsole('Debug mode:', debug);
});

pickFolder.addEventListener('click', async () => {
  await appendLog('showDirectoryPicker params: {}');
  const dirHandle = await window.showDirectoryPicker();
  await appendLog(`showDirectoryPicker result: ${dirHandle.name}`);
  await appendLog('openLogFile params: {"name":"log.txt"}');
  logHandle = await dirHandle.getFileHandle('log.txt', { create: true });
  await flushPending();
  await appendLog('openLogFile result: log.txt');
  folderDisplay.textContent = 'Selected folder: ' + dirHandle.name;

  await appendLog(`listFiles params: {"folder":"${dirHandle.name}"}`);
  const files = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (name.endsWith('.md') && handle.kind === 'file') {
      files.push({ name, handle });
    }
  }
  await appendLog(`listFiles result: ${JSON.stringify(files.map(f => f.name))}`);

  const limit = debug ? 1 : 10;
  const names = files.slice(0, limit).map(f => f.name);
  fileList.innerHTML = names.map(n => `<li>${n}</li>`).join('');

  for (const name of names) {
    await appendLog(`processFile params: {"name":"${name}"}`);
    await appendLog(`processFile result: "${name}"`);
    logToConsole('Processed file:', name);
  }

  await appendLog('Done');
  logToConsole('Done');
});
