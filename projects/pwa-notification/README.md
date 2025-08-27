# PWA Push Notification Example

This example demonstrates a very small Progressive Web App (PWA) that subscribes a device to push notifications and allows a Node.js server to send a message to it.

## Prerequisites
- Node.js 18+
- npm
- For testing on a real phone the app must be served over **HTTPS**. On `localhost` HTTP is allowed.

## Installation
```bash
npm install
```

## Running
```bash
npm start
```
The server will run on `http://localhost:3000` and serve the contents of the `public` folder.

### Testing on a phone
1. Make sure the phone is on the same network as your development machine.
2. Expose the server through HTTPS using a tunnel such as [ngrok](https://ngrok.com/) or by configuring a TLS certificate.
3. Open the served URL in the phone's browser.
4. Use "Add to home screen" to install the PWA.
5. Tap **Subscribe & Send Notification**. The device will request permission and the server will send a test notification.

## How it works
- `public/app.js` registers a service worker and subscribes to push notifications using the VAPID public key.
- `server.js` stores subscriptions in memory and has two endpoints:
  - `POST /subscribe` – saves a subscription.
  - `POST /notify` – sends a sample push message to all stored subscriptions.

This project is for demonstration purposes only. Do not use the included VAPID keys in production.
