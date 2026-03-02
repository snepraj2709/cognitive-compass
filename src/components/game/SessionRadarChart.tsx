"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

export interface SessionRadarChartDatum {
  dimension: string;
  accuracy: number;
  fullMark: number;
}

interface SessionRadarChartProps {
  radarData: SessionRadarChartDatum[];
}

export default function SessionRadarChart({ radarData }: SessionRadarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={radarData}>
        <PolarGrid stroke="hsl(0 0% 100% / 0.08)" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fill: "hsl(0 0% 100% / 0.6)", fontSize: 11, fontFamily: "Space Mono" }}
        />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Accuracy"
          dataKey="accuracy"
          stroke="hsl(263 90% 66%)"
          fill="hsl(263 90% 66% / 0.2)"
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
