import fs from 'fs';
import path from 'path';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock pdfjs so we don't actually parse a PDF during tests
jest.mock('pdfjs-dist/build/pdf', () => {
  return {
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: 1,
        getPage: jest.fn().mockResolvedValue({
          getViewport: jest.fn().mockReturnValue({ width: 100, height: 100 }),
          render: jest.fn().mockReturnValue({ promise: Promise.resolve() }),
          getTextContent: jest.fn().mockResolvedValue({ items: [] }),
        }),
      }),
    }),
    GlobalWorkerOptions: { workerSrc: '' },
  };
});

jest.mock('pdfjs-dist/build/pdf.worker.entry', () => '');

// Import component AFTER mocks
import AnnotatePage from '../app/annotate/page';

// Stub canvas APIs that JSDOM doesn't implement
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ({
    fillRect: () => {},
    drawImage: () => {},
  }),
});

HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,TEST_IMAGE';

// Stub File#arrayBuffer, not implemented in JSDOM yet
if (!File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function () {
    return Promise.resolve(new ArrayBuffer(8));
  };
}


describe('AnnotatePage PDF upload', () => {
  it('renders an image for each PDF page uploaded', async () => {
    const pdfBuffer = fs.readFileSync(path.join(process.cwd(), 'test-files', 'dummy.pdf'));
    const file = new File([pdfBuffer], 'dummy.pdf', { type: 'application/pdf' });

    render(<AnnotatePage />);

    const input = screen.getByTestId('file-input');
    await fireEvent.change(input, { target: { files: [file] } });

    const images = await screen.findAllByRole('img');
    const mainImages = images.filter((img) => img.getAttribute('alt').startsWith('PDF page'));
    expect(mainImages).toHaveLength(1);
    expect(mainImages[0]).toHaveAttribute('src', 'data:image/png;base64,TEST_IMAGE');
  });
}); 