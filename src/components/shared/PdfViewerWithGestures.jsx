import React, { useRef, useCallback } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import PdfViewer from '@/components/shared/PdfViewer';

export default function PdfViewerWithGestures({
  fileUrl,
  onZoomChange,
  onPageChange,
  showControls = true,
  dimmed = false,
}) {
  const transformRef = useRef(null);

  const handleZoomChange = useCallback((e) => {
    // Sync the zoom level from the gesture library to the PDF renderer
    const newZoom = e.state.scale;
    onZoomChange?.(newZoom);
  }, [onZoomChange]);

  return (
    <TransformWrapper
      ref={transformRef}
      initialScale={1}
      minScale={0.25}
      maxScale={5}
      onTransformed={handleZoomChange}
      wheel={{ step: 0.1 }}
      pinch={{ step: 5 }}
      doubleClick={{ disabled: true }}
      panning={{ disabled: true }}
      limitBounds={false}
    >
      <TransformComponent
        wrapperStyle={{ width: '100%', height: '100%' }}
        contentStyle={{ width: '100%', height: '100%' }}
      >
        <div style={{ width: '100%', height: '100%', touchAction: 'none' }}>
          <PdfViewer
            fileUrl={fileUrl}
            onZoomChange={onZoomChange}
            onPageChange={onPageChange}
            showControls={showControls}
            dimmed={dimmed}
          />
        </div>
      </TransformComponent>
    </TransformWrapper>
  );
}