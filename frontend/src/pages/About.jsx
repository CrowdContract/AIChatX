import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../hooks/useApi'

const DATA_DICTIONARY = [
  { term: 'Total Revenue',       definition: 'Sum of the Sales column across all order items. Represents gross sales value before deducting costs.', source: 'fact_sales.sales' },
  { term: 'Total Profit',        definition: 'Sum of Order Profit Per Order. Can be negative when discounts exceed the cost margin.', source: 'fact_sales.order_profit_per_order' },
  { term: 'Profit Margin %',     definition: 'Total Profit ÷ Total Revenue × 100. Expressed as a percentage of gross revenue.', source: 'Derived' },
  { term: 'Avg Order Value',     definition: 'Total Revenue ÷ count of unique Order IDs. Measures the typical transaction size.', source: 'Derived' },
  { term: 'Late Delivery %',     definition: 'Shipments where actual shipping days > scheduled days, divided by total shipments × 100.', source: 'fact_sales.is_late' },
  { term: 'CLV',                 definition: 'Customer Lifetime Value — total sales attributed to a single customer across all orders.', source: 'dim_customer.customer_lifetime_value' },
  { term: 'AOV',                 definition: 'Average Order Value per customer — mean sales per order for that customer.', source: 'dim_customer.avg_order_value' },
  { term: 'Repeat Customer',     definition: 'A customer who placed more than one unique order (order_count > 1).', source: 'dim_customer.is_repeat_customer' },
  { term: 'Delivery Delay Days', definition: 'Days for shipping (real) minus Days for shipment (scheduled). Positive = late.', source: 'fact_sales.delivery_delay_days' },
  { term: 'MoM Growth %',        definition: 'Month-over-month revenue change: (current − previous) ÷ previous × 100.', source: 'gold_monthly_revenue.mom_revenue_growth_pct' },
  { term: 'Market',              definition: 'Geographic region group: USCA, Europe, LATAM, Pacific Asia, Africa.', source: 'dim_location.market' },
  { term: 'Bronze Layer',        definition: 'Raw data layer — exact copy of source with metadata columns. Never modified.', source: 'data/bronze/' },
  { term: 'Silver Layer',        definition: 'Cleaned, typed, deduplicated data. Zero nulls, standardised strings, outliers removed.', source: 'data/silver/' },
  { term: 'Gold Layer',          definition: 'Business-ready aggregates and star schema. Powers this dashboard directly.', source: 'data/gold/' },
]

const FAQ = [
  {
    q: 'How do I update the data?',
    a: 'Re-run python run_pipeline.py --no-db from the project root. The pipeline re-processes the raw CSV through all Medallion layers and refreshes the Gold Parquet files. The API picks up changes on the next request (cached per session).',
  },
  {
    q: 'Why is the late delivery rate so high (57%)?',
    a: 'This is a known characteristic of the DataCo dataset — it reflects a mix of real supply chain delays and the dataset\'s specific order composition. The 30% benchmark shown is an industry reference target, not a historical baseline for this specific data.',
  },
  {
    q: 'What does "Internal Only" classification mean?',
    a: 'This is a data classification label indicating the dashboard should not be shared externally. It is a demonstration label for portfolio purposes — in a production system this would be enforced by IAM policies and row-level security.',
  },
  {
    q: 'How do I connect to a live PostgreSQL database?',
    a: 'Copy .env.example to .env and fill in POSTGRES_HOST, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD. Then run python run_pipeline.py (without --no-db) to load all Gold tables into the database.',
  },
  {
    q: 'How does the anomaly detection work?',
    a: 'The /api/anomalies endpoint identifies months where the MoM revenue growth is more than 1.8 standard deviations from the mean across all months. This is a simple z-score based approach, not a learned model.',
  },
  {
    q: 'Can I filter charts by date range?',
    a: 'Year-level filtering is available on the Revenue and Overview pages via the year selector. Month-level range filtering can be added by extending the /api/revenue/monthly endpoint with start_date and end_date query parameters.',
  },
]

