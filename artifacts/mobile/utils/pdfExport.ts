/**
 * pdfExport.ts — Marksheet & Admit Card PDF export helpers.
 *
 * Web strategy (pixel-perfect, CDN-free, auto-download):
 *
 *  PRE-PROCESSING (before the iframe is created):
 *   1. Replace every api.qrserver.com <img> src with a client-side QR data-URL
 *      so the image is already embedded when the iframe loads — no CORS, no timing race.
 *   2. Fetch the Google Fonts CSS and every referenced font file; embed each as a
 *      base64 @font-face data-URL and inject a single <style> block.  Removes all
 *      external <link> font tags so foreignObjectRendering never sees a remote URL.
 *
 *  CAPTURE:
 *   3. Load the prepared HTML into a hidden same-origin srcdoc iframe (1024 × 3000 px).
 *   4. Wait for all <img> elements to finish loading (complete flag + onload events).
 *   5. Wait for document.fonts.ready + 1.2 s layout settle.
 *   6. Run html2canvas with foreignObjectRendering:true so the actual browser CSS engine
 *      renders the element — exact fonts, gradients, border-radius, box-shadow, etc.
 *   7. Use el.offsetWidth / el.offsetHeight (includes border) — NOT scrollWidth which
 *      excludes the border and causes right/bottom edges to be clipped.
 *   8. If the canvas comes back blank (foreignObject bug in some browsers), retry with
 *      foreignObjectRendering:false as a safe fallback.
 *   9. Export as PNG (lossless) inside A4 jsPDF and return a Blob URL.
 *
 *  Native strategy: expo-print + expo-file-system (saves directly to device).
 */

import { Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';

/* ─── Type stubs (dynamic imports keep native bundle clean) ───────────────── */

type Html2CanvasStatic = (
  element: HTMLElement,
  options?: Record<string, unknown>,
) => Promise<HTMLCanvasElement>;

type JsPDFClass = new (opts: { unit: string; format: string; orientation: string }) => {
  addPage(): void;
  addImage(data: string, format: string, x: number, y: number, w: number, h: number): void;
  output(type: 'blob'): Blob;
};

interface QRCodeStatic {
  toDataURL(text: string, options?: Record<string, unknown>): Promise<string>;
}

/* ─── Internal helpers ────────────────────────────────────────────────────── */

/** Safe ArrayBuffer → base64 in chunks (avoids call-stack overflow on large fonts). */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return btoa(binary);
}

/**
 * Create a generated PDF download without navigating the current page.
 *
 * jsPDF.save() delegates to FileSaver and can fall back to opening the PDF
 * viewer in a new tab when repeated downloads are triggered from a proxied
 * preview. An explicit Blob URL + download anchor keeps the app page in place
 * and works consistently for subsequent downloads.
 */
function downloadPdfBlob(
  pdf: { output(type: 'blob'): Blob },
  filename: string,
  triggerDownload = true,
): string {
  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);

  if (triggerDownload) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => anchor.remove(), 0);
  }

  // Keep the URL alive so callers can offer a genuine user-gesture fallback.
  return url;
}

/**
 * Replace every api.qrserver.com URL in the HTML string with a QR data-URL
 * generated client-side.  Must run BEFORE the iframe is created so the image
 * is fully loaded the instant the iframe renders — no CORS, no timing race.
 */
