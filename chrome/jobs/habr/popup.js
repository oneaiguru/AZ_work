console.debug('Habr jobs plugin script loaded');

window.addEventListener('unload', () => {
  console.debug('Habr jobs plugin stopped');
});

document.addEventListener('DOMContentLoaded', () => {
  console.debug('Habr jobs plugin started');

  const folderInput = document.getElementById('folder');
  const saveBtn = document.getElementById('save');

  folderInput.value = localStorage.getItem('folder') || '';
  console.debug('Loaded initial settings', { folder: folderInput.value });

  saveBtn.addEventListener('click', async () => {
    console.debug('Save button clicked');
    const folder = folderInput.value.trim() || '';
    localStorage.setItem('folder', folder);
    console.debug('Settings saved', { folder });

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

    const saveJob = job => {
      const id = job.url.split('/').filter(Boolean).pop();
      const key = `job_${id}`;
      const now = new Date().toISOString();
      const stored = localStorage.getItem(key);
      let data;
      if (stored) {
        const old = JSON.parse(stored);
        data = { ...old, ...job, firstSeeing: old.firstSeeing, lastSeeing: now };
      } else {
        data = { ...job, firstSeeing: now, lastSeeing: now };
      }
      localStorage.setItem(key, JSON.stringify(data));

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const path = folder ? `${folder.replace(/\\$/,'')}/${id}.json` : `${id}.json`;
      console.debug('Downloading vacancy', { id, path });
      return new Promise(resolve => {
        chrome.downloads.download({ url, filename: path, saveAs: false, conflictAction: 'overwrite' }, downloadId => {
          URL.revokeObjectURL(url);
          resolve(downloadId);
        });
      });
    };

    for (const job of allResults) {
      await saveJob(job);
    }

    console.debug('All vacancies saved, closing popup window');
    window.close();
  });
});
