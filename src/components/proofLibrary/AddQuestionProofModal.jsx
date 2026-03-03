import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText, Image, Eye } from 'lucide-react';
import LinkQuestionProofModal from '@/components/proofLibrary/LinkQuestionProofModal';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const COLOR_CSS = {
  yellow: "rgba(255,220,0,0.40)",
  red:    "rgba(239,68,68,0.40)",
  green:  "rgba(34,197,94,0.40)",
  blue:   "rgba(59,130,246,0.40)",
};

export default function AddQuestionProofModal({ isOpen, onClose, question, evidenceGroupId, caseId, onProofLinked }) {
  const [showLinkModal, setShowLinkModal] = useState(false);

  if (!isOpen) return null;

  return (
    <LinkQuestionProofModal
      isOpen={isOpen}
      onClose={onClose}
      question={question}
      evidenceGroupId={evidenceGroupId}
      caseId={caseId}
      onProofLinked={onProofLinked}
    />
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-100">
            Link Proof to "{question?.question_text?.slice(0, 40)}..."
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading proofs...</div>
        ) : (
          <Tabs value={proofTab} onValueChange={setProofTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="depoClip">Deposition Clips</TabsTrigger>
              <TabsTrigger value="extract">Exhibit Extracts</TabsTrigger>
            </TabsList>

            {/* Deposition Clips Tab */}
            <TabsContent value="depoClip" className="space-y-3 mt-4">
              {/* Clips List - Full width */}
              <div className="border border-gray-700 rounded bg-gray-950">
                <div className="px-3 py-2 border-b border-gray-700">
                  <p className="text-xs font-semibold text-gray-400 uppercase">Deposition Clips ({depoClips.length})</p>
                </div>
                <div className="grid grid-cols-2 gap-2 p-2 max-h-32 overflow-y-auto">
                  {depoClips.map(clip => (
                    <button
                      key={clip.id}
                      onClick={() => setSelectedClip(clip)}
                      className={`text-left p-2 rounded border transition-colors ${
                        selectedClip?.id === clip.id
                          ? 'border-cyan-400 bg-cyan-500/10'
                          : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex gap-1 items-center">
                        <p className="text-xs font-medium text-gray-200 truncate flex-1">{clip.topic_tag || clip.clip_title || clip.start_cite}</p>
                        {clip.direction && (
                          <Badge className={clip.direction === 'HelpsUs' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} size="sm">
                            {clip.direction === 'HelpsUs' ? '✓' : '✗'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{clip.start_cite}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Clip Details Preview - Full width */}
              {selectedClip && (
                <div className="border border-gray-700 rounded bg-gray-950 p-4 space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-cyan-300">{selectedClip.clip_title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Citation: {selectedClip.start_cite} – {selectedClip.end_cite}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge className="bg-blue-500/20 text-blue-300 text-[10px]">Deposition Clip</Badge>
                      {selectedClip.direction && (
                        <Badge className={selectedClip.direction === 'HelpsUs' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} size="sm">
                          {selectedClip.direction === 'HelpsUs' ? '✓ Helps Us' : '✗ Hurts Us'}
                        </Badge>
                      )}
                      {selectedClip.topic_tag && <Badge variant="outline" className="text-gray-300 border-gray-600 text-[10px]">{selectedClip.topic_tag}</Badge>}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Testimony</p>
                    <div className="bg-gray-900 rounded border border-gray-700 p-3">
                      <p className="text-xs text-gray-200 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{selectedClip.clip_text}</p>
                    </div>
                  </div>
                  {selectedClip.notes && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Notes</p>
                      <p className="text-xs text-gray-300">{selectedClip.notes}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleAddClipProof}
                  disabled={!selectedClip}
                  className="bg-cyan-600 hover:bg-cyan-700 flex-1"
                >
                  Link Clip
                </Button>
              </div>
            </TabsContent>

            {/* Exhibit Extracts Tab */}
             <TabsContent value="extract" className="space-y-3 mt-4">
               {/* Extracts list - Full width */}
               <div className="border border-gray-700 rounded bg-gray-950">
                 <div className="px-3 py-2 border-b border-gray-700">
                   <p className="text-xs font-semibold text-gray-400 uppercase">Exhibit Extracts ({extracts.length})</p>
                 </div>
                 <div className="space-y-1 p-2 max-h-40 overflow-y-auto">
                   {extracts.length > 0 ? (
                     extracts.map(extract => (
                       <button
                         key={extract.id}
                         onClick={() => { setSelectedExtract(extract); setSelectedCallout(null); }}
                         className={`text-left p-3 rounded border transition-colors w-full ${
                           selectedExtract?.id === extract.id
                             ? 'border-cyan-400 bg-cyan-500/10'
                             : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                         }`}
                       >
                         <p className="text-xs font-semibold text-gray-100">{extract.extract_title_internal || extract.extract_title_official || 'Untitled'}</p>
                         <p className="text-[10px] text-gray-400 mt-1">{extract.extract_title_official || '—'}</p>
                       </button>
                     ))
                   ) : (
                     <div className="text-center py-4 text-gray-500 text-xs">No extracts available</div>
                   )}
                 </div>
               </div>

              {/* Extract Details - Full width */}
               {selectedExtract && selectedExtractMeta && (
                 <div className="border border-gray-700 rounded bg-gray-950 p-3 space-y-3">
                   {/* 3-column metadata tiles */}
                   <div className="grid grid-cols-3 gap-3">
                     {/* ORIGINAL */}
                     <div className="bg-gray-900 border border-gray-700 rounded p-3 space-y-2">
                       <p className="text-[10px] text-gray-500 uppercase font-semibold">Original</p>
                       {selectedExtractMeta.sourceDepoExhibit ? (
                         <>
                           <p className="text-xl font-bold text-yellow-300">
                             #{selectedExtractMeta.primarySrc?.source_depo_exhibit_no || selectedExtractMeta.sourceDepoExhibit.depo_exhibit_no || '—'}
                           </p>
                           <p className="text-xs text-gray-300 leading-tight mt-1">
                             {selectedExtractMeta.sourceDepoExhibit.depo_exhibit_title || selectedExtractMeta.sourceDepoExhibit.display_title || '—'}
                           </p>
                           {selectedExtractMeta.deponent && (
                             <p className="text-[11px] text-cyan-400 mt-1">
                               {selectedExtractMeta.deponent.display_name || `${selectedExtractMeta.deponent.first_name || ''} ${selectedExtractMeta.deponent.last_name}`.trim()}
                             </p>
                           )}
                           {selectedExtractMeta.sourceDepoExhibit.file_url && (
                             <Button 
                               size="sm" 
                               variant="ghost" 
                               onClick={() => setViewingFile(selectedExtract)}
                               className="h-6 text-cyan-400 hover:text-cyan-300 p-0 text-[10px]"
                             >
                               <Eye className="w-3 h-3 mr-1" /> View File
                             </Button>
                           )}
                         </>
                       ) : (
                         <p className="text-gray-500 italic text-xs mt-1">Source not linked</p>
                       )}
                     </div>

                     {/* MARKED */}
                     <div className={`bg-gray-900 border rounded p-3 space-y-2 ${selectedExtractMeta.jointExhibit ? 'border-yellow-500/40' : 'border-gray-700'}`}>
                       <p className="text-[10px] text-gray-500 uppercase font-semibold">Marked</p>
                       {selectedExtractMeta.jointExhibit ? (
                         <>
                           <p className="text-xl font-bold text-yellow-300">#{selectedExtractMeta.jointExhibit.marked_no}</p>
                           <p className="text-xs text-gray-300 leading-tight mt-1">
                             {selectedExtractMeta.jointExhibit.internal_name || selectedExtractMeta.jointExhibit.marked_title || '—'}
                           </p>
                           {selectedExtractMeta.jointExhibit.status && (
                             <Badge className="mt-1 text-[10px] bg-yellow-500/20 text-yellow-400">{selectedExtractMeta.jointExhibit.status}</Badge>
                           )}
                         </>
                       ) : (
                         <>
                           <p className="text-gray-500 italic text-xs mt-1">Not on joint list</p>
                           {selectedExtract.extract_page_count && (
                             <p className="text-[11px] text-gray-400 mt-1">{selectedExtract.extract_page_count} pg extracted</p>
                           )}
                         </>
                       )}
                     </div>

                     {/* ADMITTED */}
                     <div className={`bg-gray-900 border rounded p-3 space-y-2 ${selectedExtractMeta.admittedRecord?.admitted_no || selectedExtractMeta.jointExhibit?.admitted_no ? 'border-green-500/40' : 'border-gray-700'}`}>
                       <p className="text-[10px] text-gray-500 uppercase font-semibold">Admitted</p>
                       {selectedExtractMeta.admittedRecord?.admitted_no || selectedExtractMeta.jointExhibit?.admitted_no ? (
                         <>
                           <p className="text-xl font-bold text-green-300">#{selectedExtractMeta.admittedRecord?.admitted_no || selectedExtractMeta.jointExhibit.admitted_no}</p>
                           {(selectedExtractMeta.admittedRecord?.date_admitted || selectedExtractMeta.jointExhibit?.admitted_date) && (
                             <p className="text-[11px] text-gray-300 mt-1">{selectedExtractMeta.admittedRecord?.date_admitted || selectedExtractMeta.jointExhibit.admitted_date}</p>
                           )}
                           <Badge className="mt-1 text-[10px] bg-green-500/20 text-green-400">✓ Admitted</Badge>
                         </>
                       ) : (
                         <p className="text-gray-500 italic text-xs mt-1">Not admitted</p>
                       )}
                     </div>
                   </div>

                  {/* Callouts row */}
                  {callouts.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-cyan-400 uppercase">Callouts ({callouts.length})</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {callouts.map((callout, idx) => {
                          const witName = callout.witness_id ? caseParties[callout.witness_id] : null;
                          return (
                          <button
                            key={callout.id}
                            onClick={() => setSelectedCallout(callout)}
                            className={`flex-shrink-0 rounded border-2 transition-all ${
                              selectedCallout?.id === callout.id
                                ? 'border-cyan-400 shadow-lg shadow-cyan-500/20'
                                : 'border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            {callout.snapshot_image_url ? (
                              <img src={callout.snapshot_image_url} alt={callout.name} className="h-20 w-24 object-cover rounded" />
                            ) : (
                              <div className="h-20 w-24 flex items-center justify-center bg-gray-800 rounded">
                                <Image className="w-5 h-5 text-gray-600" />
                              </div>
                            )}
                            {callout.name && <p className="text-[9px] text-gray-400 text-center px-1 pt-0.5 truncate w-24">{callout.name}</p>}
                            {witName && <p className="text-[9px] text-cyan-400 text-center px-1 pb-0.5 truncate w-24">{witName}</p>}
                          </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Full-width preview */}
                  {selectedCallout && (
                    <div className="border border-gray-700 rounded bg-black p-3 flex items-center justify-center min-h-64">
                      {selectedCallout.snapshot_image_url ? (
                        <div className="relative max-w-full">
                          <img 
                            src={selectedCallout.snapshot_image_url} 
                            alt="Callout" 
                            className="max-w-full max-h-96 object-contain"
                          />
                          {/* Highlights overlay */}
                          {highlights.map(hl =>
                            (hl.rects_norm || []).map((r, ri) => (
                              <div key={`${hl.id}-${ri}`} style={{
                                position: "absolute",
                                left: `${r.x * 100}%`, top: `${r.y * 100}%`,
                                width: `${r.w * 100}%`, height: `${r.h * 100}%`,
                                background: COLOR_CSS[hl.color] || COLOR_CSS.yellow,
                                pointerEvents: "none",
                              }} />
                            ))
                          )}
                        </div>
                      ) : (
                        <div className="text-center text-gray-600">
                          <Image className="w-12 h-12 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No snapshot</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleAddExtractProof}
                  disabled={!selectedExtract || !selectedCallout}
                  className="bg-cyan-600 hover:bg-cyan-700 flex-1"
                >
                  Link Callout
                </Button>
              </div>
              </TabsContent>
              </Tabs>
              )}

              {/* File Viewer Modal */}
              {viewingFile && (
              <Dialog open={!!viewingFile} onOpenChange={() => setViewingFile(null)}>
              <DialogContent className="bg-gray-950 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-gray-100">{viewingFile.depo_exhibit_no} – {viewingFile.depo_exhibit_title}</DialogTitle>
              </DialogHeader>

              {viewingFile.extract_file_url?.toLowerCase().includes('.pdf') ? (
                <div className="space-y-2">
                  <canvas ref={fileViewerCanvasRef} className="w-full border border-gray-700 rounded" />
                  {fileViewerNumPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => setFileViewerPage(p => Math.max(1, p - 1))} 
                        disabled={fileViewerPage === 1}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-200"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-gray-400">{fileViewerPage} / {fileViewerNumPages}</span>
                      <Button 
                        size="sm" 
                        onClick={() => setFileViewerPage(p => Math.min(fileViewerNumPages, p + 1))} 
                        disabled={fileViewerPage === fileViewerNumPages}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-200"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-gray-700 rounded bg-black p-2">
                  <img src={viewingFile.extract_file_url} alt="Extract" className="w-full max-h-96 object-contain" />
                </div>
              )}

              <Button onClick={() => setViewingFile(null)} className="w-full bg-gray-800 hover:bg-gray-700">
                Close
              </Button>
              </DialogContent>
              </Dialog>
              )}
              </DialogContent>
              </Dialog>
              );
              }