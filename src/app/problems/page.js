import Link from 'next/link';
const { prisma } = require('@/lib/prisma');

export default async function ProblemsPage() {
  const problems = await prisma.problem.findMany({
    include: {
      _count: {
        select: {
          testCases: true,
          submissions: true
        }
      }
    },
    orderBy: { id: 'asc' }
  });

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Practice Problems</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Solve algorithmic challenges with instant compiler feedback across 5 languages.
          </p>
        </div>
        <Link href="/contests" className="nav-btn">
          ← Back to Contests
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {problems.map((p, idx) => (
          <div 
            key={p.id} 
            className="card"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)', width: '2rem' }}>
                #{idx + 1}
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                  <Link href={`/problems/${p.slug}`} style={{ color: '#fff' }}>
                    {p.title}
                  </Link>
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {p._count.submissions} Submissions • {p._count.testCases} Total Test Cases
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span className={`badge ${p.difficulty === 'Easy' ? 'badge-easy' : 'badge-medium'}`}>
                {p.difficulty}
              </span>
              <Link href={`/problems/${p.slug}`} className="nav-btn primary">
                Solve Challenge →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
