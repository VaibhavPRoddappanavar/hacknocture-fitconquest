import Link from "next/link";

export default function Feature2() {
  return (
    <div className="feature-page feature-2-page" id="feature-2-page">
      <Link href="/" className="back-link">
        ← Back to Home
      </Link>

      <div className="page-icon">🎯</div>

      <h1>Feature 2</h1>
      <p className="subtitle">
        Take control of your nutrition with smart meal planning, calorie
        tracking, and detailed macro breakdowns for peak performance.
      </p>

      <div className="content-card">
        <h3>What&apos;s Included</h3>
        <ul>
          <li>
            <span className="check">✓</span>
            Personalized meal plan suggestions
          </li>
          <li>
            <span className="check">✓</span>
            Detailed calorie &amp; macro tracking
          </li>
          <li>
            <span className="check">✓</span>
            Barcode scanner for quick food logging
          </li>
          <li>
            <span className="check">✓</span>
            Hydration reminders &amp; tracking
          </li>
          <li>
            <span className="check">✓</span>
            Weekly nutrition performance reports
          </li>
        </ul>
      </div>
    </div>
  );
}
