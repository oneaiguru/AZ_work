const express = require('express');
const webpush = require('web-push');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// VAPID keys should be generated only once.
const publicVapidKey = 'BO2catiBPz9_i-1sWVnAvu_novcJLH2jGIuFUfjqoKiihDilIZOOTRMM-NNvCmnFVZPru6648jKp8S7kHaIJIFA';
const privateVapidKey = 'dacUaSaTnzsEx3oWINyCT60p6H8NSiCj_IHEg01bh1I';
webpush.setVapidDetails('mailto:example@example.com', publicVapidKey, privateVapidKey);

// Store subscriptions in memory for demo purposes
const subscriptions = [];

app.post('/subscribe', (req, res) => {
  const subscription = req.body;
  subscriptions.push(subscription);
  res.status(201).json({});
});

app.post('/notify', async (req, res) => {
  const payload = JSON.stringify({ title: 'PWA Notification', body: 'Hello from the server!' });
  const sendPromises = subscriptions.map(sub => webpush.sendNotification(sub, payload).catch(err => console.error(err)));
  await Promise.all(sendPromises);
  res.status(200).json({});
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server started on port ${port}`));
