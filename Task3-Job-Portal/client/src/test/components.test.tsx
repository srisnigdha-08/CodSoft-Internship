import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../components/Modal';
import { SkillEditor } from '../components/SkillEditor';
import { ApplicationBadge, AsyncView, Field, Pagination } from '../components/ui';
import { ApiError } from '../api/client';

const meta = { page: 2, limit: 10, total: 30, totalPages: 3 };

describe('Pagination', () => {
  it('moves between pages', async () => {
    const onChange = vi.fn();
    render(<Pagination meta={meta} onChange={onChange} />);
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('disables Previous on the first page and hides for a single page', () => {
    const { rerender, container } = render(
      <Pagination meta={{ ...meta, page: 1 }} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    rerender(<Pagination meta={{ ...meta, totalPages: 1 }} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ApplicationBadge', () => {
  it('shows a readable status', () => {
    render(<ApplicationBadge status="UNDER_REVIEW" />);
    expect(screen.getByText('Under Review')).toHaveClass('app-under_review');
  });
});

describe('AsyncView', () => {
  const reload = vi.fn().mockResolvedValue(undefined);

  it('shows loading, then content', () => {
    const { rerender } = render(
      <AsyncView state={{ loading: true, reload }}>{(value: string) => <p>{value}</p>}</AsyncView>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(
      <AsyncView state={{ loading: false, data: 'Loaded', reload }}>
        {(value: string) => <p>{value}</p>}
      </AsyncView>,
    );
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    render(
      <AsyncView state={{ loading: false, error: new ApiError(500, 'Server trouble'), reload }}>
        {() => <p>never</p>}
      </AsyncView>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Server trouble');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalled();
  });
});

describe('ConfirmDialog', () => {
  it('runs the action on confirm and then closes', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <ConfirmDialog title="Delete" message="Sure?" confirmLabel="Delete it" onConfirm={onConfirm} onClose={onClose} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete it' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('does nothing on cancel and closes on Escape', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog title="Delete" message="Sure?" confirmLabel="Delete it" onConfirm={onConfirm} onClose={onClose} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.keyboard('{Escape}');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

function SkillHarness() {
  const [skills, setSkills] = useState(['Go']);
  return (
    <Field label="Skills" group>
      <SkillEditor skills={skills} onChange={setSkills} placeholder="skill" />
    </Field>
  );
}

describe('SkillEditor', () => {
  it('keeps a skill when its chip text or the field label is clicked', async () => {
    render(<SkillHarness />);
    await userEvent.click(screen.getByText('Skills'));
    await userEvent.click(screen.getByText('Go'));
    expect(screen.getByRole('button', { name: 'Remove Go' })).toBeInTheDocument();
  });

  it('adds skills, ignores case duplicates and removes', async () => {
    render(<SkillHarness />);
    const input = screen.getByPlaceholderText('skill');
    await userEvent.type(input, 'Rust{Enter}');
    await userEvent.type(input, 'go{Enter}');
    expect(screen.getByText('Rust')).toBeInTheDocument();
    expect(screen.queryByText('go')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Go' }));
    expect(screen.queryByText('Go')).not.toBeInTheDocument();
  });
});
