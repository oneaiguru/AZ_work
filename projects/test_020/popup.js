const debugToggle = document.getElementById('debugToggle');
const folderPicker = document.getElementById('folderPicker');
const folderDisplay = document.getElementById('folderDisplay');
const fileList = document.getElementById('fileList');

let debug = false;

function log(...args) {
  if (debug) {
    console.log(...args);
  }
}

debugToggle.addEventListener('change', () => {
  debug = debugToggle.checked;
  log('Debug mode:', debug);
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

  names.forEach(name => log('Processed file:', name));
  log('Done');
});
