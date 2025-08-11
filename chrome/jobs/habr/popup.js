console.debug('Habr jobs plugin script loaded');

window.addEventListener('unload', () => {
  console.debug('Habr jobs plugin stopped');
});

document.addEventListener('DOMContentLoaded', () => {
  console.debug('Habr jobs plugin started');

  const folderInput = document.getElementById('folder');
  const fileInput = document.getElementById('filename');
  const saveBtn = document.getElementById('save');

  folderInput.value = localStorage.getItem('folder') || '';
  fileInput.value = localStorage.getItem('filename') || 'vacancies.json';
  console.debug('Loaded initial settings', { folder: folderInput.value, filename: fileInput.value });

  saveBtn.addEventListener('click', async () => {
    console.debug('Save button clicked');
    const folder = folderInput.value.trim() || '';
    const filename = fileInput.value.trim() || 'vacancies.json';
    localStorage.setItem('folder', folder);
    localStorage.setItem('filename', filename);
    console.debug('Settings saved', { folder, filename });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.debug('Active tab retrieved', tab);
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const cards = Array.from(document.querySelectorAll('.vacancy-card'));
        return cards.map(card => {
          const titleEl = card.querySelector('.vacancy-card__title-link');
          const salaryEl = card.querySelector('.vacancy-card__salary');
          return {
            title: titleEl ? titleEl.textContent.trim() : '',
            url: titleEl ? titleEl.href : '',
            salary: salaryEl ? salaryEl.textContent.trim() : ''
          };
        });
      }
    });
    console.debug(`Extracted ${result.length} vacancies`, result);

    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const path = folder ? `${folder.replace(/\\$/,'')}/${filename}` : filename;
    console.debug('Initiating download', { path });
    chrome.downloads.download({ url, filename: path, saveAs: false }, downloadId => {
      console.debug('Download started', downloadId);
      URL.revokeObjectURL(url);
      console.debug('Closing popup window');
      window.close();
    });
  });
});
