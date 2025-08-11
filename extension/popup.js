document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('colorButton');
  button.addEventListener('click', () => {
    const color = getRandomColor();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (color) => {
          document.body.style.backgroundColor = color;
        },
        args: [color]
      });
    });
  });
});
