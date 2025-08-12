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

    let allResults = [];
    while (true) {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          const delay = ms => new Promise(r => setTimeout(r, ms));
          const toMarkdown = html => {
            const container = document.createElement('div');
            container.innerHTML = html;
            const lines = [];
            container.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li').forEach(el => {
              const text = el.textContent.trim();
              if (!text) return;
              if (/H[1-6]/.test(el.tagName)) {
                const level = Number(el.tagName[1]);
                lines.push('#'.repeat(level) + ' ' + text);
              } else if (el.tagName === 'LI') {
                lines.push('- ' + text);
              } else {
                lines.push(text);
              }
            });
            return lines.join('\n');
          };

          const cards = Array.from(document.querySelectorAll('.vacancy-card'));
          const data = [];
          for (const card of cards) {
            const titleEl = card.querySelector('.vacancy-card__title-link');
            const companyEl = card.querySelector('.vacancy-card__company');
            const metaEl = card.querySelector('.vacancy-card__meta');
            const skillsEl = card.querySelector('.vacancy-card__skills');
            const salaryEl = card.querySelector('.vacancy-card__salary');

            const url = titleEl ? titleEl.href : '';
            const w = window.open(url, '_blank');
            await new Promise(res => w.addEventListener('load', res, { once: true }));
            const descEl = w.document.querySelector('.basic-section--appearance-vacancy-description');
            const md = descEl ? toMarkdown(descEl.innerHTML) : '';
            w.close();

            data.push({
              title: titleEl ? titleEl.textContent.trim() : '',
              url: url ? new URL(url).pathname : '',
              company: companyEl ? companyEl.textContent.trim() : '',
              meta: metaEl ? metaEl.textContent.trim() : '',
              skills: skillsEl ? skillsEl.textContent.trim() : '',
              salary: salaryEl ? salaryEl.textContent.trim() : '',
              description: md
            });

            await delay(3000 + Math.random() * 2000);
          }

          const nextLink = document.querySelector('a.button-comp.button-comp--appearance-pagination-button[rel="next"]') || document.querySelector('a.button-comp.button-comp--appearance-pagination-button[href*="page="]');
          return { items: data, nextUrl: nextLink ? nextLink.href : null };
        }
      });
      allResults = allResults.concat(result.items);
      console.debug(`Processed ${result.items.length} vacancies on page`, result);
      if (result.nextUrl) {
        await chrome.tabs.update(tab.id, { url: result.nextUrl });
        await new Promise(resolve => {
          const listener = (tabId, info) => {
            if (tabId === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
      } else {
        break;
      }
    }

    const blob = new Blob([JSON.stringify(allResults, null, 2)], { type: 'application/json' });
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
