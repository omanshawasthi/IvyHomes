import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/client';
import './InsightsPage.css';

export function InsightsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: analyticsApi.summary,
  });

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ height: '80px', marginBottom: 'var(--space-6)' }} />
        <div className="skeleton" style={{ height: '400px' }} />
      </div>
    );
  }

  if (isError || !data?.local_analysis) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <span className="empty-icon">⚠</span>
          <p>Analysis data not available. Please run <code>npm run analyze</code> on the server.</p>
        </div>
      </div>
    );
  }

  const { local_analysis: a, upstream_error } = data;
  const ans = a.answers as Record<string, any>;
  const insights = a.insights as Record<string, any>;
  const dataset = a.dataset as Record<string, any>;

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Market Insights</h1>
          <p className="page-subtitle">Generated offline via full dataset ingestion</p>
        </div>
      </header>

      {/* ── Dataset Stats ────────────────────────────────────────── */}
      <section className="stats-grid">
        <div className="stat-card stat-card--dark">
          <div className="stat-card__label">Total Listings</div>
          <div className="stat-card__value">{dataset.total_listings.toLocaleString()}</div>
        </div>
        <div className="stat-card stat-card--dark">
          <div className="stat-card__label">Total Rentals</div>
          <div className="stat-card__value">{dataset.total_rentals.toLocaleString()}</div>
        </div>
        <div className="stat-card stat-card--dark">
          <div className="stat-card__label">Total Projects</div>
          <div className="stat-card__value">{dataset.total_projects.toLocaleString()}</div>
        </div>
      </section>

      {/* ── The 10 Assignment Answers ────────────────────────────── */}
      <section className="answers-section">
        <h2 className="section-title">Assignment Metrics</h2>
        
        <div className="answers-grid">
          <AnswerCard 
            num="1" label="Total Listing Records" 
            value={ans.total_listing_records.toLocaleString()} 
            sub="Raw record count from pagination" 
          />
          <AnswerCard 
            num="2" label="Unique Properties" 
            value={ans.unique_properties.toLocaleString()} 
            sub={`Exact dedup (${insights.unique_loose.toLocaleString()} loose)`} 
          />
          <AnswerCard 
            num="3" label="Active Listings" 
            value={ans.active_listings.toLocaleString()} 
            sub="is_live = true" 
          />
          <AnswerCard 
            num="4" label="Corrupt Records" 
            value={ans.corrupt_listing_ids.length.toLocaleString()} 
            sub="Impossible geometry (e.g. carpet > sba)" 
            warning
          />
          <AnswerCard 
            num="5" label="Monthly Rent (Bellandur)" 
            value={`₹${(ans.total_monthly_rent / 100000).toFixed(2)}L`} 
            sub={`Across ${insights.bellandur_rentals} properties`} 
          />
          <AnswerCard 
            num="6" label="Avg Price/Sqft (2BHK)" 
            value={`₹${ans.avg_price_per_sqft_2bhk.toLocaleString()}`} 
            sub={`From ${insights.eligible_2bhk_count} eligible listings (excluding fakes/corrupt)`} 
          />
          <AnswerCard 
            num="7" label="Costliest Project" 
            value={ans.costliest_project.project_id} 
            sub={`Max price: ₹${(ans.costliest_project.price_max_inr / 10000000).toFixed(2)}Cr`} 
          />
          <AnswerCard 
            num="8" label="Listings (Last 7 Days)" 
            value={ans.listings_last_7_days.toLocaleString()} 
            sub="Relative to reference time" 
          />
          <AnswerCard 
            num="9" label="Fake Listings" 
            value={ans.fake_listing_ids.length.toLocaleString()} 
            sub="Contact reuse / templates" 
            warning
          />
          <AnswerCard 
            num="10" label="Project Discrepancies" 
            value={ans.projects_with_wrong_listing_count.toLocaleString()} 
            sub="total_listings != actual count" 
            warning
          />
        </div>
      </section>

      {/* ── Upstream Status ─────────────────────────────────────── */}
      <section className="upstream-status">
        <h2 className="section-title">Upstream Analytics Endpoint</h2>
        <div className={`status-banner ${upstream_error ? 'status-banner--error' : 'status-banner--success'}`}>
          <div className="status-banner__icon">{upstream_error ? '⊘' : '✓'}</div>
          <div className="status-banner__text">
            <strong>GET /v1/analytics/summary</strong>
            <p>{upstream_error ? `Failed: ${upstream_error}` : 'Endpoint is available and returning data.'}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function AnswerCard({ num, label, value, sub, warning = false }: any) {
  return (
    <div className={`answer-card ${warning ? 'answer-card--warning' : ''}`}>
      <div className="answer-card__num">Q{num}</div>
      <div className="answer-card__content">
        <div className="answer-card__label">{label}</div>
        <div className="answer-card__value">{value}</div>
        <div className="answer-card__sub">{sub}</div>
      </div>
    </div>
  );
}
