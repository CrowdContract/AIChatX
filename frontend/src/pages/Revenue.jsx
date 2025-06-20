import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import ChartCard from '../components/ChartCard'
import ExportButton from '../components/ExportButton'
import { useApi, fmt } from '../hooks/useApi'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="nm-card-sm" style={{ minWidth: 160 }}>
      <div className="text-muted" style={{ marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 3 }}>
          <span style={{ color: p.color, fontSize: 12 }}>{p.name}</span>
          <span style={{ fontWeight: 600, fontSize: 12 }}>
            {p.name === 'Growth %' ? fmt.pct(p.value) : fmt.short(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Revenue() {
  const { data: years } = useApi('/revenue/years')
  const { data: benchmarks } = useApi('/benchmarks')
  const [selYear, setSelYear] = useState(null)
  const { data: monthly, loading } = useApi('/revenue/monthly', selYear ? { year: selYear } : {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Year filter + export row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="text-muted" style={{ fontSize: 12 }}>Year</span>
          <button className={`nm-btn${selYear === null ? ' active' : ''}`} onClick={() => setSelYear(null)}>All</button>
          {years?.map(y => (
            <button key={y} className={`nm-btn${selYear === y ? ' active' : ''}`} onClick={() => setSelYear(y)}>{y}</button>
          ))}
        </div>
        <ExportButton table="monthly_revenue" />
      </div>

      {/* Narrative */}
      <motion.div
        className="nm-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}
      >
        <div>
          <div className="section-title">Analysis</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            Revenue peaked in late 2015 and maintained relative stability through 2017. Monthly figures consistently exceeded the $1M target. Profit growth did not always track revenue growth — months with high discount activity show compressed margins.
          </p>
        </div>
        <div>
          <div className="section-title">Recommendations</div>
          <ul style={{ paddingLeft: 16, margin: 0 }}>
            {[
              'Investigate high-discount months for margin recovery opportunities.',
              'Q4 seasonality is evident — plan inventory ahead of Oct–Dec peaks.',
              'Focus on growing orders rather than order size to sustainably lift revenue.',
            ].map((r, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 5 }}>{r}</li>
            ))}
          </ul>
        </div>
      </motion.div>

      {/* Main chart */}
      <ChartCard title="Monthly Revenue, Profit & MoM Growth">
        {loading ? (
          <div style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="text-muted">Loading…</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={monthly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--shadow-dark)" vertical={false} />
              <XAxis
                dataKey="order_month_name"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => fmt.short(v)}
              />
              <YAxis
                yAxisId="right" orientation="right"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => v + '%'}
              />
              <Tooltip content={<CustomTooltip />} />
              {benchmarks && (
                <ReferenceLine
                  yAxisId="left" y={1000000}
                  stroke="var(--warning)" strokeDasharray="4 4" strokeWidth={1}
                  label={{ value: 'Target $1M', position: 'insideTopRight', fontSize: 10, fill: 'var(--warning)' }}
                />
              )}
              <Bar yAxisId="left" dataKey="total_revenue" name="Revenue" radius={[4,4,0,0]} maxBarSize={40}>
                {monthly?.map((entry, i) => (
                  <Cell key={i} fill={entry.mom_revenue_growth_pct >= 0 ? '#4f6ef7' : '#b8c0cc'} />
                ))}
              </Bar>
              <Bar yAxisId="left" dataKey="total_profit" name="Profit" fill="#4caf8a" radius={[4,4,0,0]} maxBarSize={40} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="mom_revenue_growth_pct"
                name="Growth %"
                stroke="#e8a838"
                strokeWidth={2}
                dot={{ fill: '#e8a838', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Table */}
      {monthly && (
        <ChartCard title="Period Breakdown">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
              <thead>
                <tr>
                  {['Period', 'Revenue', 'Profit', 'Orders', 'AOV', 'MoM Growth'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '4px 12px',
                      fontSize: 11, fontWeight: 600,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthly.map((row, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.025 }}
                    style={{ background: 'var(--surface)' }}
                  >
                    {[
                      `${row.order_month_name} ${row.order_year}`,
                      fmt.currency(row.total_revenue),
                      fmt.currency(row.total_profit),
                      fmt.number(row.total_orders),
                      fmt.currency(row.avg_order_value),
                    ].map((val, ci) => (
                      <td key={ci} style={{
                        padding: '10px 12px',
                        fontSize: 13,
                        borderBottom: '1px solid var(--shadow-dark)',
                        color: 'var(--text-primary)',
                      }}>{val}</td>
                    ))}
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--shadow-dark)' }}>
                      {row.mom_revenue_growth_pct != null ? (
                        <span className={`badge ${row.mom_revenue_growth_pct >= 0 ? 'badge-up' : 'badge-down'}`}>
                          {row.mom_revenue_growth_pct >= 0 ? '+' : ''}{Number(row.mom_revenue_growth_pct).toFixed(1)}%
                        </span>
                      ) : <span className="text-muted">—</span>}
                    </td>
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
