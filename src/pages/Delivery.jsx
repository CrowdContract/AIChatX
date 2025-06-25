import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import ChartCard from '../components/ChartCard'
import ExportButton from '../components/ExportButton'
import { useApi, fmt } from '../hooks/useApi'

const STATUS_COLORS = {
  'Late Delivery':     '#e05c5c',
  'Advance Shipping':  '#4caf8a',
  'Shipping On Time':  '#4f6ef7',
  'Shipping Canceled': '#b8c0cc',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="nm-card-sm" style={{ minWidth: 150 }}>
      <div className="text-muted" style={{ marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 3 }}>
          <span style={{ color: p.color, fontSize: 12 }}>{p.name}</span>
          <span style={{ fontWeight: 600, fontSize: 12 }}>
            {p.name.includes('%') || p.name === 'Late %' ? fmt.pct(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function RiskBar({ label, late_pct, total, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      style={{ marginBottom: 16 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="text-muted">{fmt.number(total)} shipments</span>
          <span className={`badge ${late_pct > 50 ? 'badge-down' : late_pct > 30 ? 'badge-warn' : 'badge-up'}`}>
            {fmt.pct(late_pct)} late
          </span>
        </div>
      </div>
      {/* neumorphic progress bar */}
      <div className="nm-inset" style={{ height: 10, padding: 0, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(late_pct, 100)}%` }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: '100%', background: color, borderRadius: 'inherit' }}
        />
      </div>
    </motion.div>
  )
}

export default function Delivery() {
  const { data: risk }       = useApi('/delivery/risk')
  const { data: efficiency } = useApi('/delivery/shipping-efficiency')
  const { data: benchmarks } = useApi('/benchmarks')

  // Group risk by shipping mode
  const byMode = risk?.reduce((acc, r) => {
    if (!acc[r.shipping_mode]) acc[r.shipping_mode] = { total: 0, late: 0 }
    acc[r.shipping_mode].total += r.total_shipments
    acc[r.shipping_mode].late  += r.late_shipments
    return acc
  }, {})

  const modeColors = { 'Standard Class': '#4f6ef7', 'First Class': '#4caf8a', 'Second Class': '#e8a838', 'Same Day': '#e05c5c' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Narrative + export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <motion.div
          className="nm-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ flex: 1, minWidth: 280, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}
        >
          <div>
            <div className="section-title">Analysis</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              At 57% overall, late delivery rate significantly exceeds the {benchmarks?.target_late_pct ?? 30}% industry benchmark.
              Standard Class is the worst performing mode. Same Day, despite its premium SLA, also shows unexpectedly high delays.
            </p>
          </div>
          <div>
            <div className="section-title">Recommendations</div>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              {[
                'Renegotiate Standard Class SLAs — accounts for majority of late shipments.',
                'Audit Same Day carrier contracts — delay rate is disproportionate to cost.',
                'Set internal SLA alerts at 35% late rate to trigger intervention before breaching 30% target.',
              ].map((r, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 5 }}>{r}</li>
              ))}
            </ul>
          </div>
        </motion.div>
        <ExportButton table="late_delivery_risk" />
      </div>

      {/* Late delivery risk bars */}
      <ChartCard title={`Late Delivery Rate by Shipping Mode — Target: <${benchmarks?.target_late_pct ?? 30}%`}>
        <div style={{ padding: '4px 0' }}>
          {byMode && Object.entries(byMode).map(([mode, d]) => (
            <RiskBar
              key={mode}
              label={mode}
              late_pct={d.late / d.total * 100}
              total={d.total}
              color={modeColors[mode] || '#4f6ef7'}
            />
          ))}
        </div>
      </ChartCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Efficiency chart */}
        <ChartCard title="Actual vs Scheduled Delivery Days">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={efficiency} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--shadow-dark)" vertical={false} />
              <XAxis dataKey="shipping_mode" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => v.split(' ')[0]} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit=" d" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avg_scheduled_days" name="Scheduled" fill="#b8c0cc" radius={[4,4,0,0]} maxBarSize={36} />
              <Bar dataKey="avg_actual_days"     name="Actual"    fill="#e05c5c" radius={[4,4,0,0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Delivery status breakdown */}
        <ChartCard title="Delivery Status Breakdown">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {risk && (() => {
              const totals = {}
              risk.forEach(r => {
                if (!totals[r.delivery_status]) totals[r.delivery_status] = 0
                totals[r.delivery_status] += r.total_shipments
              })
              const grand = Object.values(totals).reduce((a, b) => a + b, 0)
              return Object.entries(totals)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => {
                  const pct = count / grand * 100
                  const color = STATUS_COLORS[status] || '#b8c0cc'
                  return (
                    <div key={status}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 13 }}>{status}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color }}>{fmt.pct(pct)}</span>
                      </div>
                      <div className="nm-inset" style={{ height: 8, padding: 0, overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                          style={{ height: '100%', background: color, borderRadius: 'inherit' }}
                        />
                      </div>
                    </div>
                  )
                })
            })()}
          </div>
        </ChartCard>
      </div>

      {/* Efficiency table */}
      {efficiency && (
        <ChartCard title="Shipping Efficiency Summary">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
              <thead>
                <tr>
                  {['Shipping Mode', 'Scheduled (days)', 'Actual (days)', 'Avg Delay', 'Late %', 'Shipments', 'Avg Revenue'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '4px 12px',
                      fontSize: 11, fontWeight: 600,
                      color: 'var(--text-muted)', letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {efficiency.map((row, i) => (
                  <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13, borderBottom: '1px solid var(--shadow-dark)' }}>{row.shipping_mode}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)' }}>{Number(row.avg_scheduled_days).toFixed(1)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)' }}>{Number(row.avg_actual_days).toFixed(1)}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--shadow-dark)' }}>
                      <span className={`badge ${row.avg_delay > 0 ? 'badge-down' : 'badge-up'}`}>
                        {row.avg_delay > 0 ? '+' : ''}{Number(row.avg_delay).toFixed(1)} d
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--shadow-dark)' }}>
                      <span className={`badge ${row.late_pct > 50 ? 'badge-down' : row.late_pct > 30 ? 'badge-warn' : 'badge-up'}`}>
                        {fmt.pct(row.late_pct)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)' }}>{fmt.number(row.shipment_count)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)' }}>{fmt.currency(row.avg_revenue)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  )
}
