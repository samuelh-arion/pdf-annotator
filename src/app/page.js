'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex flex-col items-center text-center gap-8 py-24">
      <h1 className="text-5xl font-bold tracking-tight">Annotator</h1>
      <p className="text-lg text-gray-600 max-w-xl">
        Upload PDFs, define structured objects, and create rich annotations—all in one
        minimalist interface.
      </p>

      <div className="w-full max-w-3xl aspect-video">
        <iframe
          src="https://www.loom.com/embed/19151676546b4b52b056bab4d6d7e580?sid=1289fe6b-6257-4bd6-b6e6-59b2b38edeed"
          title="Annotator walkthrough video"
          allowFullScreen
          frameBorder="0"
          className="w-full h-full rounded shadow-lg"
        />
      </div>

      <div className="flex gap-4">
        <Link
          href="/annotate"
          className="bg-blue-600 text-white px-5 py-2 rounded shadow hover:bg-blue-700 transition-colors"
        >
          Start Annotating
        </Link>
        <Link
          href="/objects"
          className="bg-gray-100 text-gray-800 px-5 py-2 rounded shadow hover:bg-gray-200 transition-colors"
        >
          Manage Objects
        </Link>
      </div>
    </main>
  );
}
