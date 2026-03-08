import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const PdfViewer = React.forwardRef(function PdfViewer({
  fileUrl,
  externalZoom = null,
  externalPage = null,
  onZoomChange = null,
  onPageChange = null,
  readOnly = false,
  showControls = true,
  dimmed = false
}, ref) {
  const [pdf, setPdf] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const lastWheelTime = useRef(0);

  // Sync external zoom/page (jury view reading from attorney changes)
  useEffect(() => {
    if (externalZoom !== null && externalZoom !== zoom) setZoom(externalZoom);
  }, [externalZoom]);

  useEffect(() => {
    if (externalPage !== null && externalPage !== currentPage) setCurrentPage(externalPage);
  }, [externalPage]);

  // Load PDF
  useEffect(() => {
    if (!fileUrl) return;
    setLoading(true);
    pdfjsLib.getDocument(fileUrl).promise
      .then((pdf) => {
        setPdf(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        setZoom(1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [fileUrl]);

  // Render page whenever pdf, page, or zoom changes
  useEffect(() => {
    if (!pdf || !currentPage || !canvasRef.current) return;

    let renderTask = null;

    pdf.getPage(currentPage).then((page) => {
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: zoom });
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      renderTask = page.render({ canvasContext: context, viewport });
      return renderTask.promise;
    }).catch((err) => {
      console.error('PDF render error:', err);
    });

    // Cleanup: cancel any pending render operations
    return () => {
      if (renderTask) {
        renderTask.cancel?.();
      }
    };
  }, [pdf, currentPage, zoom]);

  const handlePrevPage = () => {
    const newPage = Math.max(1, currentPage - 1);
    setCurrentPage(newPage);
    onPageChange?.(newPage);
  };

  const handleNextPage = () => {
    const newPage = Math.min(totalPages, currentPage + 1);
    setCurrentPage(newPage);
    onPageChange?.(newPage);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(4, zoom + 0.2);
    setZoom(newZoom);
    onZoomChange?.(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.5, zoom - 0.2);
    setZoom(newZoom);
    onZoomChange?.(newZoom);
  };

  // Imperative API for setting page programmatically
  React.useImperativeHandle(ref, () => ({
    setPage: (pageNum) => {
      const newPage = Math.max(1, Math.min(pageNum, totalPages));
      setCurrentPage(newPage);
      onPageChange?.(newPage);
    }
  }));

  // Handle wheel zoom (trackpad pinch or Ctrl+wheel)
  const handleWheel = (e) => {
    // Trackpad pinch or Ctrl+wheel for zoom
    if ((e.ctrlKey || e.metaKey || Math.abs(e.deltaY) < 5) && Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheelTime.current < 30) return; // debounce
      lastWheelTime.current = now;

      // Invert for natural zoom direction
      const delta = -e.deltaY * 0.005;
      const newZoom = Math.min(4, Math.max(0.5, zoom + delta));
      setZoom(newZoom);
      onZoomChange?.(newZoom);
    }
  };

  // Handle two-finger touch pinch zoom
  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      if (!containerRef.current._lastDist) {
        containerRef.current._lastDist = dist;
        return;
      }
      
      const delta = dist - containerRef.current._lastDist;
      const newZoom = Math.min(4, Math.max(0.5, zoom + delta * 0.01));
      setZoom(newZoom);
      onZoomChange?.(newZoom);
      containerRef.current._lastDist = dist;
    }
  };

  const handleTouchEnd = () => {
    if (containerRef.current) containerRef.current._lastDist = null;
  };

  if (loading) {
    return <div className="w-full h-full flex items-center justify-center bg-black text-slate-400">Loading PDF...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col bg-black relative">
      {showControls && !readOnly && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-700 gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrevPage} disabled={currentPage === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-slate-300 w-16 text-center">
              {currentPage} / {totalPages}
            </span>
            <Button size="sm" variant="outline" onClick={handleNextPage} disabled={currentPage === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs text-slate-300 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <Button size="sm" variant="outline" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-4"
        style={{
          opacity: dimmed ? 0.15 : 1,
          filter: dimmed ? 'blur(0.5px)' : 'none',
          touchAction: 'none'
        }}
        onWheel={handleWheel}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: '100%',
            height: 'auto',
            userSelect: 'none'
          }}
        />
      </div>
    </div>
  );
});

export default PdfViewer;