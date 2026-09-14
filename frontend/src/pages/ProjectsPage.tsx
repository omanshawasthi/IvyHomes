import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/api/client';
import { useDebounce } from '@/hooks/useDebounce';
import type { ProjectDTO } from '../../../shared/types/index.js';
import './ListingsPage.css';

export function ProjectsPage() {
  const [page, setPage] = useState(1);
  const [localityInput, setLocalityInput] = useState('');
  const debouncedLocality = useDebounce(localityInput, 600);
  
  const [filters, setFilters] = useState({
    project_status: '',
    sort_by: 'price_max',
  });

  useEffect(() => {
    setPage(1);
  }, [filters, debouncedLocality]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', page, filters, debouncedLocality],
    queryFn: () => projectsApi.list({
      page,
      limit: 12,
      locality: debouncedLocality || undefined,
      project_status: filters.project_status || undefined,
      sort_by: filters.sort_by,
      order: filters.sort_by === 'launch_date' ? 'desc' : 'desc',
    }),
    placeholderData: (prev) => prev,
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">New Projects</h1>
          <p className="page-subtitle">Showing {data?.total.toLocaleString() ?? '—'} projects in Bangalore</p>
        </div>
      </header>

      <section className="filters-bar" aria-label="Filters">
        <div className="filter-group">
          <label htmlFor="filter-locality" className="filter-label">Locality</label>
          <input
            id="filter-locality"
            type="text"
            className="filter-input"
            placeholder="e.g. Bellandur"
            value={localityInput}
            onChange={(e) => setLocalityInput(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="filter-status" className="filter-label">Status</label>
          <select
            id="filter-status"
            className="filter-input"
            value={filters.project_status}
            onChange={(e) => handleFilterChange('project_status', e.target.value)}
          >
            <option value="">Any</option>
            <option value="under_construction">Under Construction</option>
            <option value="ready_to_move">Ready to Move</option>
            <option value="new_launch">New Launch</option>
          </select>
        </div>
        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          <label htmlFor="filter-sort" className="filter-label">Sort by</label>
          <select
            id="filter-sort"
            className="filter-input"
            value={filters.sort_by}
            onChange={(e) => handleFilterChange('sort_by', e.target.value)}
          >
            <option value="price_max">Price (High to Low)</option>
            <option value="launch_date">Newest Launch</option>
            <option value="total_units">Largest Projects</option>
          </select>
        </div>
      </section>

      {isError ? (
        <div className="empty-state">
          <span className="empty-icon">⚠</span>
          <p>Could not load projects. Please try again.</p>
        </div>
      ) : isLoading && !data ? (
        <div className="listing-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="listing-card skeleton" style={{ height: '360px' }} />
          ))}
        </div>
      ) : data?.results.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">⊘</span>
          <p>No projects match your filters.</p>
        </div>
      ) : (
        <>
          <div className="listing-grid">
            {data?.results.map(project => (
              <ProjectCard key={project.project_id} project={project} />
            ))}
          </div>

          {data && data.total > data.page_size && (
            <div className="pagination">
              <button
                className="btn-secondary"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                ← Previous
              </button>
              <span className="pagination-info">
                Page {page} of {Math.ceil(data.total / data.page_size)}
              </span>
              <button
                className="btn-secondary"
                disabled={page >= Math.ceil(data.total / data.page_size)}
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectDTO }) {
  const formatLakhs = (val: number) => `₹${(val / 100000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}L`;

  return (
    <article className="listing-card">
      <div className="listing-card__image-wrap">
        <span aria-hidden="true">◈</span>
      </div>
      <div className="listing-card__content">
        <div className="listing-card__signage">
          <div className="signage-plate">
            <span className="price">
              {formatLakhs(project.price_min)} – {formatLakhs(project.price_max)}
            </span>
            <span className="area">{project.total_units} units</span>
          </div>
        </div>
        
        <div className="listing-card__header">
          <h3 className="listing-card__title text-truncate" title={project.apartment_name}>
            {project.apartment_name}
          </h3>
          <p className="listing-card__locality">
            By {project.developer_name} • <span style={{ textTransform: 'capitalize' }}>{project.locality}</span>
          </p>
        </div>

        <div className="listing-card__specs">
          <div className="spec-item">
            <span className="spec-label">Status</span>
            <span className="spec-value" style={{ textTransform: 'capitalize' }}>
              {project.project_status.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Launch</span>
            <span className="spec-value">{new Date(project.launch_date).getFullYear()}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Listings</span>
            <span className="spec-value">{project.total_listings} documented</span>
          </div>
        </div>
      </div>
    </article>
  );
}
