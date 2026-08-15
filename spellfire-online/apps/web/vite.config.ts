import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, join, normalize, parse, sep } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';

/** Walk up from `startDir` to find the CrossFire checkout (has Graphics/Cards). */
function findCrossfireDir(startDir: string): string | null {
  let dir = startDir;
  const { root } = parse(dir);
  for (;;) {
    if (existsSync(join(dir, 'Graphics', 'Cards'))) return dir;
    if (dir === root) return null;
    dir = dirname(dir);
  }
}

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.png': 'image/png',
};

/**
 * Dev-only middleware that serves legacy CrossFire art under `/legacy/...`
 * (e.g. `/legacy/Graphics/Cards/1st/001.jpg`) straight from the CrossFire
 * checkout, so we don't have to copy ~4k images into the app. Restricted to
 * the `Graphics/` subtree. Production image hosting is a later step.
 */
function legacyMedia(): Plugin {
  const crossfireDir = findCrossfireDir(process.cwd());
  return {
    name: 'spellfire-legacy-media',
    configureServer(server) {
      server.middlewares.use('/legacy', (req, res, next) => {
        if (!crossfireDir || !req.url) return next();
        const rawPath = req.url.split('?')[0] ?? '';
        const rel = normalize(decodeURIComponent(rawPath)).replace(/^([/\\])+/, '');
        if (!rel.startsWith(`Graphics${sep}`) && !rel.startsWith('Graphics/')) return next();
        const file = join(crossfireDir, rel);
        if (!file.startsWith(join(crossfireDir, 'Graphics'))) return next();
        if (!existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          return res.end('Not found');
        }
        const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
        res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'max-age=3600');
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), legacyMedia()],
  server: {
    host: true,
    port: 5173,
    // Proxy API calls to the Fastify server so the browser stays same-origin.
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:8787', ws: true, changeOrigin: true },
    },
  },
});
