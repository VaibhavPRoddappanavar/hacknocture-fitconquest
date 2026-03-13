import Link from "next/link";

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="hero" id="hero">
        <span className="hero-badge">🚀 Now in Beta</span>
        <h1>
          Conquer Your
          <br />
          <span className="gradient-text">Fitness Goals</span>
        </h1>
        <p>
          A premium fitness companion designed to help you track progress, crush
          workouts, and transform your body — one rep at a time.
        </p>
      </section>

      {/* Features Section */}
      <section className="features-section" id="features">
        <span className="section-label">Explore</span>
        <h2>Core Features</h2>

        <div className="features-grid">
          {/* Feature 1 Card */}
          <Link href="/feature1" className="feature-card" id="feature-1-card">
            <div className="card-icon">⚡</div>
            <h3>Feature 1</h3>
            <p>
              Unlock powerful workout tracking with real-time analytics,
              adaptive training plans, and intelligent progress insights
              tailored to your goals.
            </p>
            <span className="card-arrow">
              Explore Feature 1 →
            </span>
          </Link>

          {/* Feature 2 Card */}
          <Link href="/feature2" className="feature-card" id="feature-2-card">
            <div className="card-icon">🎯</div>
            <h3>Feature 2</h3>
            <p>
              Dive into nutrition planning with smart meal suggestions,
              calorie tracking, and macro breakdowns designed for peak
              performance.
            </p>
            <span className="card-arrow">
              Explore Feature 2 →
            </span>
          </Link>
        </div>
      </section>
    </>
  );
}
