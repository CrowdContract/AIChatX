import { motion } from 'framer-motion'

/**
 * Downloads a Gold layer table as CSV via the FastAPI export endpoint.
 * table: one of monthly_revenue | market_performance | product_performance
 *        | customer_segments | late_delivery_risk | shipping_efficiency
 */
export default function ExportButton({ table, label = 'Export CSV' }) {
  return (
    <motion.a
      href={`/api/export/${table}`}
      download
      className="nm-btn"
      whileTap={{ scale: 0.96 }}
      style={{
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: 'var(--text-secondary)',
      }}
    >
      <DownloadIcon />
      {label}
    </motion.a>
  )
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}
