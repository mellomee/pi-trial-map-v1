import React from 'react';

export default function PresentationFrame({ children }) {
  return (
    <div
      style={{
        width: '92%',
        height: '92%',
        maxWidth: '92vw',
        maxHeight: '92vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
        overflow: 'hidden',
        background: '#020617',
      }}
    >
      {children}
    </div>
  );
}