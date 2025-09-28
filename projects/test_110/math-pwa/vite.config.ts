import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import fs from "node:fs";
import { resolve as resolvePath } from "node:path";

function loadHttpsOptions() {
  const certPath = process.env.VITE_HTTPS_CERT;
  const keyPath = process.env.VITE_HTTPS_KEY;

  if (!certPath || !keyPath) {
    return undefined;
  }

  const resolvedCert = resolvePath(certPath);
  const resolvedKey = resolvePath(keyPath);

  try {
    return {
      cert: fs.readFileSync(resolvedCert),
      key: fs.readFileSync(resolvedKey)
    };
  } catch (error) {
    console.warn(
      "[vite] Не удалось прочитать сертификаты HTTPS. Используется HTTP-сервер.",
      error
    );
    return undefined;
  }
}

export default defineConfig(() => {
  const httpsOptions = loadHttpsOptions();

  return {
    plugins: [
      vue(),
      VitePWA({
        registerType: "autoUpdate",
        devOptions: {
          enabled: true
        },
        manifest: {
          name: "Interior Point Lab",
          short_name: "IP Lab",
          start_url: "/",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#2563eb",
          icons: [
            {
              src: "icons/icon-192.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "icons/icon-512.png",
              sizes: "512x512",
              type: "image/png"
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        "@": "/src"
      }
    },
    server: {
      https: httpsOptions
    },
    preview: {
      https: httpsOptions
    }
  };
});
