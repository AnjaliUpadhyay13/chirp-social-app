import { Link } from 'react-router-dom';
import PageHeader from './PageHeader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Button from '../components/Button.jsx';

export default function NotFound() {
  return (
    <>
      <PageHeader title="Page not found" />
      <EmptyState icon="alert" title="This page doesn't exist" message="The link may be broken or the page may have moved."
        action={<Link to="/"><Button size="sm">Go home</Button></Link>} />
    </>
  );
}
