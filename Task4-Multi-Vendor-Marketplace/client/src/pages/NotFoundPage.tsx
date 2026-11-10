import { Link } from 'react-router-dom';
import { EmptyState } from '../components/Feedback';

export function NotFoundPage() {
  return (
    <EmptyState title="We could not find that page">
      <Link to="/">Return to the marketplace</Link>
    </EmptyState>
  );
}
