import { motion } from 'framer-motion'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import ChartCard from '../components/ChartCard'
import ExportButton from '../components/ExportButton'
import { useApi, fmt } from '../hooks/useApi'

const COLORS = ['#4f6ef7', '#4caf8a', '#e8a838']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="nm-card-sm">
      <div className="text-muted" style={{ marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 3 }}>
          <span style={{ color: p.color, fontSize: 12 }}>{p.name}</span>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{fmt.short(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Customers() {
  const { data: segments } = useApi('/customers/segments')
  const { data: topCust }  = useApi('/customers/top', { limit: 10 })
  const { data: benchmarks } = useApi('/benchmarks')

  // Build radar data from segments
  const radarData = segments?.map(s => ({
    subject: s.customer_segment,
    CLV:     Math.round(s.avg_clv),
    AOV:     Math.round(s.avg_aov),
    Repeat:  s.repeat_rate_pct,
  }))

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
              Consumer segment dominates revenue. The repeat customer rate is healthy across all segments, but Corporate and Home Office segments show lower average CLV — indicating growth headroom through upsell and retention programs.
            </p>
          </div>
          <div>
            <div className="section-title">Recommendations</div>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              {[
                `Repeat rate target is ${benchmarks?.target_repeat_rate ?? 60}% — all segments are currently meeting this.`,
                'Corporate CLV lags Consumer — introduce volume pricing or loyalty tiers.',
                'Top 10 customers represent a concentration risk — diversify account base.',
              ].map((r, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 5 }}>{r}</li>
              ))}
            </ul>
          </div>
        </motion.div>
        <ExportButton table="customer_segments" style={{ flexShrink: 0 }} />
      </div>

      {/* Segment cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {segments?.map((seg, i) => (
          <motion.div
            key={seg.customer_segment}
            className="nm-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <span className="section-title" style={{ marginBottom: 0 }}>{seg.customer_segment}</span>
              <span className="badge badge-up">{fmt.pct(seg.repeat_rate_pct)} repeat</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="text-muted" style={{ marginBottom: 4 }}>Total Revenue</div>
                <div className="value-medium">{fmt.short(seg.total_revenue)}</div>
              </div>
              <div>
                <div className="text-muted" style={{ marginBottom: 4 }}>Customers</div>
                <div className="value-medium">{fmt.number(seg.total_customers)}</div>
              </div>
              <div>
                <div className="text-muted" style={{ marginBottom: 4 }}>Avg CLV</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{fmt.currency(seg.avg_clv)}</div>
              </div>
              <div>
                <div className="text-muted" style={{ marginBottom: 4 }}>Avg AOV</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{fmt.currency(seg.avg_aov)}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* CLV comparison bar chart */}
        <ChartCard title="Revenue by Segment">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={segments} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--shadow-dark)" vertical={false} />
              <XAxis dataKey="customer_segment" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => fmt.short(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total_revenue" name="Revenue" radius={[6,6,0,0]} maxBarSize={60}>
                {segments?.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Radar chart */}
        <ChartCard title="Segment Profile — CLV vs AOV vs Repeat Rate">
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="var(--shadow-dark)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <Radar name="CLV"    dataKey="CLV"    stroke="#4f6ef7" fill="#4f6ef7" fillOpacity={0.15} strokeWidth={2} />
              <Radar name="AOV"    dataKey="AOV"    stroke="#4caf8a" fill="#4caf8a" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top customers table */}
      {topCust && (
        <ChartCard title="Top Customers by Lifetime Value">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
              <thead>
                <tr>
                  {['#', 'Customer', 'Segment', 'Country', 'CLV', 'AOV', 'Orders', 'Repeat'].map(h => (
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
                {topCust.map((row, i) => (
                  <motion.tr
                    key={row.customer_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {String(i + 1).padStart(2, '0')}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)', fontWeight: 500 }}>
                      {row.customer_fname} {row.customer_lname}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--shadow-dark)' }}>
                      <span className="badge badge-warn">{row.customer_segment}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)', color: 'var(--text-secondary)' }}>{row.customer_country}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)', fontWeight: 700, color: 'var(--accent)' }}>{fmt.currency(row.customer_lifetime_value)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)' }}>{fmt.currency(row.avg_order_value)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--shadow-dark)' }}>{row.order_count}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--shadow-dark)' }}>
                      {row.is_repeat_customer
                        ? <span className="badge badge-up">Yes</span>
                        : <span className="badge badge-down">No</span>
                      }
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