export default function About() {
  const { data: meta } = useApi('/meta')
  const { data: benchmarks } = useApi('/benchmarks')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Project overview */}
      <motion.div
        className="nm-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}
      >
        <div>
          <div className="section-title">Project Overview</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.3px' }}>
            Supply Chain Performance Analytics
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
            An end-to-end data engineering project built on the DataCo Global Supply Chain dataset.
            The pipeline processes 180k order records through a Medallion architecture (Bronze → Silver → Gold),
            loads the results into PostgreSQL, orchestrates daily runs via Apache Airflow,
            and exposes the analytics through a FastAPI backend and this React dashboard.
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            The primary business question is: <em>where are supply chain inefficiencies costing the most — in delivery delays, margin erosion, or customer churn?</em>
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="section-title">System Metadata</div>
          {meta && Object.entries({
            'Data Source':    meta.source,
            'Last Refreshed': meta.last_refresh,
            'Records':        meta.record_count?.toLocaleString(),
            'Date Range':     meta.date_range,
            'Architecture':   meta.architecture,
            'Pipeline':       meta.pipeline,
            'Owner':          meta.owner,
            'Contact':        meta.contact,
          }).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, borderBottom: '1px solid var(--shadow-dark)', paddingBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)', width: 110, flexShrink: 0 }}>{k}</span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500, wordBreak: 'break-word' }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              padding: '4px 10px', borderRadius: 6,
              background: 'rgba(232,168,56,0.15)', color: 'var(--warning)',
            }}>INTERNAL ONLY</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              padding: '4px 10px', borderRadius: 6,
              background: 'rgba(79,110,247,0.12)', color: 'var(--accent)',
            }}>PORTFOLIO PROJECT</span>
          </div>
        </div>
      </motion.div>

      {/* Benchmarks reference */}
      <motion.div
        className="nm-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08 }}
      >
        <div className="section-title" style={{ marginBottom: 16 }}>Target Benchmarks</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          These are industry-reference thresholds used to evaluate pipeline and business performance. They appear as reference lines on charts and inform KPI status indicators.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {benchmarks && [
            { label: 'Late Delivery Rate',  value: `< ${benchmarks.target_late_pct}%`,          note: 'Industry SLA for supply chain' },
            { label: 'Profit Margin',        value: `≥ ${benchmarks.target_profit_margin}%`,      note: 'Target operating margin' },
            { label: 'Avg Order Value',      value: `≥ $${benchmarks.target_aov}`,               note: 'Minimum viable AOV' },
            { label: 'Repeat Customer Rate', value: `≥ ${benchmarks.target_repeat_rate}%`,        note: 'Retention health indicator' },
          ].map(b => (
            <div key={b.label} className="nm-card-sm">
              <div className="section-title" style={{ marginBottom: 4 }}>{b.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{b.value}</div>
              <div className="text-muted" style={{ fontSize: 11 }}>{b.note}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Data dictionary */}
      <motion.div
        className="nm-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12 }}
      >
        <div className="section-title" style={{ marginBottom: 4 }}>Data Dictionary</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Definitions for every metric shown in this dashboard.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
            <thead>
              <tr>
                {['Metric', 'Definition', 'Source Column'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '4px 14px',
                    fontSize: 10, fontWeight: 700,
                    color: 'var(--text-muted)', letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DATA_DICTIONARY.map((row, i) => (
                <motion.tr
                  key={row.term}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--shadow-dark)', whiteSpace: 'nowrap' }}>
                    {row.term}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', borderBottom: '1px solid var(--shadow-dark)', lineHeight: 1.5 }}>
                    {row.definition}
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--shadow-dark)', whiteSpace: 'nowrap' }}>
                    <code style={{ fontSize: 11, background: 'var(--bg-dark)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent)' }}>
                      {row.source}
                    </code>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* FAQ */}
      <motion.div
        className="nm-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.18 }}
      >
        <div className="section-title" style={{ marginBottom: 4 }}>How to Use This Dashboard</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          Common questions and usage guidance.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {FAQ.map((item, i) => <FaqItem key={i} item={item} index={i} />)}
        </div>
      </motion.div>

      {/* Contact */}
      <motion.div
        className="nm-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.22 }}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}
      >
        <div>
          <div className="section-title">Feedback & Support</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            For data questions, access requests, or to report an issue with this dashboard.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href={`mailto:${meta?.contact ?? 'data-team@company.com'}`}
            className="nm-btn"
            style={{ textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <MailIcon />
            {meta?.contact ?? 'data-team@company.com'}
          </a>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="nm-btn"
            style={{ textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ApiDocsIcon />
            API Docs
          </a>
        </div>
      </motion.div>

    </div>
  )
}

/* ─── FAQ accordion item ───────────────────────────────────────────────────── */
function FaqItem({ item, index }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.04 }}
      style={{ borderBottom: '1px solid var(--shadow-dark)' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', padding: '12px 4px',
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left', gap: 16,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.q}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ flexShrink: 0, color: 'var(--text-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </motion.span>
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{ padding: '0 4px 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}
        >
          {item.a}
        </motion.div>
      )}
    </motion.div>
  )
}

function MailIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
}
function ApiDocsIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
}
