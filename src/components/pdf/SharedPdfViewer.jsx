import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export default function SharedPdfViewer({
  fileUrl,
  page = 1,
  zoom = 1,
  panX = 0,
  panY = 0,
  onPageChange,
  onZoomChange,
  onPanChange,
  readOnly = false,
  showControls = true,
  showToolbar = true,
}) {
  const containerRef = useRef(null);
  const [numPages, setNumPages] = useState(null);
  const [isImage, setIsImage] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const touchRef = useRef(null);
  const gestureActiveRef = useRef(false);
  const committedZoomRef = useRef(zoom);
  const cssScaleRef = useRef(1);
  const pinchAnchorRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const lowerUrl = fileUrl?.toLowerCase() || '';
    setIsImage(lowerUrl.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i) !== null);
    setLoadError(false);
  }, [fileUrl]);

  useEffect(() => {
    committedZoomRef.current = zoom;
  }, [zoom]);

  const handlePrevPage = () => {
    if (page > 1) onPageChange?.(page - 1);
  };

  const handleNextPage = () => {
    if (numPages && page < numPages) onPageChange?.(page + 1);
  };

  const handleZoomOut = () => {
    const newZoom = clamp(zoom - 0.25, MIN_ZOOM, MAX_ZOOM);
    onZoomChange?.(newZoom);
  };

  const handleZoomIn = () => {
    const newZoom = clamp(zoom + 0.25, MIN_ZOOM, MAX_ZOOM);
    onZoomChange?.(newZoom);
  };

  const handleWheel = useCallback((e) => {
    if (!showControls || readOnly || !e.ctrlKey) return;
    e.preventDefault();
    const newZoom = clamp(zoom - e.deltaY * 0.006, MIN_ZOOM, MAX_ZOOM);
    onZoomChange?.(newZoom);
  }, [zoom, readOnly, showControls, onZoomChange]);

  const handleTouchStart = useCallback((e) => {
    if (readOnly || !containerRef.current) return;

    if (e.touches.length === 1) {
      touchRef.current = {
        type: 'pan',
        x0: e.touches[0].clientX,
        y0: e.touches[0].clientY,
        px0: panX,
        py0: panY,
      };
    } else if (e.touches.length >= 2) {
      const [t1, t2] = e.touches;
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const rect = containerRef.current.getBoundingClientRect();
      const cx = (t1.clientX + t2.clientX) / 2 - rect.left;
      const cy = (t1.clientY + t2.clientY) / 2 - rect.top;
      pinchAnchorRef.current = { x: cx, y: cy };
      touchRef.current = {
        type: 'pinch',
        d0: dist,
        z0: committedZoomRef.current,
        px0: panX,
        py0: panY,
      };
      gestureActiveRef.current = true;
      cssScaleRef.current = 1;
    }
  }, [panX, panY, readOnly]);

  const handleTouchMove = useCallback((e) => {
    if (readOnly || !touchRef.current) return;
    const t = touchRef.current;

    if (t.type === 'pan' && e.touches.length === 1) {
      const dx = e.touches[0].clientX - t.x0;
      const dy = e.touches[0].clientY - t.y0;
      onPanChange?.(t.px0 + dx, t.py0 + dy);
    } else if (t.type === 'pinch' && e.touches.length >= 2) {
      e.preventDefault();
      const [t1, t2] = e.touches;
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = clamp(dist / t.d0, MIN_ZOOM / t.z0, MAX_ZOOM / t.z0);
      const newZoom = t.z0 * ratio;
      const anchorX = pinchAnchorRef.current.x;
      const anchorY = pinchAnchorRef.current.y;
      const newPanX = anchorX * (1 - ratio) + t.px0;
      const newPanY = anchorY * (1 - ratio) + t.py0;
      cssScaleRef.current = ratio;
      onZoomChange?.(newZoom);
      onPanChange?.(newPanX, newPanY);
    }
  }, [readOnly, onPanChange, onZoomChange]);

  const handleTouchEnd = useCallback(() => {
    gestureActiveRef.current = false;
    cssScaleRef.current = 1;
    touchRef.current = null;
  }, []);

  if (!fileUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-slate-500 text-xs">
        No file available
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-red-400 text-xs flex-col gap-2">
        <div>Failed to load PDF</div>
        <div className="text-[10px] text-slate-500">Please try a different file</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-black">
      {showToolbar && !readOnly && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 border-b border-slate-700 flex-shrink-0">
          {!isImage && (
            <>
              <Button size="sm" variant="outline" onClick={handlePrevPage} disabled={page <= 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-slate-300 w-16 text-center">
                {page} / {numPages || '?'}
              </span>
              <Button size="sm" variant="outline" onClick={handleNextPage} disabled={!numPages || page >= numPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <div className="w-px h-4 bg-slate-700" />
            </>
          )}
          <Button size="sm" variant="outline" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-slate-300 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="outline" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center bg-black relative"
        style={{
          touchAction: 'none',
          overscrollBehavior: 'contain',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${gestureActiveRef.current ? cssScaleRef.current : 1})`,
            transformOrigin: 'top left',
            transition: gestureActiveRef.current ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {isImage ? (
            <img
              src={fileUrl}
              alt="Extract"
              className="block max-h-screen max-w-full object-contain"
              draggable={false}
            />
          ) : (
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages: n }) => {
                setNumPages(n);
                setLoadError(false);
              }}
              onLoadError={(err) => {
                console.error('PDF load error:', err);
                setLoadError(true);
              }}
              loading={<div className="text-slate-400 text-xs p-8">Loading PDF…</div>}
            >
              <Page
                pageNumber={page}
                scale={zoom}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}