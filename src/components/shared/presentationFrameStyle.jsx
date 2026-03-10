/**
 * Shared presentation frame style for attorney and jury PDF viewers.
 * Ensures both use identical viewport dimensions for synchronized display.
 */
export const PRESENTATION_FRAME_STYLE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '92%',
  height: '92%',
  maxWidth: '92vw',
  maxHeight: '92vh',
  position: 'relative',
  overflow: 'hidden',
  margin: '0 auto',
};