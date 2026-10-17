import { Link } from 'react-router-dom';

// One trending hashtag; clicking searches for it.
export default function TrendItem({ trend }) {
  const people = trend.authors > 1 ? ` · ${trend.authors} people` : '';
  return (
    <Link to={`/explore?q=${encodeURIComponent(`#${trend.tag}`)}`} className="trend">
      <span className="trend__meta">Trending</span>
      <strong className="trend__tag">#{trend.tag}</strong>
      <span className="trend__count">{trend.posts} {trend.posts === 1 ? 'post' : 'posts'}{people}</span>
    </Link>
  );
}
