"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Small, dependency-free SVG charts. Every chart ships a hover/focus tooltip and a
 * table twin so no value is reachable through color or pointer alone.
 */

export type ChartPoint = { label: string; value: number | null; detail?: string };
type Series = "blue" | "accent" | "ink";

const seriesColor: Record<Series, string> = { blue: "var(--blue)", accent: "var(--accent)", ink: "var(--ink)" };

function useMeasuredWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function niceCeiling(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function labelIndexes(count: number, maxLabels = 8) {
  if (count <= maxLabels) return new Set(Array.from({ length: count }, (_, index) => index));
  const step = Math.ceil((count - 1) / (maxLabels - 1));
  const indexes = new Set<number>([0, count - 1]);
  for (let index = 0; index < count; index += step) {
    // Keep the final label clear of its nearest scheduled neighbour.
    if (count - 1 - index < step / 2) continue;
    indexes.add(index);
  }
  return indexes;
}

function ChartFrame({ title, subtitle, legend, table, tableLabel, children }: { title: string; subtitle?: string; legend?: ReactNode; table: ReactNode; tableLabel: string; children: ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  return <figure className="chart">
    <figcaption className="chart-head">
      <div><p className="chart-title">{title}</p>{subtitle && <p className="chart-subtitle">{subtitle}</p>}</div>
      <button type="button" className="chart-table-toggle" aria-expanded={showTable} aria-controls={tableId} onClick={() => setShowTable((current) => !current)}>{showTable ? "Hide table" : "Table"}</button>
    </figcaption>
    {legend}
    {children}
    <div id={tableId} className="chart-table-wrap" hidden={!showTable}>
      <table className="data-table" aria-label={tableLabel}>{table}</table>
    </div>
  </figure>;
}

type Tooltip = { index: number; x: number; y: number };

function TooltipBox({ tooltip, rows, heading }: { tooltip: Tooltip | null; rows: { key: string; label: string; value: string; color?: string }[]; heading: string }) {
  if (!tooltip) return null;
  return <div className="chart-tooltip" role="status" style={{ left: tooltip.x, top: tooltip.y }}>
    <p>{heading}</p>
    {rows.map((row) => <div key={row.key}><span>{row.color && <i style={{ background: row.color }} />}{row.label}</span><strong>{row.value}</strong></div>)}
  </div>;
}

export function ColumnChart({ title, subtitle, points, format, series = "blue", height = 190, unit, emptyMessage = "No activity in this period." }: {
  title: string; subtitle?: string; points: ChartPoint[]; format: (value: number) => string; series?: Series; height?: number; unit: string; emptyMessage?: string;
}) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const values = points.map((point) => point.value ?? 0);
  const max = niceCeiling(Math.max(...values, 0));
  const hasData = values.some((value) => value > 0);
  const pad = { top: 14, right: 8, bottom: 24, left: 36 };
  const plotWidth = Math.max(width - pad.left - pad.right, 10);
  const plotHeight = height - pad.top - pad.bottom;
  const slot = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.max(Math.min(24, slot * 0.6), 2);
  const labels = labelIndexes(points.length, Math.max(3, Math.floor(plotWidth / 68)));
  const ticks = [0, 0.5, 1].map((fraction) => max * fraction);
  const y = (value: number) => pad.top + plotHeight - (value / max) * plotHeight;
  const peakIndex = values.indexOf(Math.max(...values));
  const color = seriesColor[series];

  const table = <>
    <thead><tr><th>Period</th><th>{unit}</th></tr></thead>
    <tbody>{points.map((point) => <tr key={point.label}><td>{point.label}</td><td>{point.value === null ? "—" : format(point.value)}</td></tr>)}</tbody>
  </>;

  return <ChartFrame title={title} subtitle={subtitle} table={table} tableLabel={`${title} by period`}>
    <div ref={ref} style={{ position: "relative" }}>
      {!hasData ? <div className="chart-empty compact">{emptyMessage}</div> : <>
        <svg className="chart-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}: ${points.length} periods, peak ${format(values[peakIndex] ?? 0)} on ${points[peakIndex]?.label ?? ""}`}>
          {ticks.map((tick) => <g key={tick}>
            <line className="grid-line" x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
            <text className="tick" x={pad.left - 6} y={y(tick) + 3} textAnchor="end">{format(tick)}</text>
          </g>)}
          <line className="axis-line" x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} />
          {points.map((point, index) => {
            const value = point.value ?? 0;
            const centerX = pad.left + slot * index + slot / 2;
            const barX = centerX - barWidth / 2;
            const top = y(value);
            const barHeight = Math.max(y(0) - top, 0);
            const radius = Math.min(4, barHeight, barWidth / 2);
            const path = barHeight <= 0 ? "" : `M${barX},${y(0)} V${top + radius} Q${barX},${top} ${barX + radius},${top} H${barX + barWidth - radius} Q${barX + barWidth},${top} ${barX + barWidth},${top + radius} V${y(0)} Z`;
            return <g key={point.label}>
              <rect className="hit" x={pad.left + slot * index} y={pad.top} width={slot} height={plotHeight} tabIndex={0}
                aria-label={`${point.label}: ${format(value)}`}
                onMouseEnter={() => setTooltip({ index, x: centerX, y: top })} onFocus={() => setTooltip({ index, x: centerX, y: top })}
                onMouseLeave={() => setTooltip(null)} onBlur={() => setTooltip(null)} />
              {path && <path className="mark" d={path} fill={color} />}
              {index === peakIndex && value > 0 && <text className="direct-label" x={centerX} y={top - 5} textAnchor="middle">{format(value)}</text>}
              {labels.has(index) && <text className="tick" x={centerX} y={height - 6} textAnchor="middle">{point.label}</text>}
            </g>;
          })}
        </svg>
        <TooltipBox tooltip={tooltip} heading={tooltip ? points[tooltip.index].label : ""} rows={tooltip ? [{ key: "value", label: unit, value: format(points[tooltip.index].value ?? 0), color }, ...(points[tooltip.index].detail ? [{ key: "detail", label: points[tooltip.index].detail as string, value: "" }] : [])] : []} />
      </>}
    </div>
  </ChartFrame>;
}