async function preEmbedQrCodes(html: string, QRCode: QRCodeStatic): Promise<string> {
  // Match bare URLs appearing in src="…" or similar attributes
  const QR_RE = /https:\/\/api\.qrserver\.com\/v1\/create-qr-code\/\?[^"'\s<>]*/g;
  const urls = [...new Set(html.match(QR_RE) ?? [])];
  if (urls.length === 0) return html;

  console.log('[PDF] Pre-embedding', urls.length, 'QR code(s)…');

  for (const url of urls) {
    try {
      const qs = url.split('?')[1] ?? '';
      const params = new URLSearchParams(qs);
      const data = params.get('data');
      if (!data) { console.warn('[PDF] QR URL has no ?data= param:', url.slice(0, 80)); continue; }

      const rawSize = parseInt(params.get('size')?.split('x')[0] ?? '90', 10) || 90;
      const colorRaw = params.get('color') ?? '000000';
      const dark = colorRaw.startsWith('#') ? colorRaw : `#${colorRaw}`;

      const dataUrl = await QRCode.toDataURL(decodeURIComponent(data), {
        width: Math.max(rawSize * 3, 270), // 3× for high-res output
        margin: 1,
        color: { dark, light: '#FFFFFF' },
        errorCorrectionLevel: 'M',
      });

      // Replace every occurrence of this URL in the HTML string
      html = html.split(url).join(dataUrl);
      console.log('[PDF] QR embedded for:', decodeURIComponent(data).slice(0, 50));
    } catch (e) {
      console.warn('[PDF] QR embed failed for', url.slice(0, 80), '—', e);
    }
  }
  return html;
}

/**
 * Fetch Google Fonts CSS and all referenced font files; replace remote URLs with
 * base64 data-URLs; inject as an inline <style> block; remove the <link> tags.
 * Falls back gracefully (returns original HTML) on any network error.
 */
async function embedGoogleFonts(html: string): Promise<string> {
  // Collect all Google Fonts <link href="…"> URLs from the HTML
  const LINK_RE = /<link[^>]+href="(https:\/\/fonts\.googleapis\.com[^"]+)"[^>]*>/gi;
  const fontLinks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = LINK_RE.exec(html)) !== null) fontLinks.push(m[1]);
  if (fontLinks.length === 0) return html;

  console.log('[PDF] Embedding', fontLinks.length, 'Google Fonts stylesheet(s)…');

  const fetched: string[] = [];

  for (const cssUrl of fontLinks) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 7000);
      const resp = await fetch(cssUrl, {
        signal: ctl.signal,
        // Identify as a modern browser so Google Fonts returns woff2
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' },
      });
      clearTimeout(t);
      if (!resp.ok) { console.warn('[PDF] Font CSS fetch failed:', resp.status, cssUrl.slice(0, 80)); continue; }

      let css = await resp.text();

      // Find every font file URL inside url(…) declarations
      const fileUrls = [...new Set([...css.matchAll(/url\((https?:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(fm => fm[1]))];
      console.log('[PDF] Fetching', fileUrls.length, 'font file(s)…');

      await Promise.all(fileUrls.map(async fileUrl => {
        try {
          const fc = new AbortController();
          const ft = setTimeout(() => fc.abort(), 7000);
          const fr = await fetch(fileUrl, { signal: fc.signal });
          clearTimeout(ft);
          if (!fr.ok) return;
          const buf = await fr.arrayBuffer();
          const b64 = arrayBufferToBase64(buf);
          const mime = fileUrl.includes('.woff2') ? 'font/woff2'
                     : fileUrl.includes('.woff')  ? 'font/woff'
                     :                              'font/ttf';
          css = css.split(fileUrl).join(`data:${mime};base64,${b64}`);
        } catch { /* keep remote URL as fallback for this one file */ }
      }));

      fetched.push(css);
    } catch (e) {
      console.warn('[PDF] Font CSS embed failed:', e);
    }
  }

  if (fetched.length === 0) {
    console.warn('[PDF] No fonts embedded — rendering will use browser-cached fonts');
    return html;
  }

  // Remove all Google Fonts <link> and associated preconnect <link> tags
  let result = html
    .replace(/<link[^>]+fonts\.googleapis\.com[^>]*>/gi, '')
    .replace(/<link[^>]+rel="preconnect"[^>]+>/gi, '');

  // Inject inline @font-face block just before </head>
  const inlineStyle = `<style>\n/* ─── Embedded Google Fonts (base64) ─── */\n${fetched.join('\n')}\n</style>`;
  result = result.replace('</head>', `${inlineStyle}\n</head>`);

  console.log('[PDF] Google Fonts embedded ✓');
  return result;
}

/**
 * Poll until every <img> in the document has loaded (or the timeout expires).
 */
async function waitForImages(doc: Document, timeoutMs = 10_000): Promise<void> {
  const imgs = Array.from(doc.images) as HTMLImageElement[];
  const pending = imgs.filter(img => !img.complete);
  if (pending.length === 0) { console.log('[PDF] All images already complete'); return; }

  console.log('[PDF] Waiting for', pending.length, 'image(s) to load…');
  await Promise.race([
    Promise.all(pending.map(img => new Promise<void>(resolve => {
      img.onload = img.onerror = () => resolve();
    }))),
    new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
  ]);
  const still = (Array.from(doc.images) as HTMLImageElement[]).filter(img => !img.complete).length;
  if (still > 0) console.warn('[PDF]', still, 'image(s) still not complete after timeout');
}

/** Detect if a canvas is entirely white (signals a failed foreignObjectRendering). */
function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    // Sample a 50×50 block from the top-left to decide quickly
    const { data } = ctx.getImageData(0, 0, Math.min(canvas.width, 50), Math.min(canvas.height, 50));
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) return false;
    }
    return true;
  } catch {
    return false; // cannot sample — assume not blank
  }
}

