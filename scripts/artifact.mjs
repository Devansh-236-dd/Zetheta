// Composes the claude.ai Artifact page from the normal Vite build (dist/):
// the Artifact host supplies <!doctype>/<html>/<head>/<body>, so the page is
// <title> + font links + inline <style> + #root + inline module script.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
const assets = readdirSync('dist/assets');
const js = readFileSync('dist/assets/' + assets.find((f) => f.endsWith('.js')), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync('dist/assets/' + assets.find((f) => f.endsWith('.css')), 'utf8').replace(/<\/style/gi, '<\\/style');
const html = readFileSync('dist/index.html', 'utf8');
const links = (html.match(/<link rel="(preconnect|stylesheet)"[^>]*>/g) || []).filter((l) => l.includes('fonts.g')).join('\n');
const out = `<title>Zetheta Super App</title>\n${links}\n<style>${css}</style>\n<div id="root"></div>\n<script type="module">${js}</script>\n`;
mkdirSync('dist-artifact', { recursive: true });
writeFileSync('dist-artifact/zetheta-app.html', out);
console.log('artifact page written', (out.length / 1024).toFixed(0) + ' KB');
