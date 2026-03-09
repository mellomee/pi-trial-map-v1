// Shared frame styling for attorney and jury PDF viewers
// Ensures both render the PDF inside the same normalized viewport
export const PRESENTATION_FRAME_STYLE = {
  // Outer container — centers the inner frame with black margins
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  // Inner frame — actual PDF viewport box
  // Sized to match attorney viewer scroll area (minus toolbar)
  // Maintains consistent aspect ratio for both attorney and jury
  inner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '92%',
    height: '92%',
    maxWidth: '92vw',
    maxHeight: '92vh',
    backgroundColor: '#080c18',
    borderRadius: '0px',
    overflow: 'hidden',
    position: 'relative',
  },
};