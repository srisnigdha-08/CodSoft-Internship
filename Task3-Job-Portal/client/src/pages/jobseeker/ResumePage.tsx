import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { OWN_RESUME_URL, seekerApi } from '../../api';
import { ConfirmDialog } from '../../components/Modal';
import { AsyncView, EmptyState, PageHeader } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAction } from '../../hooks/useAction';
import { useAsync } from '../../hooks/useAsync';
import { formatDate, formatFileSize } from '../../lib/format';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx';

export function ResumePage() {
  const state = useAsync(useCallback(() => seekerApi.resume(), []));
  const toast = useToast();
  const { busy, run } = useAction();
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    // Quick feedback only; the server repeats and extends these checks.
    if (!/\.(pdf|docx?)$/i.test(file.name)) {
      toast.error('Only PDF, DOC and DOCX files are allowed.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('The file must be 5 MB or smaller.');
      return;
    }
    if (await run(() => seekerApi.uploadResume(file), 'Resume uploaded.')) {
      await state.reload();
    }
  };

  const chooseFile = () => inputRef.current?.click();

  return (
    <>
      <PageHeader title="Resume" subtitle="PDF, DOC or DOCX, up to 5 MB. Sent with each application." />
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="visually-hidden"
        aria-label="Choose resume file"
        onChange={(event) => void onFile(event)}
      />
      <AsyncView state={state}>
        {(resume) =>
          resume ? (
            <section className="card resume-card">
              <div className="file-icon" aria-hidden="true">
                {resume.originalName.split('.').pop()?.toUpperCase()}
              </div>
              <div className="resume-info">
                <strong>{resume.originalName}</strong>
                <span>
                  {formatFileSize(resume.sizeBytes)} · Uploaded {formatDate(resume.createdAt)}
                </span>
              </div>
              <div className="row-actions wrap">
                {resume.mimeType === 'application/pdf' && (
                  <a className="btn btn-secondary btn-sm" href={`${OWN_RESUME_URL}?view=1`} target="_blank" rel="noreferrer">
                    View
                  </a>
                )}
                <a className="btn btn-secondary btn-sm" href={OWN_RESUME_URL}>
                  Download
                </a>
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={chooseFile}>
                  {busy ? 'Uploading…' : 'Replace'}
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
                  Remove
                </button>
              </div>
            </section>
          ) : (
            <EmptyState
              title="No resume uploaded"
              message="Upload a resume to start applying for jobs."
              action={
                <button type="button" className="btn btn-primary" disabled={busy} onClick={chooseFile}>
                  {busy ? 'Uploading…' : 'Upload resume'}
                </button>
              }
            />
          )
        }
      </AsyncView>
      <p className="muted-note">
        Employers can only open a resume you submitted to one of their jobs. Replacing it here does
        not change what past applications received.
      </p>
      {confirmDelete && (
        <ConfirmDialog
          title="Remove resume"
          message="Remove your current resume? You will need another one before applying again."
          confirmLabel="Remove"
          danger
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            if (await run(() => seekerApi.deleteResume(), 'Resume removed.')) await state.reload();
          }}
        />
      )}
    </>
  );
}
