'use client';

import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';
import { getBoxFileEmbedLinkAction } from '@/lib/actions/box';
import { rewriteBoxUrlToProxy } from '@/lib/box-proxy-hosts';
import type { BoundingBox } from '@/lib/types';

const BOX_PREVIEW_VERSION = '3.0.0';
const BOX_PREVIEW_JS = `https://cdn01.boxcdn.net/platform/preview/${BOX_PREVIEW_VERSION}/en-US/preview.js`;
const BOX_PREVIEW_CSS = `https://cdn01.boxcdn.net/platform/preview/${BOX_PREVIEW_VERSION}/en-US/preview.css`;

const HIGHLIGHT_CLASS = 'box-citation-highlight';
const OVERLAY_CLASS = 'box-citation-overlay';
const HIGHLIGHT_STYLE_ID = 'box-citation-highlight-style';

function ensureHighlightStyles() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `
    /* DOM-based highlight (strategy 4 fallback) */
    .${HIGHLIGHT_CLASS} {
      background-color: rgba(250, 204, 21, 0.55) !important;
      outline: 2px solid rgba(250, 204, 21, 0.85);
      border-radius: 2px;
      animation: citation-pulse 1.8s ease-in-out 3;
      position: relative;
      z-index: 1;
    }
    @keyframes citation-pulse {
      0%, 100% { background-color: rgba(250, 204, 21, 0.55); outline-color: rgba(250, 204, 21, 0.85); }
      50% { background-color: rgba(250, 204, 21, 0.9); outline-color: rgba(234, 179, 8, 1); }
    }
    /* Override PDF.js find-controller highlight colors to yellow */
    .textLayer .highlight {
      background-color: rgba(250, 204, 21, 0.45) !important;
      border-radius: 2px;
    }
    .textLayer .highlight.selected {
      background-color: rgba(250, 204, 21, 0.75) !important;
      outline: 2px solid rgba(234, 179, 8, 0.9);
      border-radius: 2px;
    }
    .textLayer .highlight.appended {
      background-color: rgba(250, 204, 21, 0.45) !important;
    }
    /* Box Content Preview find bar — hide the search bar UI since we trigger
       find programmatically; only the in-document highlights should show. */
    .bp-doc .bp-find-bar { display: none !important; }
    /* Coordinate-based bounding box overlays (drawn from Box AI reference data) */
    .${OVERLAY_CLASS} {
      position: absolute;
      background-color: rgba(250, 204, 21, 0.30);
      border: 2px solid rgba(234, 179, 8, 0.95);
      border-radius: 3px;
      box-sizing: border-box;
      pointer-events: none;
      z-index: 30;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0);
      animation: citation-pulse 1.8s ease-in-out 3;
    }
  `;
  document.head.appendChild(style);
}

declare global {
  interface Window {
    Box?: {
      Preview: new () => BoxPreviewInstance;
    };
  }
}

interface BoxPreviewInstance {
  show: (fileId: string, accessToken: string, options: Record<string, any>) => void;
  hide: () => void;
  addListener: (event: string, listener: (...args: any[]) => void) => void;
  removeListener: (event: string, listener: (...args: any[]) => void) => void;
  removeAllListeners: () => void;
}

// The viewer returned by the SDK has public methods and also exposes PDF.js
// internals that we can use for find/highlight functionality.
interface BoxViewer {
  setPage: (pageNumber: number) => void;
  // DocBaseViewer.find() - searches for text and highlights it
  find?: (phrase: string, openFindBar?: boolean) => void;
  // Internal PDF.js viewer with eventBus for triggering find without page navigation
  pdfViewer?: {
    eventBus?: {
      dispatch: (eventName: string, data: Record<string, any>) => void;
      on?: (eventName: string, listener: (...args: any[]) => void) => void;
      off?: (eventName: string, listener: (...args: any[]) => void) => void;
    };
    currentPageNumber?: number;
  };
  // Box's find bar wrapper
  findBar?: {
    setFindFieldElValue?: (value: string) => void;
    findFieldHandler?: () => void;
    open?: () => void;
    close?: () => void;
  };
}

