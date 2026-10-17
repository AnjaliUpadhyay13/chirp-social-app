import { Link } from 'react-router-dom';
import SuggestedUser from './SuggestedUser.jsx';
import TrendItem from './TrendItem.jsx';
import { Skeleton } from './Skeleton.jsx';
import { useRemote } from '../hooks/useRemote.js';
import { getSuggestions, getTrends } from '../services/search.js';

function Loading() {
  return <div className="side-loading" role="status" aria-label="Loading"><Skeleton width="45%" /><Skeleton width="70%" height={16} /><Skeleton width="35%" /></div>;
}

function SideError({ what, onRetry }) {
  return (
    <p className="side-note">
      Couldn&apos;t load {what}. <button type="button" className="link-btn" onClick={onRetry}>Retry</button>
    </p>
  );
}

export default function RightSidebar() {
  const trends = useRemote((signal) => getTrends(signal, 5));
  const people = useRemote((signal) => getSuggestions(signal, 3));

  return (
    <aside className="right-sidebar" aria-label="Trends and suggestions">
      <section className="card" aria-labelledby="side-trends">
        <h2 id="side-trends" className="card__title">Trends for you</h2>
        {trends.status === 'loading' && <Loading />}
        {trends.status === 'error' && <SideError what="trends" onRetry={trends.retry} />}
        {trends.status === 'ready' && (trends.data.length === 0
          ? <p className="side-note">No trends yet. Use #hashtags in your posts and they will show up here.</p>
          : <>
            {trends.data.map((t) => <TrendItem key={t.tag} trend={t} />)}
            <Link to="/explore" className="card__more">Show more</Link>
          </>)}
      </section>

      <section className="card" aria-labelledby="side-follow">
        <h2 id="side-follow" className="card__title">Who to follow</h2>
        {people.status === 'loading' && <Loading />}
        {people.status === 'error' && <SideError what="suggestions" onRetry={people.retry} />}
        {people.status === 'ready' && (people.data.length === 0
          ? <p className="side-note">No suggestions right now. Check back as more people join.</p>
          : <>
            {people.data.map((u) => <SuggestedUser key={u.id} user={u} compact />)}
            <Link to="/explore" className="card__more">Show more</Link>
          </>)}
      </section>
    </aside>
  );
}
