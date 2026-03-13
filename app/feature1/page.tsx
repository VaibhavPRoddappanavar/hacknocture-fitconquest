import Link from "next/link";

export default function Feature1() {
  return (
    <div className="feature-page feature-1-page" id="feature-1-page">
      <Link href="/" className="back-link">
        ← Back to Home
      </Link>

      <div className="page-icon">⚡</div>

      <h1>Feature 1</h1>
      <p className="subtitle">
        Supercharge your training with intelligent workout tracking, adaptive
        plans, and real-time analytics that evolve with you.
      </p>

      <div className="content-card">
        <h3>What&apos;s Included</h3>
        <ul>
          <li>
            <span className="check">✓</span>
            Real-time workout logging &amp; analytics
          </li>
          <li>
            <span className="check">✓</span>
            AI-powered adaptive training plans
          </li>
          <li>
            <span className="check">✓</span>
            Progress graphs and milestone tracking
          </li>
          <li>
            <span className="check">✓</span>
            Smart recovery recommendations
          </li>
          <li>
            <span className="check">✓</span>
            Integration with wearable devices
          </li>
        </ul>
      </div>
    </div>
  );
}
