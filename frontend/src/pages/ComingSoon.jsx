import { useEffect } from 'react';
import PageHeader from './PageHeader.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function ComingSoon({ title, phase }) {
  useEffect(() => { document.title = `${title} / Chirp`; }, [title]);
  return (
    <>
      <PageHeader title={title} />
      <EmptyState title={`${title} is on the way`} message={`This page is built in Phase ${phase} of the plan.`} />
    </>
  );
}