export interface BoxContentPreviewHandle {
  setPage: (pageNumber: number) => void;
  highlightText: (text: string, pageNumber: number) => void;
  /**
   * Draw coordinate-based overlay rectangles from Box AI bounding boxes.
   * Navigates to the first box's page and reliably highlights the exact
   * location(s) without depending on re-finding the citation text.
   */
  highlightBoundingBoxes: (boxes: BoundingBox[]) => void;
  clearHighlights: () => void;
}

interface BoxContentPreviewProps {
  fileId: string;
  accessToken: string;
  className?: string;
  onLoad?: () => void;
}

let sdkLoadPromise: Promise<void> | null = null;

function loadBoxPreviewSDK(): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise;
  if (typeof window !== 'undefined' && window.Box?.Preview) {
    return Promise.resolve();
  }

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BOX_PREVIEW_CSS;
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = BOX_PREVIEW_JS;
    script.async = true;
    script.onload = () => {
      if (window.Box?.Preview) {
        resolve();
      } else {
        reject(new Error('Box.Preview not available after script load'));
      }
    };
    script.onerror = () => {
      sdkLoadPromise = null;
      reject(new Error('Failed to load Box Content Preview SDK'));
    };
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

// ── Highlighting strategies ──────────────────────────────────────────

/**
 * Strategy 1: Dispatch a PDF.js find event through the viewer's eventBus.
 * This triggers the built-in PDF.js find controller which highlights all
 * matches with proper styling — no page navigation side effects.
 */
function tryEventBusFind(viewer: BoxViewer, text: string): boolean {
  const eventBus = viewer.pdfViewer?.eventBus;
  if (!eventBus) return false;

  const query = text.substring(0, 120).trim();
  if (!query) return false;

  ensureHighlightStyles();
  eventBus.dispatch('find', {
    source: null,
    type: '',
    query,
    phraseSearch: true,
    caseSensitive: false,
    highlightAll: true,
    findPrevious: false,
  });
  logger.debug('BoxContentPreview: triggered eventBus find', { queryLength: query.length });
  return true;
}

/**
 * Strategy 2: Use the findBar directly (avoids the setPage(1) call in find()).
 */
function tryFindBar(viewer: BoxViewer, text: string): boolean {
  const findBar = viewer.findBar;
  if (!findBar?.setFindFieldElValue || !findBar?.findFieldHandler) return false;

  const query = text.substring(0, 120).trim();
  if (!query) return false;

  ensureHighlightStyles();
  findBar.setFindFieldElValue(query);
  findBar.findFieldHandler();
  logger.debug('BoxContentPreview: triggered findBar search', { queryLength: query.length });
  return true;
}

/**
 * Strategy 3: Use viewer.find() — this calls setPage(1) internally, so
 * the caller must navigate back to the target page afterwards.
 */
function tryViewerFind(viewer: BoxViewer, text: string): boolean {
  if (typeof viewer.find !== 'function') return false;

  const query = text.substring(0, 120).trim();
  if (!query) return false;

  ensureHighlightStyles();
  viewer.find(query, false);
  logger.debug('BoxContentPreview: triggered viewer.find()', { queryLength: query.length });
  return true;
}

/**
 * Strategy 4: DOM-based text layer search. Walk the .textLayer spans on the
 * target page and add a CSS highlight class to matching spans.
 */
