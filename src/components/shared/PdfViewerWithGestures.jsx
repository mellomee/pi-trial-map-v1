import React, { useRef } from 'react';
import PdfViewer from '@/components/shared/PdfViewer';

/**
 * Thin wrapper that passes all viewport sync props to PdfViewer.
 * onViewportChange({ page?, zoom?, scrollLeft?, scrollTop? }, { flush? }) is called
 * as a single batched callback — no separate zoom/scroll/page signals.
 */
export default function PdfViewerWithGestures({
  fileUrl,
  currentPage = 1,
  zoom = 1,
  scrollLeft = null,
  scrollTop = null,
  onViewportChange,
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
      onViewportChange={onViewportChange}
      showControls={showControls}
      dimmed={dimmed}
    />
  );
}