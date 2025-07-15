'use client';

import ObjectRegistry from '../../components/ObjectRegistry';

export default function ObjectsPage() {
  return (
    <main className="flex flex-col p-4 gap-6 min-h-screen">
      <h1 className="text-2xl font-semibold">Object Registry</h1>
      <ObjectRegistry />
    </main>
  );
} 