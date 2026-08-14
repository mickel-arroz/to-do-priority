"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { buildChartSeries } from "@/lib/habits";
import { useT } from "@/lib/i18n/locale-context";
import type { Habit, HabitLog } from "@/lib/types";

export function HabitCharts({
  habit,
  logs,
  today,
}: {
  habit: Habit;
  logs: HabitLog[];
  today: string;
}) {
  const t = useT();
  const { weekly, cumulative } = buildChartSeries(habit, logs, today);

  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="habit-charts">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.habits.weeklyChart}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{ completed: { label: t.habits.completedDays, color: "var(--chart-2)" } }}
            className="h-48 w-full"
          >
            <BarChart data={weekly}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="week"
                tickFormatter={(v: string) => v.slice(5)}
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />
              <YAxis allowDecimals={false} width={24} tickLine={false} axisLine={false} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="completed" fill="var(--color-completed)" radius={6} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.habits.cumulativeChart}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{ progress: { label: t.habits.progress, color: "var(--chart-1)" } }}
            className="h-48 w-full"
          >
            <LineChart data={cumulative}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => v.slice(5)}
                tickLine={false}
                axisLine={false}
                fontSize={11}
                interval="preserveStartEnd"
              />
              <YAxis allowDecimals={false} width={24} tickLine={false} axisLine={false} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="progress"
                stroke="var(--color-progress)"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
