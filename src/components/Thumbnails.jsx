"use client";

export default function Thumbnails({ images = [], current = 0, onSelect = () => {} }) {
  if (!images.length) return null;
  return (
    <div className="flex flex-col gap-2 overflow-y-auto max-h-screen pr-2">
      {images.map((src, idx) => (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-tabindex
        <img
          key={idx}
          src={src}
          alt={`Page ${idx + 1}`}
          onClick={() => onSelect(idx)}
          tabIndex={0}
          className={`w-24 border cursor-pointer rounded ${idx === current ? 'ring-2 ring-blue-600' : 'opacity-70 hover:opacity-100'}`}
        />
      ))}
    </div>
  );
} 