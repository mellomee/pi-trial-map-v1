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


              }