export function LineChart({ title, subtitle, points, format, series = "accent", height = 190, unit, domainMax = 100, emptyMessage = "Rates appear once answers are submitted." }: {
  title: string; subtitle?: string; points: ChartPoint[]; format: (value: number) => string; series?: Series; height?: number; unit: string; domainMax?: number; emptyMessage?: string;
}) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const pad = { top: 14, right: 12, bottom: 24, left: 36 };
  const plotWidth = Math.max(width - pad.left - pad.right, 10);
  const plotHeight = height - pad.top - pad.bottom;
  const slot = plotWidth / Math.max(points.length, 1);
  const x = (index: number) => pad.left + slot * index + slot / 2;
  const y = (value: number) => pad.top + plotHeight - (value / domainMax) * plotHeight;
  const labels = labelIndexes(points.length, Math.max(3, Math.floor(plotWidth / 68)));
  const color = seriesColor[series];
  const known = points.map((point, index) => ({ ...point, index })).filter((point) => point.value !== null);
  const hasData = known.length > 0;
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((point, index) => {
    if (point.value === null) { if (current.length) segments.push(current.join(" ")); current = []; return; }
    current.push(`${current.length ? "L" : "M"}${x(index)},${y(point.value)}`);
  });
  if (current.length) segments.push(current.join(" "));
  const last = known.at(-1);

  const table = <>
    <thead><tr><th>Period</th><th>{unit}</th></tr></thead>
    <tbody>{points.map((point) => <tr key={point.label}><td>{point.label}</td><td>{point.value === null ? "—" : format(point.value)}</td></tr>)}</tbody>
  </>;

  return <ChartFrame title={title} subtitle={subtitle} table={table} tableLabel={`${title} by period`}>
    <div ref={ref} style={{ position: "relative" }}>
      {!hasData ? <div className="chart-empty compact">{emptyMessage}</div> : <>
        <svg className="chart-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}: latest ${last ? format(last.value as number) : "—"} on ${last?.label ?? ""}`}>
          {[0, 0.5, 1].map((fraction) => <g key={fraction}>
            <line className="grid-line" x1={pad.left} x2={width - pad.right} y1={y(domainMax * fraction)} y2={y(domainMax * fraction)} />
            <text className="tick" x={pad.left - 6} y={y(domainMax * fraction) + 3} textAnchor="end">{format(domainMax * fraction)}</text>
          </g>)}
          <line className="axis-line" x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} />
          {tooltip && <line className="crosshair" x1={tooltip.x} x2={tooltip.x} y1={pad.top} y2={y(0)} />}
          {segments.map((segment) => <path key={segment} className="line" d={segment} stroke={color} />)}
          {points.map((point, index) => <g key={point.label}>
            <rect className="hit" x={pad.left + slot * index} y={pad.top} width={slot} height={plotHeight} tabIndex={0}
              aria-label={`${point.label}: ${point.value === null ? "no data" : format(point.value)}`}
              onMouseEnter={() => setTooltip({ index, x: x(index), y: y(point.value ?? 0) })} onFocus={() => setTooltip({ index, x: x(index), y: y(point.value ?? 0) })}
              onMouseLeave={() => setTooltip(null)} onBlur={() => setTooltip(null)} />
            {point.value !== null && <circle className="mark marker" cx={x(index)} cy={y(point.value)} r={4} fill={color} />}
            {labels.has(index) && <text className="tick" x={x(index)} y={height - 6} textAnchor="middle">{point.label}</text>}
          </g>)}
          {last && <text className="direct-label" x={Math.min(x(last.index) + 8, width - 4)} y={y(last.value as number) - 8} textAnchor={last.index > points.length * 0.8 ? "end" : "start"}>{format(last.value as number)}</text>}
        </svg>
        <TooltipBox tooltip={tooltip} heading={tooltip ? points[tooltip.index].label : ""} rows={tooltip ? [{ key: "value", label: unit, value: points[tooltip.index].value === null ? "—" : format(points[tooltip.index].value as number), color }, ...(points[tooltip.index].detail ? [{ key: "detail", label: points[tooltip.index].detail as string, value: "" }] : [])] : []} />
      </>}
    </div>
  </ChartFrame>;
}

