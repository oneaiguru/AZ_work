document.addEventListener('DOMContentLoaded', () => {
  const folderInput = document.getElementById('folder');
  const fileInput = document.getElementById('filename');
  const saveBtn = document.getElementById('save');

  folderInput.value = localStorage.getItem('folder') || '';
  fileInput.value = localStorage.getItem('filename') || 'vacancies.json';

  saveBtn.addEventListener('click', async () => {
    const folder = folderInput.value.trim() || '';
    const filename = fileInput.value.trim() || 'vacancies.json';
    localStorage.setItem('folder', folder);
    localStorage.setItem('filename', filename);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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

    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const path = folder ? `${folder.replace(/\\$/,'')}/${filename}` : filename;
    chrome.downloads.download({ url, filename: path, saveAs: false }, () => {
      URL.revokeObjectURL(url);
      window.close();
    });
  });
});
