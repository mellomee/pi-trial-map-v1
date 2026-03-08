import React, { useRef, useCallback, useEffect, useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import PdfViewer from '@/components/shared/PdfViewer';

/**
 * PDF viewer with gesture pinch-zoom that only applies to the PDF canvas.
 * The transform wrapper wraps ONLY the PDF content, not the toolbar.
 * Page navigation is handled externally via onPageChange callback.
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
  const transformRef = useRef(null);
  const [internalZoom, setInternalZoom] = useState(zoom);
  const pdfViewerRef = useRef(null);

  // Sync external zoom into the TransformWrapper
  useEffect(() => {
    setInternalZoom(zoom);
  }, [zoom]);

  const handleGestureZoom = useCallback((e) => {
    const newZoom = e.state.scale;
    setInternalZoom(newZoom);
    onZoomChange?.(newZoom);
  }, [onZoomChange]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Only the PDF content is wrapped in the gesture handler */}
      <TransformWrapper
        ref={transformRef}
        initialScale={zoom}
        minScale={0.25}
        maxScale={5}
        onTransformed={handleGestureZoom}
        wheel={{ step: 0.1 }}
        pinch={{ step: 5 }}
        doubleClick={{ disabled: true }}
        panning={{ disabled: true }}
        limitBounds={false}
      >
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%', flex: 1 }}
          contentStyle={{ width: '100%', height: '100%' }}
        >
          <div style={{ width: '100%', height: '100%', touchAction: 'none' }}>
            <PdfViewer
              ref={pdfViewerRef}
              fileUrl={fileUrl}
              currentPage={currentPage}
              externalZoom={internalZoom}
              onPageChange={onPageChange}
              showControls={false}
              dimmed={dimmed}
            />
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}