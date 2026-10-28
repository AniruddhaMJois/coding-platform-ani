import Link from 'next/link';
const { prisma } = require('@/lib/prisma');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ContestsPage() {
  const contests = await prisma.contest.findMany({
    include: {
      _count: {
        select: { problems: true }
      }
    },
    orderBy: { id: 'asc' }
  });

  return (
    <div className="container">
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Available Contests</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Participate in timed programming competitions or sharpen your algorithmic skills.
      </p>

      <div className="card-grid">
        {contests.map((c) => (
          <div key={c.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className={`badge ${c.status === 'active' ? 'badge-easy' : 'badge-medium'}`}>
                {c.status.toUpperCase()}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {c._count.problems} Problems
              </span>
            </div>
            <h3>{c.title}</h3>
            <p>{c.description}</p>
            {c.status === 'active' ? (
              <Link href="/problems" className="nav-btn primary" style={{ display: 'inline-block', textAlign: 'center' }}>
                Enter Contest →
              </Link>
            ) : (
              <span className="nav-btn" style={{ opacity: 0.6, cursor: 'not-allowed', display: 'inline-block' }}>
                Coming Soon
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
