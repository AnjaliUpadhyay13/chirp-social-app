import EmptyState from './EmptyState.jsx';

export default function RightSidebar() {
  return (
    <aside className="right-sidebar" aria-label="Trends and suggestions">
      <section className="card">
        <h2 className="card__title">Trends for you</h2>
        <EmptyState icon="search" title="No trends yet" message="Trending topics appear here once people start posting (Phase 5)." />
      </section>
      <section className="card">
        <h2 className="card__title">Who to follow</h2>
        <EmptyState icon="user" title="No suggestions yet" message="Suggested accounts arrive with profiles and follows (Phase 4-5)." />
      </section>
    </aside>
  );
}