export function Sparkline({ values, width = 76, height = 26, series = "blue" }: { values: number[]; width?: number; height?: number; series?: Series }) {
  if (values.length < 2 || !values.some((value) => value > 0)) return null;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const y = (value: number) => height - 2 - (value / max) * (height - 4);
  const path = values.map((value, index) => `${index ? "L" : "M"}${(index * step).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const lastX = (values.length - 1) * step;
  return <svg className="stat-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
    <path d={path} fill="none" stroke="var(--line)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    <circle cx={lastX} cy={y(values.at(-1) ?? 0)} r={3} fill={seriesColor[series]} stroke="var(--surface)" strokeWidth={1.5} />
  </svg>;
}

export type Segment = { key: string; label: string; value: number; fill: "mastered" | "review" | "unseen" };

export function SegmentBar({ segments, total, thin = false, legend = false, ariaLabel }: { segments: Segment[]; total: number; thin?: boolean; legend?: boolean; ariaLabel?: string }) {
  const divisor = Math.max(total, 1);
  const description = segments.map((segment) => `${segment.value} ${segment.label.toLowerCase()}`).join(", ");
  return <>
    <div className={`segbar ${thin ? "segbar-thin" : ""}`} role="img" aria-label={ariaLabel ?? description}>
      {segments.map((segment) => <span key={segment.key} className={`fill-${segment.fill}`} style={{ width: `${segment.value * 100 / divisor}%` }} />)}
    </div>
    {legend && <div className="segbar-legend">
      {segments.map((segment) => <span key={segment.key}><i className={`fill-${segment.fill}`} /><strong>{segment.value.toLocaleString()}</strong> {segment.label}</span>)}
    </div>}
  </>;
}

export function HBarList({ rows, accent = false }: { rows: { key: string; label: string; sub?: string; value: number; max: number; display: string; detail?: string }[]; accent?: boolean }) {
  return <div className="hbar-list">
    {rows.map((row) => <div key={row.key} className="hbar-row">
      <span title={row.label}>{row.label}{row.sub && <small>{row.sub}</small>}</span>
      <span className="hbar-track" role="img" aria-label={`${row.label}: ${row.display}`}><i className={accent ? "accent" : ""} style={{ width: `${Math.min(100, row.value * 100 / Math.max(row.max, 1))}%` }} /></span>
      <strong>{row.display}{row.detail && <small>{row.detail}</small>}</strong>
    </div>)}
  </div>;
}
