import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ObjectsPage from '../app/objects/page';

describe('ObjectRegistry CRUD', () => {
  beforeEach(() => {
    // Clear storage before each test
    localStorage.clear();
  });

  it('allows creating a new object and persisting it', () => {
    render(<ObjectsPage />);

    // Initially no objects
    expect(screen.getByText(/No objects saved yet/)).toBeInTheDocument();

    // Open builder
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Object/i }));

    // Fill out object name
    const nameInput = screen.getByPlaceholderText('e.g. Car');
    fireEvent.change(nameInput, { target: { value: 'Car' } });

    // Add a field
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Field/i }));
    const fieldNameInput = screen.getByPlaceholderText('field name');
    fireEvent.change(fieldNameInput, { target: { value: 'make' } });

    // Save object
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    // New object appears in list
    expect(screen.getByText('Car')).toBeInTheDocument();

    // Storage should have persisted object
    const stored = JSON.parse(localStorage.getItem('objectRegistry'));
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Car');
    expect(stored[0].fields[0].name).toBe('make');
  });

  it('allows deleting an object', () => {
    // Pre-populate storage with one object
    localStorage.setItem(
      'objectRegistry',
      JSON.stringify([{ name: 'Car', fields: [{ name: 'make', type: 'string' }], isSubobject: false }])
    );

    // Stub confirm dialog to auto-confirm
    jest.spyOn(window, 'confirm').mockImplementation(() => true);

    render(<ObjectsPage />);

    expect(screen.getByText('Car')).toBeInTheDocument();

    // Click delete
    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

    // Should be removed from UI
    expect(screen.queryByText('Car')).not.toBeInTheDocument();

    // Storage empty
    expect(JSON.parse(localStorage.getItem('objectRegistry'))).toHaveLength(0);
  });

  it('saves immediately when system prompt changed but no field changes', () => {
    // Pre-populate storage with one object
    localStorage.setItem(
      'objectRegistry',
      JSON.stringify([{ name: 'Car', fields: [{ name: 'make', type: 'string' }], isSubobject: false, systemPrompt:'' }])
    );

    render(<ObjectsPage />);

    // Click edit
    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));

    // Change system prompt
    const textarea = screen.getByPlaceholderText(/Provide a custom system prompt/i);
    fireEvent.change(textarea, { target: { value: 'Please extract car info' } });

    // Save
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    // Builder should close – no "Edit Object" heading
    expect(screen.queryByText(/Edit Object/)).not.toBeInTheDocument();

    // Modal should not appear
    expect(screen.queryByText(/Confirm Annotation Migration/)).not.toBeInTheDocument();

    // Storage updated
    const stored = JSON.parse(localStorage.getItem('objectRegistry'));
    expect(stored[0].systemPrompt).toBe('Please extract car info');
  });

  it('adds a new field and saves immediately when there are no annotations', () => {
    // Existing object
    localStorage.setItem('objectRegistry', JSON.stringify([
      { name:'Car', fields:[{name:'make',type:'string'}], isSubobject:false, version:1 }
    ]));
    // No annotations stored
    localStorage.setItem('pdfData', JSON.stringify({}));

    render(<ObjectsPage />);

    // Click edit
    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));

    // Add a new field
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Field/i }));
    const fieldInputs = screen.getAllByPlaceholderText('field name');
    fireEvent.change(fieldInputs[fieldInputs.length-1], { target:{ value:'color' } });

    // Save
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    // Builder should close
    expect(screen.queryByText(/Edit Object/)).not.toBeInTheDocument();
    // No modal
    expect(screen.queryByText(/Confirm Annotation Migration/)).not.toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem('objectRegistry'));
    expect(stored[0].fields.some(f=>f.name==='color')).toBe(true);
  });

  it('shows migration modal and marks pendingValidation when new field created with reviewed annotations', async () => {
    const object = { name:'Car', fields:[{name:'make',type:'string'}], version:1 };
    localStorage.setItem('objectRegistry', JSON.stringify([object]));
    const pdfData={file1:{annotations:[{id:'a1',objectName:'Car',objectVersion:1,humanRevised:true,values:{make:'Ford'},pageIndex:0}]}};
    localStorage.setItem('pdfData', JSON.stringify(pdfData));

    render(<ObjectsPage />);

    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Field/i }));
    const fieldInputs = screen.getAllByPlaceholderText('field name');
    fireEvent.change(fieldInputs[fieldInputs.length-1], { target:{ value:'color' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    // Modal should appear
    await waitFor(() => expect(screen.getByText(/Confirm Annotation Migration/)).toBeInTheDocument());

    // Apply changes
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }));

    // Modal closes
    await waitFor(() => expect(screen.queryByText(/Confirm Annotation Migration/)).not.toBeInTheDocument());

    const updatedPdf = JSON.parse(localStorage.getItem('pdfData'));
    expect(updatedPdf.file1.annotations[0].pendingValidation).toBe(true);
  });

  it('renames field automatically for reviewed annotation (minor change)', async () => {
    const object = { name:'Car', fields:[{name:'make',type:'string'}], version:1 };
    localStorage.setItem('objectRegistry', JSON.stringify([object]));
    const pdfData={file1:{annotations:[{id:'a1',objectName:'Car',objectVersion:1,humanRevised:true,values:{make:'Ford'},pageIndex:0}]}};
    localStorage.setItem('pdfData', JSON.stringify(pdfData));

    render(<ObjectsPage />);

    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    // Change field name from make to brandName
    const nameInputs = screen.getAllByPlaceholderText('field name');
    fireEvent.change(nameInputs[0], { target:{ value:'brandName' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    // Modal appears
    await waitFor(() => expect(screen.getByText(/Confirm Annotation Migration/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }));

    const updatedPdf = JSON.parse(localStorage.getItem('pdfData'));
    const ann = updatedPdf.file1.annotations[0];
    expect(ann.values).toHaveProperty('brandName', 'Ford');
    expect(ann.pendingValidation).not.toBe(true);
  });

  it('flags reviewed annotation pendingValidation on type change (major)', async () => {
    const object = { name:'Car', fields:[{name:'mileage',type:'string'}], version:1 };
    localStorage.setItem('objectRegistry', JSON.stringify([object]));
    const pdfData={file1:{annotations:[{id:'a1',objectName:'Car',objectVersion:1,humanRevised:true,values:{mileage:'10000'},pageIndex:0}]}};
    localStorage.setItem('pdfData', JSON.stringify(pdfData));

    render(<ObjectsPage />);

    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    // Change field type from string to number (major change)
    const typeSelects = screen.getAllByRole('combobox');
    fireEvent.change(typeSelects[0], { target: { value: 'number' } });

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    // Modal appears
    await waitFor(() => expect(screen.getByText(/Confirm Annotation Migration/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }));

    const updatedPdf = JSON.parse(localStorage.getItem('pdfData'));
    expect(updatedPdf.file1.annotations[0].pendingValidation).toBe(true);
  });
}); 