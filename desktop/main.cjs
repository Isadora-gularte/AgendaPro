'use strict';
const { app, BrowserWindow, shell } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, 'dist');
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
};

function resolveFile(requestPath) {
  let decoded;
  try { decoded = decodeURIComponent(requestPath); }
  catch { return null; }
  if (decoded.includes('\\') || decoded.includes('\\0')) return null;
  const candidate = path.resolve(root, '.' + decoded);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;
  let file = candidate;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && !path.extname(file)) file += '.html';
  if (!fs.existsSync(file)) file = path.join(root, 'index.html');
  return file;
}

let server = null;
app.whenReady().then(() => {
  server = http.createServer((request, response) => {
    const pathname = (request.url || '/').split('?')[0].split('#')[0];
    const file = resolveFile(pathname);
    if (!file) {
      response.writeHead(403);
      response.end('Acesso negado');
      return;
    }
    fs.readFile(file, (error, bytes) => {
      if (error) {
        response.writeHead(404);
        response.end('Arquivo não encontrado');
        return;
      }
      response.setHeader('Content-Type', contentTypes[path.extname(file).toLowerCase()] || 'application/octet-stream');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.end(bytes);
    });
  });
  server.listen(0, '127.0.0.1', () => {
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const window = new BrowserWindow({
      width: 1120, height: 790, minWidth: 680, minHeight: 540,
      show: false, autoHideMenuBar: true, title: 'Agenda+',
      backgroundColor: '#2a1c18',
      webPreferences: {
        contextIsolation: true, sandbox: true,
        nodeIntegration: false, devTools: false,
      },
    });
    window.once('ready-to-show', () => window.show());
    window.webContents.setWindowOpenHandler(({ url: destination }) => {
      if (destination.startsWith('https://')) void shell.openExternal(destination);
      return { action: 'deny' };
    });
    window.webContents.on('will-navigate', (event, destination) => {
      if (!destination.startsWith(url)) {
        event.preventDefault();
        if (destination.startsWith('https://')) void shell.openExternal(destination);
      }
    });
    void window.loadURL(url);
  });
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});
