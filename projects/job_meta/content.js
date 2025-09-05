chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'runPrompt') {
    runPrompt(msg.text).then(sendResponse);
    return true;
  }
});

async function runPrompt(message) {
  const textarea = document.querySelector('textarea');
  if (!textarea) return null;
  const form = textarea.closest('form');
  const button = form.querySelector('button');
  const initial = document.querySelectorAll('div[data-message-author-role="assistant"]').length;
  textarea.value = message;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  button.click();
  return await new Promise(resolve => {
    const observer = new MutationObserver(() => {
      const messages = document.querySelectorAll('div[data-message-author-role="assistant"]');
      if (messages.length > initial) {
        const last = messages[messages.length - 1];
        const md = last.querySelector('.markdown');
        if (md) {
          observer.disconnect();
          resolve(md.innerText);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}
