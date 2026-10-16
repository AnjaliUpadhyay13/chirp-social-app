export function Skeleton({ width = '100%', height = 14, radius = 6, className = '' }) {
  return <span className={`skeleton ${className}`} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

// Placeholder shaped like a post card; reused by the feed in Phase 3.
export function PostSkeleton() {
  return (
    <div className="post-skeleton" role="status" aria-label="Loading">
      <Skeleton width={44} height={44} radius={999} />
      <div className="post-skeleton__body">
        <Skeleton width="40%" />
        <Skeleton width="95%" />
        <Skeleton width="70%" />
      </div>
    </div>
  );
}
