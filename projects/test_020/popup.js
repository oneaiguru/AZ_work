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
folderPicker.addEventListener('change', (e) => {
  const files = Array.from(e.target.files).filter(f => f.name.endsWith('.md'));
  if (files.length === 0) {
    folderDisplay.textContent = 'No markdown files found.';
    fileList.innerHTML = '';
    log('No markdown files found');
    return;
  }

  const firstPath = files[0].webkitRelativePath;
  const folderPath = firstPath.substring(0, firstPath.lastIndexOf('/'));
  folderDisplay.textContent = 'Selected folder: ' + folderPath;
  log('Selected folder:', folderPath);

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
