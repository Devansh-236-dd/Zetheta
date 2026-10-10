/** Saves a generated file. Inside a claude.ai Artifact viewer this goes through the "downloads" capability
 *  (the viewer confirms); anywhere else it uses a normal browser download. */
type DownloadsNs = { save: (r: { filename: string; data: string | Blob }) => Promise<{ status: string }> };
type ClaudeWin = { claude?: { use: (n: string) => Promise<unknown> } };

let nsPromise: Promise<DownloadsNs | null> | null = null;
function downloadsNs(): Promise<DownloadsNs | null> {
  const c = (window as unknown as ClaudeWin).claude;
  if (!c?.use) return Promise.resolve(null);
  if (!nsPromise) nsPromise = c.use('downloads').then((x) => (x as DownloadsNs) ?? null).catch(() => null);
  return nsPromise;
}

export async function saveFile(filename: string, data: string | Blob, mime = 'text/plain'): Promise<'saved' | 'declined' | 'failed'> {
  const ns = await downloadsNs();
  if (ns) {
    try { await ns.save({ filename, data }); return 'saved'; }
    catch (e) { return (e as { code?: string })?.code === 'declined' ? 'declined' : 'failed'; }
  }
  try {
    const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'saved';
  } catch { return 'failed'; }
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
