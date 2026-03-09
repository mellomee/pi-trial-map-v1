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
const ZOOM_STEP = 0.2;
const LIVE_SYNC_MS = 80;
const COMMIT_RENDER_MS = 140;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  // committedZoom = pdf.js render scale
  // visualZoom = what the user sees immediately during pinch
  const [committedZoom, setCommittedZoom] = useState(1);
  const [visualZoom, setVisualZoom] = useState(1);

  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef(null);
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);

  const renderTaskRef = useRef(null);
  const mountedRef = useRef(true);

  const isGestureActiveRef = useRef(false);
  const touchStateRef = useRef(null);
  const rafAdjustRef = useRef(null);

  const syncTimerRef = useRef(null);
  const commitTimerRef = useRef(null);

  const committedZoomRef = useRef(1);
  const visualZoomRef = useRef(1);
  const currentPageRef = useRef(1);

  useEffect(() => {
    committedZoomRef.current = committedZoom;
  }, [committedZoom]);

  useEffect(() => {
    visualZoomRef.current = visualZoom;
  }, [visualZoom]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      if (rafAdjustRef.current) cancelAnimationFrame(rafAdjustRef.current);
    };
  }, []);

  const scheduleLiveSync = useCallback(
    (nextZoom) => {
      if (readOnly) return;
      if (syncTimerRef.current) return;
      syncTimerRef.current = setTimeout(() => {
        syncTimerRef.current = null;
        onZoomChange?.(visualZoomRef.current);
      }, LIVE_SYNC_MS);
    },
    [onZoomChange, readOnly]
  );

  const commitZoomRender = useCallback(
    (nextZoom) => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(() => {
        const finalZoom = visualZoomRef.current;
        setCommittedZoom(finalZoom);
        if (!readOnly) {
          onZoomChange?.(finalZoom);
        }
        commitTimerRef.current = null;
      }, COMMIT_RENDER_MS);
    },
    [onZoomChange, readOnly]
  );

  const applyZoomAtClientPoint = useCallback(
    (nextZoom, clientX, clientY, options = {}) => {
      const container = containerRef.current;
      if (!container) return;

      const prevZoom = visualZoomRef.current;
      const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      if (Math.abs(clampedZoom - prevZoom) < 0.0001) return;

      const rect = container.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;

      const contentX = container.scrollLeft + localX;
      const contentY = container.scrollTop + localY;

      const scaleRatio = clampedZoom / prevZoom;

      setVisualZoom(clampedZoom);

      if (rafAdjustRef.current) cancelAnimationFrame(rafAdjustRef.current);
      rafAdjustRef.current = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        containerRef.current.scrollLeft = contentX * scaleRatio - localX;
        containerRef.current.scrollTop = contentY * scaleRatio - localY;
      });

      if (!options.skipSync) {
        scheduleLiveSync(clampedZoom);
      }
      if (!options.skipCommit) {
        commitZoomRender(clampedZoom);
      }
    },
    [scheduleLiveSync, commitZoomRender]
  );

  useEffect(() => {
    if (!fileUrl) return;

    let cancelled = false;
    setLoading(true);

    pdfjsLib
      .getDocument(fileUrl)
      .promise.then((loadedPdf) => {
        if (cancelled || !mountedRef.current) return;
        setPdf(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        setCurrentPage(1);
        currentPageRef.current = 1;
        setCommittedZoom(1);
        committedZoomRef.current = 1;
        setVisualZoom(1);
        visualZoomRef.current = 1;
        setLoading(false);

        if (containerRef.current) {
          containerRef.current.scrollLeft = 0;
          containerRef.current.scrollTop = 0;
        }
      })
      .catch((err) => {
        console.error("Failed to load PDF:", err);
        if (!cancelled && mountedRef.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  useEffect(() => {
    if (
      externalZoom !== null &&
      !isGestureActiveRef.current &&
      Math.abs(externalZoom - visualZoomRef.current) > 0.0001
    ) {
      const next = clamp(externalZoom, MIN_ZOOM, MAX_ZOOM);
      setVisualZoom(next);
      setCommittedZoom(next);
    }
  }, [externalZoom]);

  useEffect(() => {
    if (
      externalPage !== null &&
      externalPage !== currentPageRef.current &&
      externalPage >= 1 &&
      externalPage <= Math.max(totalPages, 1)
    ) {
      setCurrentPage(externalPage);
      currentPageRef.current = externalPage;
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollLeft = 0;
          containerRef.current.scrollTop = 0;
        }
      });
    }
  }, [externalPage, totalPages]);

  useEffect(() => {
    if (!pdf || !currentPage || !canvasRef.current) return;

    let cancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(currentPage);
        if (cancelled || !mountedRef.current) return;

        const viewport = page.getViewport({ scale: committedZoom });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return;

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
          renderTaskRef.current = null;
        }

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        setPageSize({
          width: viewport.width,
          height: viewport.height,
        });

        const task = page.render({
          canvasContext: context,
          viewport,
        });

        renderTaskRef.current = task;

        await task.promise;

        if (!cancelled && mountedRef.current) {
          renderTaskRef.current = null;
        }
      } catch (err) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("PDF render error:", err);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [pdf, currentPage, committedZoom]);

  const goToPage = useCallback(
    (pageNum) => {
      const nextPage = clamp(pageNum, 1, totalPages || 1);
      setCurrentPage(nextPage);
      currentPageRef.current = nextPage;
      onPageChange?.(nextPage);

      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollLeft = 0;
          containerRef.current.scrollTop = 0;
        }
      });
    },
    [onPageChange, totalPages]
  );

  const handlePrevPage = useCallback(() => {
    goToPage(currentPageRef.current - 1);
  }, [goToPage]);

  const handleNextPage = useCallback(() => {
    goToPage(currentPageRef.current + 1);
  }, [goToPage]);

  const zoomButtonAtCenter = useCallback(
    (direction) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const base = visualZoomRef.current;
      const next =
        direction === "in" ? base + ZOOM_STEP : base - ZOOM_STEP;

      isGestureActiveRef.current = true;
      applyZoomAtClientPoint(next, centerX, centerY);
      window.clearTimeout(containerRef.current?._gestureEndTimer);
      containerRef.current._gestureEndTimer = window.setTimeout(() => {
        isGestureActiveRef.current = false;
      }, 180);
    },
    [applyZoomAtClientPoint]
  );

  const handleZoomIn = useCallback(() => {
    zoomButtonAtCenter("in");
  }, [zoomButtonAtCenter]);

  const handleZoomOut = useCallback(() => {
    zoomButtonAtCenter("out");
  }, [zoomButtonAtCenter]);

  useImperativeHandle(
    ref,
    () => ({
      setPage: (pageNum) => goToPage(pageNum),
    }),
    [goToPage]
  );

  const handleWheel = useCallback(
    (e) => {
      if (readOnly) return;

      // Intercept actual pinch-like wheel gestures only.
      if (!e.ctrlKey) return;

      e.preventDefault();
      isGestureActiveRef.current = true;

      const delta = -e.deltaY * 0.01;
      const nextZoom = visualZoomRef.current + delta;
      applyZoomAtClientPoint(nextZoom, e.clientX, e.clientY);

      window.clearTimeout(containerRef.current?._gestureEndTimer);
      containerRef.current._gestureEndTimer = window.setTimeout(() => {
        isGestureActiveRef.current = false;
        onZoomChange?.(visualZoomRef.current);
      }, 160);
    },
    [applyZoomAtClientPoint, onZoomChange, readOnly]
  );

  const handleTouchStart = useCallback((e) => {
    if (readOnly) return;
    if (e.touches.length !== 2) return;

    const [t1, t2] = e.touches;
    const centerX = (t1.clientX + t2.clientX) / 2;
    const centerY = (t1.clientY + t2.clientY) / 2;
    const distance = Math.hypot(
      t2.clientX - t1.clientX,
      t2.clientY - t1.clientY
    );

    touchStateRef.current = {
      startDistance: distance,
      lastDistance: distance,
      centerX,
      centerY,
      startZoom: visualZoomRef.current,
    };
    isGestureActiveRef.current = true;
  }, [readOnly]);

  const handleTouchMove = useCallback(
    (e) => {
      if (readOnly) return;
      if (e.touches.length !== 2 || !touchStateRef.current) return;

      e.preventDefault();

      const [t1, t2] = e.touches;
      const centerX = (t1.clientX + t2.clientX) / 2;
      const centerY = (t1.clientY + t2.clientY) / 2;
      const distance = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY
      );

      const { startDistance, startZoom } = touchStateRef.current;
      if (!startDistance) return;

      const scaleFactor = distance / startDistance;
      const nextZoom = startZoom * scaleFactor;

      applyZoomAtClientPoint(nextZoom, centerX, centerY);

      touchStateRef.current = {
        ...touchStateRef.current,
        lastDistance: distance,
        centerX,
        centerY,
      };
    },
    [applyZoomAtClientPoint, readOnly]
  );

  const endGesture = useCallback(() => {
    if (readOnly) return;
    touchStateRef.current = null;
    isGestureActiveRef.current = false;

    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }

    const finalZoom = visualZoomRef.current;
    setCommittedZoom(finalZoom);
    onZoomChange?.(finalZoom);
  }, [onZoomChange, readOnly]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-slate-400">
        Loading PDF...
      </div>
    );
  }

  const scaleRatio =
    committedZoom > 0 ? visualZoom / committedZoom : 1;

  return (
    <div className="w-full h-full flex flex-col bg-black relative">
      {showControls && !readOnly && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-700 gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-slate-300 w-16 text-center">
              {currentPage} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs text-slate-300 w-12 text-center">
              {Math.round(visualZoom * 100)}%
            </span>
            <Button size="sm" variant="outline" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-black"
        style={{
          opacity: dimmed ? 0.15 : 1,
          filter: dimmed ? "blur(0.5px)" : "none",
          touchAction: readOnly ? "auto" : "none",
          overscrollBehavior: "contain",
        }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={endGesture}
        onTouchCancel={endGesture}
      >
        <div
          className="min-w-full min-h-full flex items-start justify-center p-4"
          style={{ boxSizing: "border-box" }}
        >
          <div
            ref={viewportRef}
            style={{
              width: `${pageSize.width}px`,
              height: `${pageSize.height}px`,
              transform: `scale(${scaleRatio})`,
              transformOrigin: "top left",
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