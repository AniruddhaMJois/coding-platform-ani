import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="container">
      <section className="hero">
        <h1>Assess Skill with Integrity</h1>
        <p>
          A high-performance coding assessment environment with sandboxed multi-language execution, 
          server-secured hidden test cases, and real-time proctoring.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
          <Link href="/problems" className="nav-btn primary" style={{ padding: '0.75rem 1.75rem', fontSize: '1rem' }}>
            Browse Practice Problems
          </Link>
          <Link href="/contests" className="nav-btn" style={{ padding: '0.75rem 1.75rem', fontSize: '1rem' }}>
            View Contests
          </Link>
        </div>
      </section>

      <div className="card-grid">
        <div className="card">
          <h3>⚡ Secure Two-Tier Execution</h3>
          <p>
            Test your logic quickly against public sample cases, then submit against secret server-side 
            hidden cases evaluated in sandboxed containers.
          </p>
        </div>

        <div className="card">
          <h3>🛡️ Seamless Proctoring</h3>
          <p>
            Real-time multi-tab synchronization and event monitoring deter tab-switching and unauthorized 
            copy-pasting without annoying blocking alert dialogs.
          </p>
        </div>

        <div className="card">
          <h3>🛠️ Dynamic Admin CMS</h3>
          <p>
            Instructors and contest organizers can create challenges, edit constraints, and update test 
            cases live with zero code redeployments.
          </p>
        </div>
      </div>
    </div>
  );
}
