import { motion } from 'framer-motion'
import ExportButton from './ExportButton'

/**
 * Consistent page header with title, subtitle, export button, and metadata strip.
 */
export default function PageHeader({ title, subtitle, exportTable, meta }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ marginBottom: 28 }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>{subtitle}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <ClassificationBadge />
          {exportTable && <ExportButton table={exportTable} />}
        </div>
      </div>

      {/* Metadata strip */}
      {meta && (
        <div style={{
          display: 'flex', gap: 20, marginTop: 10, flexWrap: 'wrap',
          borderTop: '1px solid var(--shadow-dark)', paddingTop: 10,
        }}>
          <MetaItem label="Source"    value={meta.source} />
          <MetaItem label="Refreshed" value={meta.last_refresh} />
          <MetaItem label="Records"   value={meta.record_count?.toLocaleString()} />
          <MetaItem label="Period"    value={meta.date_range} />
          <MetaItem label="Pipeline"  value={meta.pipeline} />
        </div>
      )}
    </motion.div>
  )
}

function MetaItem({ label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}:</span>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>{value}</span>
    </div>
  )
}

function ClassificationBadge() {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
      padding: '4px 10px', borderRadius: 6,
      background: 'rgba(232,168,56,0.15)', color: 'var(--warning)',
      whiteSpace: 'nowrap',
    }}>
      INTERNAL ONLY
    </div>
  )
}