function tryDomHighlight(container: HTMLElement, text: string, pageNumber: number): boolean {
  ensureHighlightStyles();
  clearDomHighlights(container);

  const pageEl =
    (container.querySelector(`.page[data-page-number="${pageNumber}"]`) as HTMLElement) ??
    (container.querySelectorAll('.page')[pageNumber - 1] as HTMLElement | undefined);
  if (!pageEl) return false;

  const textLayer = pageEl.querySelector('.textLayer') as HTMLElement | null;
  if (!textLayer) return false;

  const spans = Array.from(textLayer.querySelectorAll('span')) as HTMLSpanElement[];
  if (spans.length === 0) return false;

  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const search = normalize(text);
  if (!search) return false;

  // Build cumulative offset map
  const offsets: number[] = [];
  let fullText = '';
  for (const sp of spans) {
    offsets.push(fullText.length);
    fullText += sp.textContent ?? '';
  }
  const normalFull = normalize(fullText);

  // Try full match first, then progressively shorter prefixes
  let matchStart = normalFull.indexOf(search);
  let matchLen = search.length;

  if (matchStart === -1) {
    const words = search.split(' ');
    for (let len = words.length - 1; len >= 3; len--) {
      const partial = words.slice(0, len).join(' ');
      matchStart = normalFull.indexOf(partial);
      if (matchStart !== -1) {
        matchLen = partial.length;
        break;
      }
    }
    if (matchStart === -1) return false;
  }

  // Map normalized offset → raw offset (whitespace collapsing)
  const normToRaw: number[] = new Array(normalFull.length + 1);
  let ri = 0, ni = 0;
  while (ri <= fullText.length && ni <= normalFull.length) {
    normToRaw[ni] = ri;
    if (ri >= fullText.length || ni >= normalFull.length) break;
    if (fullText[ri].toLowerCase() === normalFull[ni]) { ri++; ni++; }
    else if (/\s/.test(fullText[ri])) { ri++; }
    else { ri++; ni++; }
  }
  for (let i = ni; i <= normalFull.length; i++) {
    if (normToRaw[i] === undefined) normToRaw[i] = fullText.length;
  }

  const rawStart = normToRaw[matchStart] ?? 0;
  const rawEnd = normToRaw[matchStart + matchLen] ?? fullText.length;

  let highlighted = false;
  let scrolledTo = false;
  for (let i = 0; i < spans.length; i++) {
    const sStart = offsets[i];
    const sEnd = sStart + (spans[i].textContent ?? '').length;
    if (sEnd > rawStart && sStart < rawEnd) {
      spans[i].classList.add(HIGHLIGHT_CLASS);
      highlighted = true;
      if (!scrolledTo) {
        spans[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
        scrolledTo = true;
      }
    }
  }
  return highlighted;
}

function clearDomHighlights(container: HTMLElement) {
  container.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => {
    el.classList.remove(HIGHLIGHT_CLASS);
  });
}

/**
 * Coordinate-based bounding box overlays.
 *
 * Box AI reference data returns normalized (0–1) bounding box coordinates
 * relative to each page. Because the Content Preview SDK renders PDF.js pages
 * into our own DOM (same origin in SDK mode), we can position absolute overlay
 * rectangles directly on top of the `.page` elements. This is exact and does
 * not depend on re-finding the citation text.
 */
function locatePageElement(container: HTMLElement, pageNumber: number): HTMLElement | null {
  return (
    (container.querySelector(`.page[data-page-number="${pageNumber}"]`) as HTMLElement | null) ??
    (container.querySelectorAll('.page')[pageNumber - 1] as HTMLElement | undefined) ??
    null
  );
}

function clearOverlays(container: HTMLElement) {
  container.querySelectorAll(`.${OVERLAY_CLASS}`).forEach(el => el.remove());
}

/**
 * Draw overlay rectangles for the given boxes. Returns true if at least one
 * box was drawn (i.e. its target page was rendered and measurable).
 */
