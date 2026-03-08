import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Set up PDF worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function PdfViewer({
  fileUrl,
  externalZoom = null,
  externalPage = null,
  onZoomChange = null,
  onPageChange = null,
  readOnly = false,
  showControls = true,
  dimmed = false
}) {
  const [pdf, setPdf] = useState(null);
  const [zoom, setZoom] = useState(externalZoom ?? 1);
  const [currentPage, setCurrentPage] = useState(externalPage ?? 1);
  const [totalPages, setTotalPages] = useState(0);
  const [canvas, setCanvas] = useState(null);
  const [loading, setLoading] = useState(true);

  // Use external zoom/page if provided (for jury view)
  useEffect(() => {
    if (externalZoom !== null) setZoom(externalZoom);
  }, [externalZoom]);

  useEffect(() => {
    if (externalPage !== null) setCurrentPage(externalPage);
  }, [externalPage]);

  // Load PDF
  useEffect(() => {
    if (!fileUrl) return;
    setLoading(true);
    pdfjsLib.getDocument(fileUrl).promise.then((pdf) => {
      setPdf(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      setZoom(1);
      setLoading(false);
    });
  }, [fileUrl]);

  // Render page
  useEffect(() => {
    if (!pdf || !currentPage) return;
    pdf.getPage(currentPage).then((page) => {
      const viewport = page.getViewport({ scale: zoom });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      page.render({ canvasContext: context, viewport }).promise.then(() => {
        setCanvas(canvas.toDataURL());
      });
    });
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
    const newZoom = Math.min(3, zoom + 0.25);
    setZoom(newZoom);
    onZoomChange?.(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.5, zoom - 0.25);
    setZoom(newZoom);
    onZoomChange?.(newZoom);
  };

  if (loading) {
    return <div className="w-full h-full flex items-center justify-center bg-black text-slate-400">Loading PDF...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col bg-black relative">
      {/* Controls */}
      {showControls && !readOnly && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-700 gap-4">
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

      {/* Canvas */}
      <div
        className="flex-1 overflow-auto flex items-start justify-center p-4"
        style={{
          opacity: dimmed ? 0.18 : 1,
          filter: dimmed ? 'blur(1px)' : 'none'
        }}
      >
        {canvas && (
          <img
            src={canvas}
            alt={`Page ${currentPage}`}
            style={{
              maxWidth: '100%',
              height: 'auto',
              userSelect: 'none'
            }}
            draggable={false}
          />
        )}
      </div>
    </div>
  );
}