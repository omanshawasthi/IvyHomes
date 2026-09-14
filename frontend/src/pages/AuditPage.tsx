import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/client';
import type { FindingDTO } from '../../../shared/types/index.js';
import './AuditPage.css';

export function AuditPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', 'findings'],
    queryFn: analyticsApi.findings,
  });

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ height: '80px', marginBottom: 'var(--space-6)' }} />
        <div className="skeleton" style={{ height: '400px' }} />
      </div>
    );
  }

  if (isError || !data?.findings) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <span className="empty-icon">⚠</span>
          <p>Findings not available. Run <code>npm run analyze</code> on the backend.</p>
        </div>
      </div>
    );
  }

  const confirmed = data.findings.filter(f => f.status === 'confirmed');
  const ruledOut  = data.findings.filter(f => f.status === 'ruled_out');

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">API Audit Report</h1>
          <p className="page-subtitle">Discrepancies found between API documentation and actual behaviour</p>
        </div>
      </header>

      <section className="audit-section">
        <h2 className="section-title">
          Confirmed Findings <span className="badge">{confirmed.length}</span>
        </h2>
        <div className="findings-list">
          {confirmed.map(finding => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
        </div>
      </section>

      <section className="audit-section">
        <h2 className="section-title">
          Ruled Out Hypotheses <span className="badge badge--neutral">{ruledOut.length}</span>
        </h2>
        <div className="findings-list findings-list--compact">
          {ruledOut.map(finding => (
            <div key={finding.id} className="ruled-out-item">
              <span className="ruled-out-id">{finding.id}</span>
              <span className="ruled-out-reason">{finding.ruling_reason}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FindingCard({ finding }: { finding: FindingDTO }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Only load live verification when the accordion is opened
  const { data: verification, isLoading } = useQuery({
    queryKey: ['analytics', 'verify', finding.id],
    queryFn: () => analyticsApi.verifyFinding(finding.id),
    enabled: isOpen && finding.evidence.length > 0,
  });

  return (
    <div className="finding-card">
      <div className="finding-card__header" onClick={() => setIsOpen(!isOpen)}>
        <div className="finding-card__meta">
          <span className="finding-badge">{finding.category}</span>
          <code className="finding-endpoint">{finding.endpoint}</code>
        </div>
        <h3 className="finding-card__title">{finding.id}</h3>
        <span className="finding-card__toggle">{isOpen ? '−' : '+'}</span>
      </div>

      {isOpen && (
        <div className="finding-card__body">
          <div className="finding-grid">
            <div className="finding-col">
              <h4 className="finding-col-title">Documented Behaviour</h4>
              <p className="finding-text finding-text--doc">{finding.documented}</p>
            </div>
            <div className="finding-col">
              <h4 className="finding-col-title">Actual Behaviour</h4>
              <p className="finding-text finding-text--actual">{finding.actual}</p>
            </div>
          </div>

          <div className="finding-details">
            <div className="finding-detail-row">
              <strong>Methodology:</strong> {finding.how_found}
            </div>
            <div className="finding-detail-row">
              <strong>Impact:</strong> {finding.impact}
            </div>
          </div>

          {finding.evidence.length > 0 && (
            <div className="finding-evidence">
              <h4 className="finding-col-title">Live Verification</h4>
              {isLoading ? (
                <div className="skeleton" style={{ height: '60px' }} />
              ) : verification ? (
                <div className="evidence-list">
                  {(verification as any).live_verification?.map((v: any) => (
                    <div key={v.evidence_id} className={`evidence-item ${v.status === 'fulfilled' ? 'evidence-item--ok' : 'evidence-item--error'}`}>
                      <code>{v.evidence_id}</code>
                      <span className="evidence-status">
                        {v.status === 'fulfilled' ? 'Live data matches' : `Failed: ${v.error}`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="finding-text">Verification unavailable.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
