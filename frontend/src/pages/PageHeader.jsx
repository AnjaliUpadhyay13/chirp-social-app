export default function PageHeader({ title, subtitle }) {
  return (
    <div className="page-header">
      <h1 className="page-header__title">{title}</h1>
      {subtitle && <p className="page-header__sub">{subtitle}</p>}
    </div>
  );
}
