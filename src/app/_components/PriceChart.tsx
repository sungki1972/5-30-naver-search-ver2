"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface Snap {
  date: string;
  market_low: number | null;
  market_median: number | null;
  market_high: number | null;
  my_price: number | null;
}

export function PriceChart({ data }: { data: Snap[] }) {
  if (!data.length) return <p className="text-slate-400">시계열 데이터가 아직 없습니다.</p>;
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v) => (typeof v === "number" ? v.toLocaleString("ko-KR") + "원" : String(v))} />
        <Legend />
        <Line type="monotone" dataKey="market_low" name="시장최저" stroke="#3b82f6" dot={false} />
        <Line type="monotone" dataKey="market_median" name="중앙값" stroke="#64748b" dot={false} />
        <Line type="monotone" dataKey="market_high" name="시장최고" stroke="#cbd5e1" dot={false} />
        <Line type="monotone" dataKey="my_price" name="내 판매가" stroke="#dc2626" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
