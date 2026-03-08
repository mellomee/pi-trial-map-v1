import React, { useRef, useCallback, useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import PdfViewer from '@/components/shared/PdfViewer';

export default function PdfViewerWithGestures({
  fileUrl,
  onZoomChange,
  onPageChange,
  showControls = true,
  dimmed = false,
  externalZoom = 1,
}) {
  const transformRef = useRef(null);
  const pdfViewerRef = useRef(null);
  const [gestureZoom, setGestureZoom] = useState(1);

  // When external zoom changes (from controls), update gesture zoom
  useEffect(() => {
    if (transformRef.current && Math.abs(gestureZoom - externalZoom) > 0.01) {
      transformRef.current.setScale(externalZoom);
      setGestureZoom(externalZoom);
    }
  }, [externalZoom]);

  const handleZoomChange = useCallback((e) => {
    const newZoom = e.state.scale;
    setGestureZoom(newZoom);
    // Sync to parent immediately
    onZoomChange?.(newZoom);
  }, [onZoomChange]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Controls stay outside gesture wrapper */}
      {showControls && (
        <div style={{ flexShrink: 0 }}>
          <PdfViewer
            ref={pdfViewerRef}
            fileUrl={fileUrl}
            onZoomChange={onZoomChange}
            onPageChange={onPageChange}
            showControls={true}
            showOnlyControls={true}
            dimmed={dimmed}
          />
        </div>
      )}
      
      {/* Only PDF content gets gesture zooming */}
      <div style={{ flex: 1, overflow: 'hidden', width: '100%' }}>
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
                ref={pdfViewerRef}
                fileUrl={fileUrl}
                onZoomChange={onZoomChange}
                onPageChange={onPageChange}
                showControls={false}
                dimmed={dimmed}
              />
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  );
}