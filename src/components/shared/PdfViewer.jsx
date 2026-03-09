import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
} from "react";
import * as pdfjsLib from "pdfjs-dist";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const SYNC_THROTTLE_MS = 80;
const GESTURE_COMMIT_DELAY = 200;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/**
 * PdfViewer — "map/document viewport" model.
 *
 * Two-phase zoom:
 *   Phase 1 (gesture active):  only visualZoom changes → CSS transform, no pdf.js rerender.
 *   Phase 2 (gesture end):     renderZoom = finalZoom  → one pdf.js rerender at final scale.
 *
 * Page state:
 *   - Locally responsive (immediate) via displayPage.
 *   - Stale external echoes blocked by localPageStampRef (600ms guard).
 *
 * Scroll anchoring:
 *   - expectedScrollRef tracks "where we expect the scroll to be" across rapid events,
 *     avoiding stale DOM reads before rAF commits scroll changes.
 */
const PdfViewer = React.forwardRef(function PdfViewer(
  {
    fileUrl,
    externalZoom = null,
    externalPage = null,
    onZoomChange = null,
    onPageChange = null,
    readOnly = false,
    showControls = true,
    dimmed = false,
  },
  ref
) {
  const [pdf, setPdf] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [displayPage, setDisplayPage] = useState(1);

  // renderZoom: the scale at which pdf.js last rendered the canvas.
  // visualZoom: the scale the user currently sees (CSS transform during gesture).
  // After gesture end, renderZoom = visualZoom = finalZoom, transformScale = 1.
  const [renderZoom, setRenderZoom] = useState(1);
  const [visualZoom, setVisualZoom] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const mountedRef = useRef(true);

  // Always-current value refs (safe inside event handlers / rAF)
  const renderZoomRef = useRef(1);
  const visualZoomRef = useRef(1);
  const displayPageRef = useRef(1);
  const totalPagesRef = useRef(0);
  const pageSizeRef = useRef({ width: 0, height: 0 });

  // Gesture control
  const isGestureRef = useRef(false);
  const touchGestureRef = useRef(null); // { startDist, startZoom }
  const gestureTimerRef = useRef(null);
  const syncTimerRef = useRef(null);
  const rafRef = useRef(null);

  // Expected scroll: tracks scroll we *intend* to be at after rAF, so rapid
  // successive events don't read stale DOM scrollLeft/scrollTop.
  const expectedScrollRef = useRef({ left: 0, top: 0 });

  // Stale-echo guard: ignore externalPage updates within 600ms of a local nav.
  const localPageStampRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => { renderZoomRef.current = renderZoom; }, [renderZoom]);
  useEffect(() => { visualZoomRef.current = visualZoom; }, [visualZoom]);
  useEffect(() => { displayPageRef.current = displayPage; }, [displayPage]);
  useEffect(() => { totalPagesRef.current = totalPages; }, [totalPages]);
  useEffect(() => { pageSizeRef.current = pageSize; }, [pageSize]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (renderTaskRef.current) { try { renderTaskRef.current.cancel(); } catch {} }
      if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Load PDF ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!fileUrl) return;
    let cancelled = false;
    setLoading(true);

    pdfjsLib.getDocument(fileUrl).promise.then((loaded) => {
      if (cancelled || !mountedRef.current) return;
      setPdf(loaded);
      setTotalPages(loaded.numPages);
      totalPagesRef.current = loaded.numPages;
      setDisplayPage(1);
      displayPageRef.current = 1;
      setRenderZoom(1);
      renderZoomRef.current = 1;
      setVisualZoom(1);
      visualZoomRef.current = 1;
      setPageSize({ width: 0, height: 0 });
      expectedScrollRef.current = { left: 0, top: 0 };
      setLoading(false);
    }).catch((err) => {
      console.error("PDF load error:", err);
      if (!cancelled && mountedRef.current) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [fileUrl]);

  // ── External page sync ─────────────────────────────────────────────────────
  // Jury: mirrors attorney freely.
  // Attorney: stale echo guard prevents own broadcast echoing back.
  useEffect(() => {
    if (externalPage == null || externalPage === displayPageRef.current) return;
    if (externalPage < 1 || externalPage > Math.max(totalPagesRef.current, 1)) return;
    if (Date.now() - localPageStampRef.current < 600) return; // stale echo
    setDisplayPage(externalPage);
    displayPageRef.current = externalPage;
  }, [externalPage, totalPages]);

  // ── External zoom sync ──────────────────────────────────────────────────────
  // Ignored during attorney's active gesture to prevent feedback loop.
  useEffect(() => {
    if (externalZoom == null) return;
    if (isGestureRef.current) return;
    const next = clamp(externalZoom, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(next - visualZoomRef.current) < 0.001) return;
    setVisualZoom(next);
    setRenderZoom(next);
    visualZoomRef.current = next;
    renderZoomRef.current = next;
  }, [externalZoom]);

  // ── PDF canvas render ───────────────────────────────────────────────────────
  // Only fires when renderZoom or displayPage changes — NOT during gesture.
  useEffect(() => {
    if (!pdf || !displayPage || !canvasRef.current) return;
    let cancelled = false;

    const doRender = async () => {
      try {
        const page = await pdf.getPage(displayPage);
        if (cancelled || !mountedRef.current) return;

        const viewport = page.getViewport({ scale: renderZoom });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch {}
          renderTaskRef.current = null;
        }

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        const size = { width: viewport.width, height: viewport.height };
        setPageSize(size);
        pageSizeRef.current = size;

        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        if (!cancelled && mountedRef.current) renderTaskRef.current = null;
      } catch (err) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("PDF render error:", err);
        }
      }
    };

    doRender();
    return () => {
      cancelled = true;
      if (renderTaskRef.current) { try { renderTaskRef.current.cancel(); } catch {} }
    };
  }, [pdf, displayPage, renderZoom]);

  // ── Page navigation ─────────────────────────────────────────────────────────
  const goToPage = useCallback((pageNum) => {
    const next = clamp(pageNum, 1, totalPagesRef.current || 1);
    localPageStampRef.current = Date.now(); // guard against stale echo
    setDisplayPage(next);
    displayPageRef.current = next;
    onPageChange?.(next);
    expectedScrollRef.current = { left: 0, top: 0 };
    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollLeft = 0;
        containerRef.current.scrollTop = 0;
      }
    });
  }, [onPageChange]);

  const handlePrevPage = useCallback(() => goToPage(displayPageRef.current - 1), [goToPage]);
  const handleNextPage = useCallback(() => goToPage(displayPageRef.current + 1), [goToPage]);

  // ── Zoom sync throttle (jury live mirror) ───────────────────────────────────
  const scheduleZoomSync = useCallback(() => {
    if (readOnly || syncTimerRef.current) return;
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      onZoomChange?.(visualZoomRef.current);
    }, SYNC_THROTTLE_MS);
  }, [onZoomChange, readOnly]);

  // ── Visual zoom with focal-point scroll anchoring ───────────────────────────
  // Uses expectedScrollRef to accumulate scroll intent across rapid events,
  // avoiding stale DOM reads before previous rAF has committed.
  const applyVisualZoom = useCallback((nextZoom, focalClientX, focalClientY) => {
    const container = containerRef.current;
    if (!container) return;

    const prevZoom = visualZoomRef.current;
    const clamped = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(clamped - prevZoom) < 0.0001) return;

    const rect = container.getBoundingClientRect();
    const localX = focalClientX - rect.left;
    const localY = focalClientY - rect.top;

    // Use expectedScroll (not container.scrollLeft) to avoid stale reads
    const contentX = expectedScrollRef.current.left + localX;
    const contentY = expectedScrollRef.current.top + localY;
    const scaleChange = clamped / prevZoom;

    const newScrollLeft = contentX * scaleChange - localX;
    const newScrollTop = contentY * scaleChange - localY;

    // Record intent before rAF fires
    expectedScrollRef.current = { left: newScrollLeft, top: newScrollTop };
    visualZoomRef.current = clamped;
    setVisualZoom(clamped); // triggers CSS transform update + toolbar display

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      containerRef.current.scrollLeft = newScrollLeft;
      containerRef.current.scrollTop = newScrollTop;
    });

    scheduleZoomSync();
  }, [scheduleZoomSync]);

  // ── Commit gesture end: one pdf.js rerender at final zoom ──────────────────
  const commitGestureEnd = useCallback(() => {
    isGestureRef.current = false;
    touchGestureRef.current = null;
    if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = null;

    const finalZoom = visualZoomRef.current;
    setRenderZoom(finalZoom);
    renderZoomRef.current = finalZoom;
    onZoomChange?.(finalZoom);
  }, [onZoomChange]);

  // ── Wheel (trackpad pinch = ctrlKey + wheel) ────────────────────────────────
  const handleWheel = useCallback((e) => {
    if (readOnly || !e.ctrlKey) return;
    e.preventDefault();

    // Sync expected scroll on first wheel event of a new gesture
    if (!isGestureRef.current && containerRef.current) {
      expectedScrollRef.current = {
        left: containerRef.current.scrollLeft,
        top: containerRef.current.scrollTop,
      };
    }
    isGestureRef.current = true;

    applyVisualZoom(visualZoomRef.current - e.deltaY * 0.008, e.clientX, e.clientY);

    if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
    gestureTimerRef.current = setTimeout(commitGestureEnd, GESTURE_COMMIT_DELAY);
  }, [applyVisualZoom, commitGestureEnd, readOnly]);

  // ── Touch pinch ─────────────────────────────────────────────────────────────
  const handleTouchStart = useCallback((e) => {
    if (readOnly || e.touches.length !== 2) return;
    const [t1, t2] = e.touches;

    // Sync expected scroll at gesture start
    if (containerRef.current) {
      expectedScrollRef.current = {
        left: containerRef.current.scrollLeft,
        top: containerRef.current.scrollTop,
      };
    }

    touchGestureRef.current = {
      startDist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
      startZoom: visualZoomRef.current,
    };
    isGestureRef.current = true;
  }, [readOnly]);

  const handleTouchMove = useCallback((e) => {
    if (readOnly || e.touches.length !== 2 || !touchGestureRef.current) return;
    e.preventDefault();

    const [t1, t2] = e.touches;
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const centerX = (t1.clientX + t2.clientX) / 2;
    const centerY = (t1.clientY + t2.clientY) / 2;
    const nextZoom = touchGestureRef.current.startZoom * (dist / touchGestureRef.current.startDist);

    applyVisualZoom(nextZoom, centerX, centerY);
  }, [applyVisualZoom, readOnly]);

  const handleTouchEnd = useCallback(() => {
    if (readOnly) return;
    commitGestureEnd();
  }, [commitGestureEnd, readOnly]);

  // ── Zoom buttons (focal at viewport center) ─────────────────────────────────
  const zoomAtCenter = useCallback((direction) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    // Sync expected scroll — button presses don't have stale scroll
    expectedScrollRef.current = { left: container.scrollLeft, top: container.scrollTop };
    isGestureRef.current = true;
    const next = direction === "in"
      ? visualZoomRef.current + ZOOM_STEP
      : visualZoomRef.current - ZOOM_STEP;
    applyVisualZoom(next, rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
    gestureTimerRef.current = setTimeout(commitGestureEnd, GESTURE_COMMIT_DELAY);
  }, [applyVisualZoom, commitGestureEnd]);

  useImperativeHandle(ref, () => ({
    setPage: (pageNum) => goToPage(pageNum),
  }), [goToPage]);

  const transformScale = renderZoom > 0 ? visualZoom / renderZoom : 1;
  const contentW = pageSize.width * transformScale;
  const contentH = pageSize.height * transformScale;

  return (
    <div className="w-full h-full flex flex-col bg-black" style={{ userSelect: "none" }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 z-10">
          Loading PDF...
        </div>
      )}
      {showControls && !readOnly && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-700 gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrevPage}
              disabled={displayPage <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-slate-300 w-16 text-center">
              {displayPage} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleNextPage}
              disabled={displayPage >= totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => zoomAtCenter("out")}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs text-slate-300 w-12 text-center">
              {Math.round(visualZoom * 100)}%
            </span>
            <Button size="sm" variant="outline" onClick={() => zoomAtCenter("in")}>
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Scroll viewport ("map surface") ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        style={{
          background: "#1a1a1a",
          opacity: dimmed ? 0.15 : 1,
          filter: dimmed ? "blur(0.5px)" : "none",
          // "none" blocks native browser zoom while allowing our handlers to fire.
          // readOnly viewers can pan freely.
          touchAction: readOnly ? "auto" : "none",
          overscrollBehavior: "contain",
        }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* ── Content layer: sized to the visual page dimensions ── */}
        {/* This makes the scroll container aware of the full zoomed extent. */}
        <div
          style={{
            width: `${Math.max(contentW, 1)}px`,
            height: `${Math.max(contentH, 1)}px`,
            position: "relative",
          }}
        >
          {/* ── Canvas wrapper: CSS transform for live gesture zoom ── */}
          {/* transform-origin: 0 0 ensures top-left anchoring matches scroll math. */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transformOrigin: "0 0",
              transform: `scale(${transformScale})`,
              willChange: "transform",
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                display: "block",
                width: `${pageSize.width}px`,
                height: `${pageSize.height}px`,
                userSelect: "none",
                WebkitUserSelect: "none",
              }}
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default PdfViewer;