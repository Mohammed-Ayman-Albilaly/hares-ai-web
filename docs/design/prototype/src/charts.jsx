// Charts — small, hand-coded SVG charts so we don't pull a chart lib

const Donut = ({ data, size = 180, stroke = 26 }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
        <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={stroke} className="track" />
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const dash = `${len} ${c - len}`;
          const offset = c * 0.25 - acc;
          acc += len;
          return <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={d.color} strokeWidth={stroke} strokeDasharray={dash} strokeDashoffset={offset}
            strokeLinecap="butt" />;
        })}
        <text x={size/2} y={size/2 - 6} textAnchor="middle" fill="var(--ink)" fontSize="22" fontFamily="'Instrument Serif', serif">{total}</text>
        <text x={size/2} y={size/2 + 14} textAnchor="middle" fill="var(--ink-4)" fontSize="11" letterSpacing=".06em">PROMPTS</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((d, i) => (
          <div key={i} className="legend-row">
            <span className="legend-dot" style={{ background: d.color }} />
            <span style={{ flex: 1 }}>{d.label}</span>
            <span style={{ color: "var(--ink-4)", fontVariantNumeric: "tabular-nums" }}>{d.value} ({Math.round(d.value/total*100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const LineChart = ({ series, width = 720, height = 180, max }) => {
  const points = series[0].data.length;
  const padX = 22, padTop = 16, padBot = 24;
  const yMax = max || Math.max(...series.flatMap(s => s.data)) * 1.2 || 10;
  const xStep = (width - padX * 2) / (points - 1);
  const yScale = (v) => padTop + (1 - v / yMax) * (height - padTop - padBot);

  const buildPath = (data) =>
    data.map((v, i) => `${i === 0 ? "M" : "L"} ${padX + i * xStep} ${yScale(v)}`).join(" ");
  const buildArea = (data) => {
    const top = data.map((v, i) => `${i === 0 ? "M" : "L"} ${padX + i * xStep} ${yScale(v)}`).join(" ");
    return `${top} L ${padX + (data.length - 1) * xStep} ${height - padBot} L ${padX} ${height - padBot} Z`;
  };

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <line key={i} x1={padX} y1={padTop + t * (height - padTop - padBot)} x2={width - padX} y2={padTop + t * (height - padTop - padBot)}
          stroke="var(--line)" strokeDasharray="3 4" />
      ))}
      {series.map((s, i) => (
        <g key={i}>
          {s.fill && <path d={buildArea(s.data)} fill={s.color} opacity="0.10" />}
          <path d={buildPath(s.data)} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {s.data.map((v, j) => (
            <circle key={j} cx={padX + j * xStep} cy={yScale(v)} r="2.6" fill={s.color} />
          ))}
        </g>
      ))}
      {(series[0].labels || []).map((lab, i) => (
        <text key={i} x={padX + i * xStep} y={height - 6} textAnchor="middle" fontSize="10.5" fill="var(--ink-4)" letterSpacing=".04em">{lab}</text>
      ))}
    </svg>
  );
};

const BarChart = ({ data, width = 380, height = 180, vertical = true }) => {
  const max = Math.max(...data.map(d => d.value)) * 1.15 || 10;
  const padX = 16, padTop = 10, padBot = 28;
  if (!vertical) {
    // horizontal bars
    const rowH = (height - padTop) / data.length;
    return (
      <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
        {data.map((d, i) => {
          const y = padTop + i * rowH + 4;
          const w = (d.value / max) * (width - padX - 110);
          return (
            <g key={i}>
              <text x={padX} y={y + rowH / 2} dominantBaseline="middle" fontSize="11.5" fill="var(--ink-2)">{d.label}</text>
              <rect x={padX + 100} y={y + 2} height={rowH - 12} width={w} fill={d.color || "var(--accent)"} rx="3" />
              <text x={padX + 104 + w} y={y + rowH / 2} dominantBaseline="middle" fontSize="11" fill="var(--ink-4)" fontVariantNumeric="tabular-nums">{d.value}</text>
            </g>
          );
        })}
      </svg>
    );
  }
  const colW = (width - padX * 2) / data.length;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      {[0, 0.5, 1].map((t, i) => (
        <line key={i} x1={padX} y1={padTop + t * (height - padTop - padBot)} x2={width - padX} y2={padTop + t * (height - padTop - padBot)}
          stroke="var(--line)" strokeDasharray="3 4" />
      ))}
      {data.map((d, i) => {
        const h = (d.value / max) * (height - padTop - padBot);
        const x = padX + i * colW + colW * 0.18;
        const y = height - padBot - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={colW * 0.64} height={h} fill={d.color || "var(--accent)"} rx="3" />
            <text x={x + colW * 0.32} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--ink-4)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

const StackedBar = ({ data, width = 720, height = 220 }) => {
  const padX = 24, padTop = 14, padBot = 28;
  const max = Math.max(...data.map(d => d.values.reduce((a,b) => a + b, 0))) * 1.1 || 10;
  const colW = (width - padX * 2) / data.length;
  const colors = ["#DC2626", "#D97706", "#2563EB", "#16A34A"];
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      {[0, 0.5, 1].map((t, i) => (
        <line key={i} x1={padX} y1={padTop + t * (height - padTop - padBot)} x2={width - padX} y2={padTop + t * (height - padTop - padBot)}
          stroke="var(--line)" strokeDasharray="3 4" />
      ))}
      {data.map((d, i) => {
        const x = padX + i * colW + colW * 0.16;
        const w = colW * 0.68;
        let yCursor = height - padBot;
        return (
          <g key={i}>
            {d.values.map((v, j) => {
              const h = (v / max) * (height - padTop - padBot);
              yCursor -= h;
              return <rect key={j} x={x} y={yCursor} width={w} height={h} fill={colors[j]} rx={j === 0 ? 3 : 0} />;
            })}
            <text x={x + w/2} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--ink-4)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

Object.assign(window, { Donut, LineChart, BarChart, StackedBar });
