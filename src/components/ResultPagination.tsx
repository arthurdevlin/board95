import Link from "next/link";

export default function ResultPagination({ page, pageCount, href, label }: {
  page: number;
  pageCount: number;
  href: (page: number) => string;
  label: string;
}) {
  if (pageCount <= 1) return null;
  return <nav className="results-pagination" aria-label={label}>
    {page > 1 && <Link className="btn btn-secondary" prefetch={false} href={href(page - 1)}>Previous</Link>}
    <span aria-current="page">Page {page} of {pageCount}</span>
    {page < pageCount && <Link className="btn btn-secondary" prefetch={false} href={href(page + 1)}>Next</Link>}
  </nav>;
}
