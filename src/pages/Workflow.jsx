import { useState, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ─── Data ────────────────────────────────────────────────────────────────── */

const PIPELINE_STAGES = [
  {
    id: 'extract',
    layer: null,
    label: 'Extract',
    file: 'extract/extract_supply_chain.py',
    color: '#6c8ef5',
    icon: <DbIcon />,
    description: 'Reads the raw DataCo CSV (180k rows, 53 columns) into a Pandas DataFrame. Handles encoding, missing files, and logs every step.',
    inputs:  ['DataCoSupplyChainDataset.csv'],
    outputs: ['Raw DataFrame — 180,519 rows'],
    tech: ['Python', 'Pandas', 'Logging'],
    details: [
      'Auto-detects encoding (latin1 / utf-8-sig)',
      'Raises FileNotFoundError with clear message if file missing',
      'Logs row count, column count on load',
    ],
  },
  {
    id: 'validate',
    layer: null,
    label: 'Validate',
    file: 'validation/validate_supply_chain.py',
    color: '#a78cf7',
    icon: <CheckIcon />,
    description: 'Runs 6 quality checks and writes a validation_report.csv. Flags missing values, duplicates, negative prices, invalid dates, null customer IDs, and unknown delivery statuses.',
    inputs:  ['Raw DataFrame'],
    outputs: ['Validation report CSV', 'Issue count summary'],
    tech: ['Pandas', 'CSV'],
    details: [
      'Missing value detection per column with % coverage',
      'Duplicate Order Item ID check',
      'Negative price / sales guard',
      'Date parseability check',
      'Null Customer ID check',
      'Unknown Delivery Status enum check',
    ],
  },
  {
    id: 'bronze',
    layer: 'Bronze',
    label: 'Bronze Layer',
    file: 'medallion/bronze_layer.py',
    color: '#cd7f32',
    icon: <LayerIcon color="#cd7f32" />,
    description: 'Raw ingestion layer. Stores data exactly as received — never modifies values. Adds metadata columns for lineage tracking. Append-only design enables full audit history.',
    inputs:  ['Raw DataFrame'],
    outputs: ['data/bronze/supply_chain_bronze.parquet — 180,519 rows × 57 cols'],
    tech: ['Pandas', 'PyArrow', 'Parquet'],
    details: [
      '_ingestion_ts — UTC timestamp of pipeline run',
      '_source_file — origin CSV filename',
      '_row_number — original position in source',
      '_row_hash — SHA-256 fingerprint per row (16-char)',
      '14.5 MB Parquet file — 0 duplicate hashes',
    ],
  },
  {
    id: 'silver',
    layer: 'Silver',
    label: 'Silver Layer',
    file: 'medallion/silver_layer.py',
    color: '#aaa9ad',
    icon: <LayerIcon color="#aaa9ad" />,
    description: 'Cleaned, validated, type-enforced layer. Trusted data that analysts can query directly. Drops PII columns, enforces dtypes, normalises strings, removes outliers.',
    inputs:  ['Bronze Parquet — 180,519 rows'],
    outputs: ['data/silver/supply_chain_silver.parquet — 178,027 rows × 52 cols'],
    tech: ['Pandas', 'PyArrow', 'Parquet'],
    details: [
      'Drops Customer Password, Product Description (PII / 100% null)',
      'Numeric coercion on 15 financial columns',
      'Date parsing: order_date, ship_date → datetime64',
      '0 duplicates (Order Item Id grain)',
      'IQR outlier removal on Sales (1st–99th pct) → 2,492 rows removed',
      '0 nulls remaining in Silver output',
    ],
  },
  {
    id: 'gold',
    layer: 'Gold',
    label: 'Gold Layer',
    file: 'medallion/gold_layer.py',
    color: '#e8a838',
    icon: <LayerIcon color="#e8a838" />,
    description: 'Business-ready aggregates and star schema. Pre-computed KPI tables for dashboard consumption. This is what the FastAPI serves.',
    inputs:  ['Silver Parquet — 178,027 rows'],
    outputs: [
      'gold_monthly_revenue — 37 rows',
      'gold_market_performance — 167 rows',
      'gold_product_performance — 110 rows',
      'gold_customer_segments — 3 rows',
      'gold_late_delivery_risk — 12 rows',
      'gold_shipping_efficiency — 4 rows',
      'Star Schema (fact_sales + 5 dims)',
    ],
    tech: ['Pandas', 'NumPy', 'PyArrow'],
    details: [
      '6 KPI aggregation tables + full star schema',
      'All tables written as Parquet to data/gold/',
      'Derived: delivery_delay_days, is_late, profit_margin_pct, discount_pct',
      'Customer CLV, AOV, order_count computed at this layer',
    ],
  },
  {
    id: 'load',
    layer: null,
    label: 'Load → PostgreSQL',
    file: 'load/postgres_loader.py',
    color: '#4f6ef7',
    icon: <ServerIcon />,
    description: 'Loads all Gold star schema tables into PostgreSQL using SQLAlchemy bulk inserts (5000 row chunks). Creates performance indexes automatically.',
    inputs:  ['Gold star schema CSVs'],
    outputs: ['PostgreSQL sales_db — 6 tables', 'Indexes on fact_sales'],
    tech: ['SQLAlchemy', 'Psycopg2', 'PostgreSQL 16'],
    details: [
      'Table load order respects FK constraints',
      'Chunk size: 5,000 rows per INSERT',
      '5 indexes: customer_id, product_id, date_id, location_id, is_late',
      'Skipped gracefully if DB not configured (--no-db flag)',
    ],
  },
  {
    id: 'api',
    layer: null,
    label: 'FastAPI',
    file: 'api/main.py',
    color: '#4caf8a',
    icon: <ApiIcon />,
    description: 'REST API serving Gold Parquet files as JSON. 11 endpoints with CORS, streaming CSV export, anomaly detection, and benchmark targets.',
    inputs:  ['Gold Parquet files'],
    outputs: ['JSON REST endpoints', 'CSV export streams'],
    tech: ['FastAPI', 'Uvicorn', 'PyArrow'],
    details: [
      'GET /api/kpis — 7 business KPIs',
      'GET /api/revenue/monthly?year=',
      'GET /api/products/top?limit=',
      'GET /api/export/{table} — streaming CSV',
      'GET /api/anomalies — statistical outlier detection',
      'GET /api/benchmarks — industry targets',
      'GET /api/meta — refresh timestamp, classification',
    ],
  },
  {
    id: 'dashboard',
    layer: null,
    label: 'Dashboard',
    file: 'frontend/src/App.jsx',
    color: '#e05c5c',
    icon: <ScreenIcon />,
    description: 'React + Vite dashboard with neumorphism design. Framer Motion page transitions. 5 analytical pages + Workflow + About. Proxies /api/* to FastAPI.',
    inputs:  ['FastAPI /api/* endpoints'],
    outputs: ['Interactive analytics UI'],
    tech: ['React 18', 'Framer Motion', 'Recharts', 'Vite'],
    details: [
      'Neumorphism design system — CSS variables, nm-card / nm-inset shadows',
      'AnimatePresence page transitions',
      'Skeleton loading states',
      'Hover tooltips on KPI cards',
      'CSV export from every page',
      'Responsive sidebar navigation',
    ],
  },
]

const AIRFLOW_TASKS = [
  { id: 'extract',   label: 'Extract' },
  { id: 'validate',  label: 'Validate' },
  { id: 'bronze',    label: 'Bronze' },
  { id: 'silver',    label: 'Silver' },
  { id: 'gold',      label: 'Gold' },
  { id: 'load',      label: 'Load PG' },
  { id: 'notify',    label: 'Notify' },
]

const TECH_STACK = [
  { cat: 'Ingestion',      items: ['Python 3.12', 'Pandas 2.2', 'NumPy'] },
  { cat: 'Storage',        items: ['PostgreSQL 16', 'Parquet (PyArrow)', 'CSV'] },
  { cat: 'API',            items: ['FastAPI', 'Uvicorn', 'SQLAlchemy'] },
  { cat: 'Orchestration',  items: ['Apache Airflow 2.9', 'DAG schedule: 08:00 UTC'] },
  { cat: 'Frontend',       items: ['React 18', 'Vite 5', 'Framer Motion', 'Recharts'] },
  { cat: 'Infrastructure', items: ['Docker', 'Docker Compose', 'Nginx'] },
]

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function Workflow() {
  const [selected, setSelected] = useState('bronze')

  const active = PIPELINE_STAGES.find(s => s.id === selected)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Pipeline flow diagram */}
      <motion.div
        className="nm-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="section-title" style={{ marginBottom: 20 }}>End-to-End Pipeline — click a stage for details</div>

        {/* Scrollable horizontal flow */}
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 'max-content' }}>
            {PIPELINE_STAGES.map((stage, i) => (
              <Fragment key={stage.id}>
                <StageBox
                  stage={stage}
                  active={selected === stage.id}
                  onClick={() => setSelected(stage.id)}
                  index={i}
                />
                {i < PIPELINE_STAGES.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.05 * i + 0.3 }}
                    style={{ display: 'flex', alignItems: 'center', padding: '0 2px', flexShrink: 0 }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--shadow-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="13 6 19 12 13 18"/>
                    </svg>
                  </motion.div>
                )}
              </Fragment>
            ))}
          </div>
        </div>

        {/* Medallion label strip */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Medallion Architecture', color: 'var(--text-muted)', bg: 'transparent' },
            { label: 'Bronze — Raw', color: '#cd7f32', bg: 'rgba(205,127,50,0.12)' },
            { label: 'Silver — Cleaned', color: '#aaa9ad', bg: 'rgba(170,169,173,0.12)' },
            { label: 'Gold — Aggregated', color: '#e8a838', bg: 'rgba(232,168,56,0.12)' },
          ].map(l => (
            <span key={l.label} style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px',
              borderRadius: 6, background: l.bg, color: l.color,
            }}>{l.label}</span>
          ))}
        </div>
      </motion.div>

      {/* Stage detail panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selected}
          className="nm-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{ borderLeft: `4px solid ${active?.color}` }}
        >
          {active && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
              {/* Description */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: `${active.color}18`,
                    color: active.color,
                    boxShadow: 'var(--nm-raised-sm)',
                  }}>
                    {active.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{active.label}</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>{active.file}</div>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{active.description}</p>
                <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {active.tech.map(t => (
                    <span key={t} style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 5,
                      background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 500,
                    }}>{t}</span>
                  ))}
                </div>
              </div>

              {/* Inputs / Outputs */}
              <div>
                <div className="section-title">Inputs</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
                  {active.inputs.map((inp, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '4px 0', display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--text-muted)' }}>→</span> {inp}
                    </li>
                  ))}
                </ul>
                <div className="section-title">Outputs</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {active.outputs.map((out, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '4px 0', display: 'flex', gap: 8 }}>
                      <span style={{ color: active.color }}>←</span> {out}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Implementation details */}
              <div>
                <div className="section-title">Implementation Details</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {active.details.map((d, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0', display: 'flex', gap: 8, lineHeight: 1.5 }}
                    >
                      <span style={{ color: active.color, flexShrink: 0, marginTop: 1 }}>·</span> {d}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Airflow DAG visualisation */}
      <motion.div
        className="nm-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <div className="section-title" style={{ marginBottom: 20 }}>Airflow DAG — daily @ 08:00 UTC</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
          {AIRFLOW_TASKS.map((task, i) => (
            <Fragment key={task.id}>
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.07 }}
                className="nm-card-sm"
                style={{
                  minWidth: 90, textAlign: 'center', padding: '10px 14px',
                  fontSize: 12, fontWeight: 600, color: 'var(--accent)',
                  flexShrink: 0,
                }}
              >
                {task.label}
                <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>PythonOperator</div>
              </motion.div>
              {i < AIRFLOW_TASKS.length - 1 && (
                <div style={{ padding: '0 4px', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--shadow-dark)" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="13 6 19 12 13 18"/>
                  </svg>
                </div>
              )}
            </Fragment>
          ))}
        </div>
        <div className="text-muted" style={{ fontSize: 11, marginTop: 14 }}>
          Retry policy: 2 attempts · 5 min delay · Executor: LocalExecutor · Schedule: <code style={{ background: 'var(--bg-dark)', padding: '1px 5px', borderRadius: 4 }}>0 8 * * *</code>
        </div>
      </motion.div>

      {/* Tech stack grid */}
      <motion.div
        className="nm-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
      >
        <div className="section-title" style={{ marginBottom: 20 }}>Technology Stack</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {TECH_STACK.map((cat, ci) => (
            <motion.div
              key={cat.cat}
              className="nm-card-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ci * 0.06 }}
            >
              <div className="section-title" style={{ marginBottom: 8 }}>{cat.cat}</div>
              {cat.items.map(item => (
                <div key={item} style={{
                  fontSize: 12, color: 'var(--text-secondary)',
                  padding: '3px 0', borderBottom: '1px solid var(--shadow-dark)',
                }}>
                  {item}
                </div>
              ))}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Docker Compose services */}
      <motion.div
        className="nm-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="section-title" style={{ marginBottom: 16 }}>Docker Compose Services</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { name: 'postgres',   port: '5432', desc: 'PostgreSQL 16 — sales_db', color: '#4f6ef7' },
            { name: 'etl',        port: '—',    desc: 'Python ETL — runs pipeline', color: '#cd7f32' },
            { name: 'api',        port: '8000', desc: 'FastAPI — REST endpoints', color: '#4caf8a' },
            { name: 'frontend',   port: '5173', desc: 'React — Nginx proxy', color: '#e05c5c' },
            { name: 'airflow',    port: '8080', desc: 'Airflow webserver + scheduler', color: '#a78cf7' },
          ].map((svc, i) => (
            <motion.div
              key={svc.name}
              className="nm-card-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.07 }}
              style={{ borderTop: `3px solid ${svc.color}` }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{svc.name}</div>
              <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>{svc.desc}</div>
              {svc.port !== '—' && (
                <div style={{ fontSize: 11, color: svc.color, fontWeight: 600 }}>:{svc.port}</div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

    </div>
  )
}

/* ─── Stage box ───────────────────────────────────────────────────────────── */

function StageBox({ stage, active, onClick, index }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '16px 14px', minWidth: 90, border: 'none',
        borderRadius: 'var(--radius-md)', cursor: 'pointer',
        fontFamily: 'inherit',
        background: active ? stage.color + '18' : 'var(--surface)',
        boxShadow: active ? `var(--nm-inset), 0 0 0 2px ${stage.color}40` : 'var(--nm-raised-sm)',
        transition: 'box-shadow 0.2s, background 0.2s',
        flexShrink: 0,
      }}
    >
      {/* Layer badge */}
      {stage.layer && (
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
          padding: '2px 6px', borderRadius: 4,
          background: stage.color + '20', color: stage.color,
          textTransform: 'uppercase',
        }}>{stage.layer}</span>
      )}

      {/* Icon */}
      <div style={{ color: active ? stage.color : 'var(--text-muted)', transition: 'color 0.2s' }}>
        {stage.icon}
      </div>

      {/* Label */}
      <span style={{
        fontSize: 11, fontWeight: active ? 700 : 500,
        color: active ? stage.color : 'var(--text-secondary)',
        textAlign: 'center', lineHeight: 1.3,
        transition: 'color 0.2s',
      }}>
        {stage.label}
      </span>
    </motion.button>
  )
}

/* ─── SVG icons ───────────────────────────────────────────────────────────── */
function DbIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
}
function CheckIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
function LayerIcon({ color }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
}
function ServerIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
}
function ApiIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
}
function ScreenIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
}
