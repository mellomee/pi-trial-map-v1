import React, { useRef } from 'react';
import PdfViewer from '@/components/shared/PdfViewer';

/**
 * Synchronized PDF viewer for attorney/jury presentation.
 * All gesture handling (pinch, wheel) happens inside PdfViewer at the canvas level.
 * Zoom and page state flow through shared presentation state via callbacks.
 */
export default function PdfViewerWithGestures({
  fileUrl,
  currentPage = 1,
  zoom = 1,
  onZoomChange,
  onPageChange,
  showControls = true,
  dimmed = false,
}) {
  const pdfViewerRef = useRef(null);

  return (
    <PdfViewer
      ref={pdfViewerRef}
      fileUrl={fileUrl}
      externalPage={currentPage}
      externalZoom={zoom}
      onPageChange={onPageChange}
      onZoomChange={onZoomChange}
      showControls={showControls}
      dimmed={dimmed}
    />
  );
}