function drawOverlays(container: HTMLElement, boxes: BoundingBox[], scrollIntoView: boolean): boolean {
  ensureHighlightStyles();
  clearOverlays(container);

  let drewAny = false;
  let firstEl: HTMLElement | null = null;

  for (const box of boxes) {
    const pageNumber = (box.page_index ?? 0) + 1;
    const pageEl = locatePageElement(container, pageNumber);
    if (!pageEl) continue;

    const w = pageEl.clientWidth;
    const h = pageEl.clientHeight;
    if (!w || !h) continue;

    // PDF.js pages are position: relative, but guard against static.
    if (getComputedStyle(pageEl).position === 'static') {
      pageEl.style.position = 'relative';
    }

    // Box AI returns normalized (0–1) coordinates relative to the page. Guard
    // against occasional out-of-range values so an overlay never spills past
    // the page bounds.
    const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
    if ([box.top_left.x, box.top_left.y, box.bottom_right.x, box.bottom_right.y].some(n => n < 0 || n > 1)) {
      logger.warn('BoxContentPreview: bounding box coordinate outside normalized 0–1 range; clamping', { box });
    }
    const x1 = clamp01(Math.min(box.top_left.x, box.bottom_right.x));
    const y1 = clamp01(Math.min(box.top_left.y, box.bottom_right.y));
    const x2 = clamp01(Math.max(box.top_left.x, box.bottom_right.x));
    const y2 = clamp01(Math.max(box.top_left.y, box.bottom_right.y));

    const div = document.createElement('div');
    div.className = OVERLAY_CLASS;
    div.style.left = `${x1 * w}px`;
    div.style.top = `${y1 * h}px`;
    div.style.width = `${Math.max((x2 - x1) * w, 6)}px`;
    div.style.height = `${Math.max((y2 - y1) * h, 6)}px`;
    pageEl.appendChild(div);

    if (!firstEl) firstEl = div;
    drewAny = true;
  }

  if (firstEl && scrollIntoView) {
    firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return drewAny;
}

/**
 * Clear PDF.js find highlights by dispatching an empty find query.
 */
function clearPdfJsHighlights(viewer: BoxViewer | null) {
  const eventBus = viewer?.pdfViewer?.eventBus;
  if (eventBus) {
    eventBus.dispatch('find', {
      source: null,
      type: '',
      query: '',
      phraseSearch: true,
      caseSensitive: false,
      highlightAll: true,
      findPrevious: false,
    });
  }
}

// ── Component ────────────────────────────────────────────────────────

type PreviewMode = 'loading' | 'sdk' | 'iframe';

const BoxContentPreview = forwardRef<BoxContentPreviewHandle, BoxContentPreviewProps>(
  function BoxContentPreview({ fileId, accessToken, className, onLoad }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<BoxPreviewInstance | null>(null);
    const viewerRef = useRef<BoxViewer | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [mode, setMode] = useState<PreviewMode>('loading');
    const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // The currently displayed bounding boxes, kept so we can redraw them when
    // the page re-renders (lazy render, zoom, resize).
    const activeBoxesRef = useRef<BoundingBox[] | null>(null);

    // Store onLoad in a ref so it never triggers the init effect
    const onLoadRef = useRef(onLoad);
    onLoadRef.current = onLoad;

    // Iframe fallback state
    const [embedUrl, setEmbedUrl] = useState<string | null>(null);
    const [iframeKey, setIframeKey] = useState(0);
    const baseEmbedUrlRef = useRef<string | null>(null);

    const clearHighlights = useCallback(() => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
      if (overlayTimerRef.current) {
        clearTimeout(overlayTimerRef.current);
        overlayTimerRef.current = null;
      }
      activeBoxesRef.current = null;
      clearPdfJsHighlights(viewerRef.current);
      if (containerRef.current) {
        clearDomHighlights(containerRef.current);
        clearOverlays(containerRef.current);
      }
    }, []);

    const highlightText = useCallback((text: string, pageNumber: number) => {
      if (mode !== 'sdk') return;
      const viewer = viewerRef.current;
      if (!viewer) return;

      clearHighlights();

      // Strategy 1: eventBus find (best — no page navigation side effect)
      if (tryEventBusFind(viewer, text)) {
        // Auto-clear after 20s
        highlightTimerRef.current = setTimeout(clearHighlights, 20000);
        return;
      }

      // Strategy 2: findBar direct (good — no page navigation side effect)
      if (tryFindBar(viewer, text)) {
        highlightTimerRef.current = setTimeout(clearHighlights, 20000);
        return;
      }

      // Strategy 3: viewer.find() — causes brief page 1 flash
      if (tryViewerFind(viewer, text)) {
        // find() navigates to page 1; navigate back after a short delay
        highlightTimerRef.current = setTimeout(() => {
          viewer.setPage(pageNumber);
          highlightTimerRef.current = setTimeout(clearHighlights, 20000);
        }, 150);
        return;
      }

      // Strategy 4: DOM text layer (fallback)
      let attempts = 0;
      const tryDom = () => {
        if (!containerRef.current) return;
        const found = tryDomHighlight(containerRef.current, text, pageNumber);
        if (!found && attempts < 15) {
          attempts++;
          highlightTimerRef.current = setTimeout(tryDom, 400);
        } else if (found) {
          highlightTimerRef.current = setTimeout(() => {
            if (containerRef.current) clearDomHighlights(containerRef.current);
          }, 20000);
        }
      };
      highlightTimerRef.current = setTimeout(tryDom, 500);
    }, [mode, clearHighlights]);

    const highlightBoundingBoxes = useCallback((boxes: BoundingBox[]) => {
      if (!boxes || boxes.length === 0) return;

      // Coordinate overlays are only possible in SDK mode (same-origin PDF.js).
      // In iframe fallback we can only navigate to the page.
      if (mode !== 'sdk') {
        const firstPage = (boxes[0].page_index ?? 0) + 1;
        setPage(firstPage);
        logger.warn('BoxContentPreview: bounding box overlays unavailable in iframe mode; navigating to page only', { firstPage });
        return;
      }

      clearHighlights();
      activeBoxesRef.current = boxes;

      const firstPage = (boxes[0].page_index ?? 0) + 1;
      viewerRef.current?.setPage(firstPage);

      // The target page may not be rendered yet (PDF.js renders lazily), so
      // retry until the page element is measurable.
      let attempts = 0;
      const tryDraw = () => {
        if (!containerRef.current) return;
        const ok = drawOverlays(containerRef.current, boxes, true);
        if (!ok && attempts < 20) {
          attempts++;
          overlayTimerRef.current = setTimeout(tryDraw, 300);
        }
      };
      overlayTimerRef.current = setTimeout(tryDraw, 250);
    }, [mode, clearHighlights]);

    // Redraw active overlays when the document re-renders (lazy render, zoom,
    // resize). PDF.js destroys page content on re-render, taking our overlays
    // with it, so we reattach them.
    useEffect(() => {
      if (mode !== 'sdk') return;

      const redraw = () => {
        if (activeBoxesRef.current && containerRef.current) {
          drawOverlays(containerRef.current, activeBoxesRef.current, false);
        }
      };

      const eventBus = viewerRef.current?.pdfViewer?.eventBus;
      const events = ['pagerendered', 'scalechanged', 'rotationchanging'];
      events.forEach(e => eventBus?.on?.(e, redraw));
      window.addEventListener('resize', redraw);

      return () => {
        events.forEach(e => eventBus?.off?.(e, redraw));
        window.removeEventListener('resize', redraw);
      };
    }, [mode]);

    const setPage = useCallback((pageNumber: number) => {
      if (mode === 'sdk' && viewerRef.current) {
        viewerRef.current.setPage(pageNumber);
        logger.debug('BoxContentPreview setPage via SDK', { pageNumber });
      } else if (mode === 'iframe' && baseEmbedUrlRef.current) {
        const url = baseEmbedUrlRef.current.replace(/#.*$/, '') + `#page=${pageNumber}`;
        setEmbedUrl(url);
        setIframeKey(k => k + 1);
        logger.debug('BoxContentPreview setPage via iframe fallback', { pageNumber });
      } else {
        logger.warn('BoxContentPreview setPage called but preview not ready', { pageNumber, mode });
      }
    }, [mode]);

    useImperativeHandle(ref, () => ({ setPage, highlightText, highlightBoundingBoxes, clearHighlights }), [setPage, highlightText, highlightBoundingBoxes, clearHighlights]);

    useEffect(() => {
      if (!fileId || !accessToken) return;

      let mounted = true;
      let container = containerRef.current;

      const initSDK = async (): Promise<boolean> => {
        try {
          await loadBoxPreviewSDK();
          if (!mounted || !window.Box?.Preview || !container) return false;

          return new Promise<boolean>((resolve) => {
            let resolved = false;
            const finish = (success: boolean) => {
              if (resolved) return;
              resolved = true;
              clearTimeout(timeout);
              resolve(success);
            };

            const timeout = setTimeout(() => {
              logger.warn('BoxContentPreview SDK timed out after 20s, falling back to iframe');
              finish(false);
            }, 20000);

            const preview = new window.Box!.Preview();
            previewRef.current = preview;

            preview.addListener('load', (data: { viewer?: BoxViewer; error?: string }) => {
              if (!mounted) { finish(false); return; }
              if (data.error) {
                logger.warn('BoxContentPreview SDK load event error', { error: data.error });
                try { preview.removeAllListeners(); preview.hide(); } catch {}
                previewRef.current = null;
                finish(false);
                return;
              }
              if (data.viewer) {
                viewerRef.current = data.viewer;
                const v = data.viewer as any;
                logger.debug('BoxContentPreview viewer capabilities', {
                  hasFind: typeof v.find === 'function',
                  hasFindBar: !!v.findBar,
                  hasPdfViewer: !!v.pdfViewer,
                  hasEventBus: !!v.pdfViewer?.eventBus,
                });
              }
              finish(true);
            });

            preview.addListener('error', (data: any) => {
              logger.warn('BoxContentPreview SDK error event', {
                error: data?.error || data?.message || JSON.stringify(data),
              });
              try { preview.removeAllListeners(); preview.hide(); } catch {}
              previewRef.current = null;
              finish(false);
            });

            // Rewrite Box URLs to go through our server-side proxy.
            // Path-based: https://api.box.com/2.0/files/123 → /api/box-proxy/api.box.com/2.0/files/123
            const rewriteUrl = rewriteBoxUrlToProxy;

            preview.show(fileId, accessToken, {
              container,
              header: 'none',
              showDownload: false,
              showAnnotations: false,
              requestInterceptor: (request: { url: string; [key: string]: any }) => {
                const original = request.url || '';
                const rewritten = rewriteUrl(original);
                if (rewritten !== original) {
                  request.url = rewritten;
                }
                return request;
              },
            });
          });
        } catch (err) {
          logger.warn('BoxContentPreview SDK init failed, falling back to iframe', {
            error: err instanceof Error ? err.message : String(err),
          });
          return false;
        }
      };

      const initIframeFallback = async () => {
        try {
          const url = await getBoxFileEmbedLinkAction(fileId);
          if (!mounted) return;
          baseEmbedUrlRef.current = url;
          setEmbedUrl(url);
          setMode('iframe');
          setIsLoading(false);
          onLoadRef.current?.();
        } catch (err) {
          if (!mounted) return;
          logger.error('BoxContentPreview iframe fallback also failed', {
            error: err instanceof Error ? err.message : String(err),
          });
          setIsLoading(false);
        }
      };

      const init = async () => {
        setIsLoading(true);
        setMode('loading');

        const sdkSuccess = await initSDK();
        if (!mounted) return;

        if (sdkSuccess) {
          setMode('sdk');
          setIsLoading(false);
          onLoadRef.current?.();
        } else {
          if (container) {
            while (container.firstChild) {
              container.removeChild(container.firstChild);
            }
          }
          await initIframeFallback();
        }
      };

      init();

      return () => {
        mounted = false;
        viewerRef.current = null;
        if (highlightTimerRef.current) {
          clearTimeout(highlightTimerRef.current);
        }
        if (previewRef.current) {
          try {
            previewRef.current.removeAllListeners();
            previewRef.current.hide();
          } catch {}
          previewRef.current = null;
        }
        if (container) {
          while (container.firstChild) {
            container.removeChild(container.firstChild);
          }
        }
      };
    // onLoad is stored in onLoadRef to avoid triggering re-init when
    // the parent passes an unstable callback reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileId, accessToken]);

    return (
      <div className={`relative ${className ?? ''}`} style={{ height: '100%', width: '100%' }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {/* SDK mode: preview renders into this container */}
        <div
          ref={containerRef}
          className="bp-container"
          style={{
            height: '100%',
            width: '100%',
            display: mode === 'sdk' || mode === 'loading' ? 'block' : 'none',
          }}
        />

        {/* Iframe fallback mode */}
        {mode === 'iframe' && embedUrl && (
          <iframe
            key={iframeKey}
            src={embedUrl}
            className="h-full w-full"
            title="PDF Preview"
            tabIndex={-1}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox allow-downloads allow-modals"
          />
        )}
      </div>
    );
  }
);

export default BoxContentPreview;