/* ─── Public API ──────────────────────────────────────────────────────────── */

/**
 * Convert an HTML document string to a pixel-perfect A4 PDF and trigger an
 * automatic browser download (web) or share-sheet (native).
 *
 * @param html           Full HTML document string.
 * @param filename       Download filename WITHOUT the .pdf extension.
 * @param pageSelector   CSS selector for page container(s). Default: '.page'.
 * @param _qrImgSelector Kept for API compatibility — QR replacement now happens
 *                       in the pre-processing stage on the raw HTML string.
 */
export async function downloadHtmlAsPdf(
  html: string,
  filename: string,
  pageSelector = '.page',
  _qrImgSelector = 'img[alt="QR Code"],img[alt="QR"]',
  triggerDownload = true,
): Promise<string | null> {
  /* ── Native path ─────────────────────────────────────────────────────── */
  if (Platform.OS !== 'web') {
    console.log('[PDF] Native path — expo-print');
    const { uri } = await Print.printToFileAsync({ html });
    const safeName = filename.replace(/['"\\<>]/g, '').trim();
    const destUri = `${FileSystem.documentDirectory}${safeName}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: destUri });
    Alert.alert('PDF Saved', `"${safeName}.pdf" has been saved to your Files app.`);
    return destUri;
  }

  /* ── Web path ────────────────────────────────────────────────────────── */
  const safeName = filename.replace(/['"\\<>]/g, '').trim();
  console.log('[PDF] ── Starting generation for:', safeName, '──');

  /* Load npm deps */
  const [h2cMod, jspdfMod, qrMod] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
    import('qrcode'),
  ]);
  const html2canvas = (h2cMod.default ?? h2cMod) as Html2CanvasStatic;
  const JsPDF       = (jspdfMod.jsPDF ?? jspdfMod.default) as JsPDFClass;
  const QRCode      = (qrMod.default  ?? qrMod)  as QRCodeStatic;
  console.log('[PDF] Deps loaded');

  /* ── Step 1: Pre-process HTML ──────────────────────────────────────────
     Do this BEFORE creating the iframe so every image is already a data-URL
     when the iframe parses the HTML — zero network requests inside iframe.    */
  let preparedHtml = await preEmbedQrCodes(html, QRCode);
  preparedHtml     = await embedGoogleFonts(preparedHtml);

  /* ── Step 2: Hidden iframe ─────────────────────────────────────────── */
  // A4 at 96 CSS-px/inch: 210 mm = 794 px wide, 297 mm = 1123 px tall.
  // The iframe must be EXACTLY 794 px wide so the .page/.pg element fills
  // 100 % of the viewport — no centring margin, no white space on the sides.
  // A wider viewport (e.g. 1024 px) leaves ~115 px of white on each side
  // which html2canvas (especially foreignObjectRendering) captures and embeds
  // into the PDF, producing a marksheet that is only ~77 % of page width.
  const A4_PX_W = 794;   // 210 mm × (96 / 25.4) = 793.7 → 794 px
  const A4_PX_H = 1123;  // 297 mm × (96 / 25.4) = 1122.5 → 1123 px

  const iframe = document.createElement('iframe');
  iframe.style.cssText = [
    'position:fixed', 'left:0', 'top:0',
    `width:${A4_PX_W}px`,   // exact A4 width — page element fills 100 %
    // Tall enough to hold any number of pages in its scroll canvas.
    // The visible viewport of the iframe is used by foreignObjectRendering;
    // we scroll to each page element before capture so it sits at top:0.
    'height:20000px',
    'opacity:0', 'pointer-events:none',
    'z-index:-9999', 'border:none',
  ].join(';');
  document.body.appendChild(iframe);

  try {
    /* ── Step 3: Load HTML ─────────────────────────────────────────────── */
    console.log('[PDF] Loading prepared HTML into iframe…');
    await new Promise<void>((resolve, reject) => {
      const tid = setTimeout(() => reject(new Error('iframe load timed out (20 s)')), 20_000);
      iframe.onload = () => { clearTimeout(tid); console.log('[PDF] iframe load event fired'); resolve(); };
      iframe.srcdoc = preparedHtml;
    });

    const iDoc = iframe.contentDocument;
    if (!iDoc) throw new Error('iframe contentDocument is null — possible origin block');

    /* ── Step 3b: Remove body padding so every .page starts at y=0 ──────
       The source HTML has `body { padding: 28px 0 }` for on-screen display.
       During PDF capture we need the page element to sit flush at the top so
       that scrolling to each element puts it exactly at viewport-top:0 with
       no gap, and foreignObjectRendering clips nothing from the header.        */
    const resetStyle = iDoc.createElement('style');
    resetStyle.textContent =
      'html,body{padding:0!important;margin:0!important;background:#ffffff!important;}' +
      '.page-wrap{margin-bottom:0!important;}';
    iDoc.head.appendChild(resetStyle);

    /* ── Step 4: Wait for images ───────────────────────────────────────── */
    await waitForImages(iDoc);

    /* ── Step 5: Wait for fonts + layout settle ────────────────────────── */
    try {
      await (iDoc as Document & { fonts: FontFaceSet }).fonts.ready;
      console.log('[PDF] Fonts ready');
    } catch (e) {
      console.warn('[PDF] fonts.ready threw, continuing:', e);
    }
    // Extra time for font rendering, layout shifts, CSS transitions
    await new Promise(r => setTimeout(r, 1200));

    /* ── Step 6: Locate page containers ────────────────────────────────── */
    const pageEls = Array.from(iDoc.querySelectorAll(pageSelector)) as HTMLElement[];
    console.log('[PDF]', pageEls.length, `page element(s) found for "${pageSelector}"`);
    if (pageEls.length === 0) {
      const available = Array.from(iDoc.querySelectorAll('[class]'))
        .slice(0, 12).map(el => (el as HTMLElement).className).join(', ');
      throw new Error(
        `No element matched selector "${pageSelector}".\nAvailable classes: ${available}`,
      );
    }

    /* ── Step 7: Capture + build PDF ───────────────────────────────────── */
    const pdf    = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const A4_W   = 210;
    const A4_H   = 297;
    const SCALE  = 3; // ≈288 DPI (A4 at 96 CSS-px/in → 794px × 3 = 2382px canvas)

    for (let i = 0; i < pageEls.length; i++) {
      const el = pageEls[i];

      /* ── Scroll the iframe so this page element sits at the very top ──────
         This guarantees foreignObjectRendering sees the element at viewport
         y=0 with no negative offset, no body-padding gap, and no scroll drift.
         We use el.offsetTop (absolute position in document after padding reset)
         so every page — including pages 2, 3, … — is captured from the top.  */
      const iWin = iframe.contentWindow;
      if (iWin) {
        iWin.scrollTo({ top: el.offsetTop, left: 0, behavior: 'instant' as ScrollBehavior });
        // Small settle delay so layout, sticky elements and fonts re-render
        // at the new scroll position before html2canvas reads the DOM.
        await new Promise(r => setTimeout(r, 150));
      }

      /* offsetWidth/offsetHeight includes the border (5 px each side on .page).
         scrollWidth EXCLUDES the border — using it would clip the right + bottom edge. */
      const elW = el.offsetWidth  || 794;
      const elH = el.offsetHeight || 1123;

      console.log(
        `[PDF] Page ${i + 1}/${pageEls.length}:`,
        `<${el.tagName.toLowerCase()}${el.id ? '#'+el.id : ''}${el.className ? '.'+el.className.split(' ').join('.') : ''}>`,
        `${elW}×${elH}px  scale:${SCALE}`,
      );

      const captureOpts: Record<string, unknown> = {
        scale             : SCALE,
        useCORS           : true,
        allowTaint        : false,
        logging           : false,
        backgroundColor   : '#ffffff',
        width             : elW,   // ← offsetWidth: includes border
        height            : elH,   // ← offsetHeight: includes border
        // windowWidth must match the actual iframe width (794 px = A4 at 96 dpi).
        // A mismatch (e.g. 1024) makes foreignObjectRendering centre the .page
        // element with side margins, so the crop rect is offset and the header
        // gets clipped from the top/left.
        windowWidth       : A4_PX_W,
        // windowHeight = element height; tells html2canvas the render surface
        // height so it doesn't over-clip the bottom of tall pages.
        windowHeight      : elH,
        imageTimeout      : 12_000,
        // foreignObjectRendering:true uses the REAL browser CSS engine →
        // exact rendering of fonts, gradients, box-shadow, border-radius, etc.
        foreignObjectRendering: true,
      };

      let canvas = await html2canvas(el, captureOpts);
      console.log(`[PDF] Canvas ${i + 1}: ${canvas.width}×${canvas.height}px`);

      // Safety net: if foreignObjectRendering produced a blank white canvas
      // (known bug in some Chromium versions), retry without it.
      if (isCanvasBlank(canvas)) {
        console.warn('[PDF] Canvas appears blank — retrying with foreignObjectRendering:false');
        canvas = await html2canvas(el, {
          ...captureOpts,
          foreignObjectRendering: false,
          allowTaint            : true,
          useCORS               : false,
        });
        console.log(`[PDF] Fallback canvas: ${canvas.width}×${canvas.height}px`);
      }

      if (i > 0) pdf.addPage();

      // PNG preserves colours perfectly; no JPEG compression artefacts on text/borders.
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, A4_W, A4_H);
    }

    console.log('[PDF] Saving:', `${safeName}.pdf`);
    return downloadPdfBlob(pdf, `${safeName}.pdf`, triggerDownload);
    console.log('[PDF] Done ✓');

  } catch (err) {
    console.error('[PDF] Generation failed:', err);
    throw err; // caller shows the actual message in an Alert
  } finally {
    // Always clean up the hidden iframe
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }
}

/**
 * Generate a multi-page PDF from an array of individual HTML document strings,
 * one per student / record.  Each page is rendered in its own fresh iframe so
 * that QR codes, the Academic Session badge, the school logo, fonts, and every
 * header element are fully loaded before capture — eliminating the blank-header
 * problem that occurs when all pages share a single DOM.
 *
 * Strategy per page:
 *  1. Pre-embed QR codes (client-side, unique per student).
 *  2. Inject pre-fetched Google Font CSS (fetched once from the first page).
 *  3. Load the prepared HTML into a fresh hidden same-origin srcdoc iframe.
 *  4. Inject a body-padding reset so the .page sits flush at y=0.
 *  5. await all <img> complete + document.fonts.ready + 1.2 s settle.
 *  6. Scroll iframe to el.offsetTop so element is at viewport-top.
 *  7. html2canvas capture at scale 3 (≈288 DPI), windowWidth=794.
 *  8. Blank-canvas safety retry without foreignObjectRendering.
 *  9. Add PNG to jsPDF, destroy iframe, proceed to next page.
 *
 * @param htmlPages    Array of full HTML document strings, one per student.
 * @param filename     Download filename WITHOUT the .pdf extension.
 * @param pageSelector CSS selector for the page container. Default: '.page'.
 */
export async function downloadMultipleHtmlsAsPdf(
  htmlPages: string[],
  filename: string,
  pageSelector = '.page',
  triggerDownload = true,
): Promise<string | null> {
  if (htmlPages.length === 0) return null;

  /* ── Native path: delegate to expo-print ──────────────────────────────── */
  if (Platform.OS !== 'web') {
    console.log('[PDF] Native bulk path — expo-print');
    const combined = htmlPages.join('\n');
    const { uri } = await Print.printToFileAsync({ html: combined });
    const safeName = filename.replace(/['"\\<>]/g, '').trim();
    const destUri = `${FileSystem.documentDirectory}${safeName}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: destUri });
    Alert.alert('PDF Saved', `"${safeName}.pdf" has been saved to your Files app.`);
    return destUri;
  }

  /* ── Single page: reuse the existing single-page pipeline ─────────────── */
  if (htmlPages.length === 1) {
    return downloadHtmlAsPdf(htmlPages[0], filename, pageSelector, 'img[alt="QR Code"],img[alt="QR"]', triggerDownload);
  }

  const safeName = filename.replace(/['"\\<>]/g, '').trim();
  console.log('[PDF] ── Bulk generation:', safeName, `(${htmlPages.length} pages) ──`);

  /* ── Load deps once ───────────────────────────────────────────────────── */
  const [h2cMod, jspdfMod, qrMod] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
    import('qrcode'),
  ]);
  const html2canvas = (h2cMod.default ?? h2cMod) as Html2CanvasStatic;
  const JsPDF       = (jspdfMod.jsPDF ?? jspdfMod.default) as JsPDFClass;
  const QRCode      = (qrMod.default  ?? qrMod)  as QRCodeStatic;
  console.log('[PDF] Deps loaded');

  /* ── Fetch & embed Google Fonts once (all pages share identical fonts) ── */
  console.log('[PDF] Pre-fetching Google Fonts from first page…');
  const firstWithFonts = await embedGoogleFonts(htmlPages[0]);
  // Extract just the injected <style>…</style> block so we can reuse it
  const fontStyleMatch = firstWithFonts.match(
    /<style>\s*\/\* ─── Embedded Google Fonts[\s\S]*?<\/style>/,
  );
  const cachedFontStyle: string | null = fontStyleMatch ? fontStyleMatch[0] : null;
  console.log('[PDF] Fonts pre-fetched:', cachedFontStyle ? 'ok' : 'skipped (will embed per-page)');

  /* ── Helper: prepare one page's HTML (QR + fonts) ────────────────────── */
  async function prepareSinglePage(html: string): Promise<string> {
    // 1. Embed this student's unique QR code as a data-URL
    let prepared = await preEmbedQrCodes(html, QRCode);

    // 2. Inject fonts — use cached CSS to avoid re-fetching for every student
    if (cachedFontStyle) {
      prepared = prepared
        .replace(/<link[^>]+fonts\.googleapis\.com[^>]*>/gi, '')
        .replace(/<link[^>]+rel="preconnect"[^>]+>/gi, '');
      prepared = prepared.replace('</head>', `${cachedFontStyle}\n</head>`);
    } else {
      prepared = await embedGoogleFonts(prepared);
    }
    return prepared;
  }

  /* ── Helper: render one prepared HTML string → canvas ────────────────── */
  const A4_PX_W = 794;
  const A4_PX_H = 1123;
  const SCALE   = 3;

  async function capturePageCanvas(preparedHtml: string, pageNum: number): Promise<HTMLCanvasElement> {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = [
      'position:fixed', 'left:0', 'top:0',
      `width:${A4_PX_W}px`,
      'height:20000px',           // tall so all content renders in the scroll canvas
      'opacity:0', 'pointer-events:none',
      'z-index:-9999', 'border:none',
    ].join(';');
    document.body.appendChild(iframe);

    try {
      /* Load HTML into fresh iframe */
      await new Promise<void>((resolve, reject) => {
        const tid = setTimeout(
          () => reject(new Error(`iframe load timed out (page ${pageNum})`)),
          20_000,
        );
        iframe.onload = () => { clearTimeout(tid); resolve(); };
        iframe.srcdoc = preparedHtml;
      });

      const iDoc = iframe.contentDocument;
      if (!iDoc) throw new Error(`iframe contentDocument is null (page ${pageNum})`);

      /* Remove body padding so .page sits at y=0 with no gap above the header */
      const resetStyle = iDoc.createElement('style');
      resetStyle.textContent =
        'html,body{padding:0!important;margin:0!important;background:#ffffff!important;}' +
        '.page-wrap{margin-bottom:0!important;}';
      iDoc.head.appendChild(resetStyle);

      /* Wait for all <img> elements (logo, QR, crest SVG converted images) */
      await waitForImages(iDoc);

      /* Wait for fonts */
      try {
        await (iDoc as Document & { fonts: FontFaceSet }).fonts.ready;
        console.log(`[PDF] Page ${pageNum}: fonts ready`);
      } catch (e) {
        console.warn(`[PDF] Page ${pageNum}: fonts.ready threw, continuing:`, e);
      }

      /* Extra settle for font rendering, layout shifts, CSS transitions */
      await new Promise(r => setTimeout(r, 1200));

      /* Find the .page container */
      const el = iDoc.querySelector(pageSelector) as HTMLElement | null;
      if (!el) {
        const avail = Array.from(iDoc.querySelectorAll('[class]'))
          .slice(0, 12).map(e => (e as HTMLElement).className).join(', ');
        throw new Error(
          `Page ${pageNum}: no element matched "${pageSelector}". Classes: ${avail}`,
        );
      }

      /* Scroll element to viewport top — eliminates any body-padding offset */
      const iWin = iframe.contentWindow;
      if (iWin) {
        iWin.scrollTo({ top: el.offsetTop, left: 0, behavior: 'instant' as ScrollBehavior });
        await new Promise(r => setTimeout(r, 150));
      }

      const elW = el.offsetWidth  || A4_PX_W;
      const elH = el.offsetHeight || A4_PX_H;
      console.log(`[PDF] Page ${pageNum}: capturing ${elW}×${elH}px at scale ${SCALE}`);

      const captureOpts: Record<string, unknown> = {
        scale                : SCALE,
        useCORS              : true,
        allowTaint           : false,
        logging              : false,
        backgroundColor      : '#ffffff',
        width                : elW,
        height               : elH,
        windowWidth          : A4_PX_W,  // must match iframe width exactly
        windowHeight         : elH,
        imageTimeout         : 12_000,
        foreignObjectRendering: true,
      };

      let canvas = await html2canvas(el, captureOpts);
      console.log(`[PDF] Page ${pageNum}: canvas ${canvas.width}×${canvas.height}px`);

      /* Blank-canvas safety net (known foreignObject bug in some Chromium builds) */
      if (isCanvasBlank(canvas)) {
        console.warn(`[PDF] Page ${pageNum}: blank canvas — retrying without foreignObjectRendering`);
        canvas = await html2canvas(el, {
          ...captureOpts,
          foreignObjectRendering: false,
          allowTaint            : true,
          useCORS               : false,
        });
        console.log(`[PDF] Page ${pageNum}: fallback canvas ${canvas.width}×${canvas.height}px`);
      }

      return canvas;

    } finally {
      /* Always remove the iframe — even on error — to avoid DOM leaks */
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }
  }

  /* ── Build PDF page-by-page ───────────────────────────────────────────── */
  const A4_W = 210;
  const A4_H = 297;
  const pdf  = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  for (let i = 0; i < htmlPages.length; i++) {
    console.log(`[PDF] ── Page ${i + 1}/${htmlPages.length} ──`);

    const preparedHtml = await prepareSinglePage(htmlPages[i]);
    const canvas       = await capturePageCanvas(preparedHtml, i + 1);

    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, A4_W, A4_H);
    console.log(`[PDF] Page ${i + 1} added to PDF ✓`);
  }

  console.log('[PDF] Saving:', `${safeName}.pdf`);
  return downloadPdfBlob(pdf, `${safeName}.pdf`, triggerDownload);
  console.log('[PDF] Bulk done ✓');
}

/**
 * Open the system print dialog for an HTML document string.
 * (Unchanged — not affected by PDF pipeline changes.)
 */
export async function printHtml(html: string): Promise<void> {
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  } else {
    await Print.printAsync({ html });
  }
}
