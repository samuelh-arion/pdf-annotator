'use client';

import PdfAnnotator from '../../components/PdfAnnotator';

export default function AnnotatePage() {
  return (
    <main className="flex flex-col items-center p-4 gap-6 min-h-screen">
      <PdfAnnotator />
    </main>
  );
} 