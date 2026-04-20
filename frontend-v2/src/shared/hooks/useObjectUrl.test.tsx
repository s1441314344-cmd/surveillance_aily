import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useObjectUrl } from './useObjectUrl';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Harness({ file }: { file: File | null }) {
  const objectUrl = useObjectUrl(file);
  return <span data-testid="object-url">{objectUrl ?? 'null'}</span>;
}

describe('useObjectUrl', () => {
  it('creates and revokes object URLs with the current file lifecycle', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview-a');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const firstFile = new File(['first'], 'first.jpg', { type: 'image/jpeg' });
    const secondFile = new File(['second'], 'second.jpg', { type: 'image/jpeg' });

    const view = render(<Harness file={firstFile} />);
    expect(view.getByTestId('object-url').textContent).toBe('blob:preview-a');
    expect(createObjectURL).toHaveBeenCalledWith(firstFile);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    createObjectURL.mockReturnValueOnce('blob:preview-b');
    view.rerender(<Harness file={secondFile} />);

    expect(view.getByTestId('object-url').textContent).toBe('blob:preview-b');
    expect(createObjectURL).toHaveBeenCalledWith(secondFile);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-a');

    view.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-b');
  });

  it('returns null when no file is selected', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:unused');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const view = render(<Harness file={null} />);

    expect(view.getByTestId('object-url').textContent).toBe('null');
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});
