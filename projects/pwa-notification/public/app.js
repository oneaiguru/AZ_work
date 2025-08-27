const publicVapidKey = 'BO2catiBPz9_i-1sWVnAvu_novcJLH2jGIuFUfjqoKiihDilIZOOTRMM-NNvCmnFVZPru6648jKp8S7kHaIJIFA';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW registration failed', err));
}

document.getElementById('notify').addEventListener('click', async () => {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    alert('Permission denied');
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
  });

  await fetch('/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription),
    headers: { 'Content-Type': 'application/json' }
  });

  await fetch('/notify', { method: 'POST' });
});

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
