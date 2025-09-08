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
  try {
    const limit = debug ? 1 : 10;
    const names = [];
    let folderPath = '';

    for (const file of e.target.files) {
      if (!file.name.endsWith('.md')) continue;

      if (!folderPath && file.webkitRelativePath) {
        const firstPath = file.webkitRelativePath;
        folderPath = firstPath.substring(0, firstPath.lastIndexOf('/'));
        folderDisplay.textContent = 'Selected folder: ' + folderPath;
        log('Selected folder:', folderPath);
      }

      names.push(file.name);
      if (names.length >= limit) break;
    }

    if (names.length === 0) {
      folderDisplay.textContent = 'No markdown files found.';
      fileList.innerHTML = '';
      log('No markdown files found');
      return;
    }

    fileList.innerHTML = names.map(n => `<li>${n}</li>`).join('');
    names.forEach(name => log('Processed file:', name));
    log('Done');
  } catch (err) {
    folderDisplay.textContent = 'Error reading files';
    console.error(err);
  }
});
