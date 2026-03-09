import React, { useRef } from 'react';
import PdfViewer from '@/components/shared/PdfViewer';

/**
 * Synchronized PDF viewer for attorney/jury presentation.
 * Passes through all gesture/scroll/zoom/page props to PdfViewer.
 */
export default function PdfViewerWithGestures({
  fileUrl,
  currentPage = 1,
  zoom = 1,
  scrollLeft = null,
  scrollTop = null,
  onZoomChange,
  onPageChange,
  onScrollChange,
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
      externalScrollLeft={scrollLeft}
      externalScrollTop={scrollTop}
      onPageChange={onPageChange}
      onZoomChange={onZoomChange}
      onScrollChange={onScrollChange}
      showControls={showControls}
      dimmed={dimmed}
    />
  );
}