import { APPLICATION_STATUS_LABELS, formatDateTime, ROLE_LABELS } from '../lib/format';
import type { StatusHistoryEntry } from '../types';

export function StatusTimeline({ history }: { history: StatusHistoryEntry[] }) {
  return (
    <ol className="timeline">
      {[...history].reverse().map((entry) => (
        <li key={entry.id}>
          <strong>{APPLICATION_STATUS_LABELS[entry.newStatus]}</strong>
          <span>
            {formatDateTime(entry.timestamp)} · by {ROLE_LABELS[entry.changedBy.role].toLowerCase()}
          </span>
          {entry.previousStatus && (
            <span className="timeline-from">
              from {APPLICATION_STATUS_LABELS[entry.previousStatus]}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
