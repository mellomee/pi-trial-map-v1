import React, { useRef, useEffect, useState } from 'react';
import PdfViewer from '@/components/shared/PdfViewer';

/**
 * PDF viewer that passes zoom and page state directly to PdfViewer.
 * Gestures are handled by the browser and tablet natively; zoom affects canvas rendering.
 * No external transform wrapper — zoom is applied at the canvas rendering level.
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