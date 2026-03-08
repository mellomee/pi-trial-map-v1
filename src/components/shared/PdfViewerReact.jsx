import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PdfViewerReact = React.forwardRef(function PdfViewerReact({
  fileUrl,
  externalZoom = null,
  externalPage = null,
  onZoomChange = null,
  onPageChange = null,
  readOnly = false,
  showControls = true,
  dimmed = false
}, ref) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);

  // Sync external zoom/page
  useEffect(() => {
    if (externalZoom !== null && externalZoom !== zoom) {
      setZoom(externalZoom);
    }
  }, [externalZoom]);

  useEffect(() => {
    if (externalPage !== null && externalPage !== currentPage) {
      setCurrentPage(externalPage);
    }
  }, [externalPage]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setCurrentPage(1);
  };

  const handlePrevPage = () => {
    const newPage = Math.max(1, currentPage - 1);
    setCurrentPage(newPage);
    onPageChange?.(newPage);
  };

  const handleNextPage = () => {
    const newPage = Math.min(numPages, currentPage + 1);
    setCurrentPage(newPage);
    onPageChange?.(newPage);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(3, zoom + 0.2);
    setZoom(newZoom);
    onZoomChange?.(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.5, zoom - 0.2);
    setZoom(newZoom);
    onZoomChange?.(newZoom);
  };

  useImperativeHandle(ref, () => ({
    setPage: (pageNum) => {
      const newPage = Math.max(1, Math.min(pageNum, numPages));
      setCurrentPage(newPage);
      onPageChange?.(newPage);
    }
  }));

  return (
    <div className="w-full h-full flex flex-col bg-black relative">
      {showControls && !readOnly && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-700 gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrevPage} disabled={currentPage === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-slate-300 w-16 text-center">
              {currentPage} / {numPages}
            </span>
            <Button size="sm" variant="outline" onClick={handleNextPage} disabled={currentPage === numPages}>
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
        className="flex-1 overflow-auto flex items-start justify-center p-4 bg-black"
        style={{
          opacity: dimmed ? 0.25 : 1,
        }}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="text-slate-400">Loading PDF...</div>}
          error={<div className="text-red-400">Failed to load PDF</div>}
        >
          <Page
            pageNumber={currentPage}
            scale={zoom}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
});

export default PdfViewerReact;