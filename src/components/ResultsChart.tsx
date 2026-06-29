import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Candidate } from '../types';

interface ResultsChartProps {
  candidates: Candidate[];
  votes: Record<string, number>;
  position: string;
}

export const ResultsChart: React.FC<ResultsChartProps> = ({ candidates, votes, position }) => {
  const data = candidates
    .filter(c => c.position === position)
    .map(c => ({
      name: c.fullname,
      votes: votes[c.id] || 0,
    }))
    .sort((a, b) => b.votes - a.votes);

  if (data.length === 0) return null;

  const colors = ['#1e3a8a', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

  return (
    <div className="h-64 w-full mt-4">
      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono mb-2">
        {position} Vote Distribution
      </h4>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" hide />
          <YAxis
            dataKey="name"
            type="category"
            width={120}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
          />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="votes" radius={[0, 4, 4, 0]} barSize={20}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
