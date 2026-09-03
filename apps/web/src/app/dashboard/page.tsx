"use client";

import { useEffect, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import type { Props as ReactApexChartProps } from "react-apexcharts";
import { AlertTriangle, ListChecks, UserCheck, Users } from "lucide-react";
import type { DashboardOverviewDto, SalespersonPerformanceDto } from "@ai-salesos/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { AppShell, ROLE_LABELS } from "@/components/AppShell";
import { STATUS_LABELS } from "@/lib/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ReactApexChart = dynamic(
  () =>
    import("react-apexcharts").then(
      (mod) => mod.default as unknown as ComponentType<ReactApexChartProps>,
    ),
  { ssr: false },
);

const TEMPERATURE_COLORS: Record<string, string> = {
  HOT: "#EF4444",
  WARM: "#F6B51E",
  COLD: "#49BEFF",
};

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null);
  const [performance, setPerformance] = useState<SalespersonPerformanceDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      apiFetch<DashboardOverviewDto>("/dashboard/overview").then(setOverview),
      apiFetch<SalespersonPerformanceDto[]>("/dashboard/performance").then(setPerformance),
    ]).catch((err) => {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
    });
  }, []);

  const statusEntries = overview ? Object.entries(overview.leadsByStatus) : [];
  const temperatureEntries = overview ? Object.entries(overview.leadsByTemperature) : [];

  const statusChartOptions: ApexOptions = {
    colors: ["#5D87FF"],
    chart: { fontFamily: "inherit", type: "bar", toolbar: { show: false } },
    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "55%" } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: statusEntries.map(([key]) => STATUS_LABELS[key] ?? key),
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    grid: { xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    tooltip: { y: { formatter: (val: number) => `${val} leads` } },
  };
  const statusChartSeries = [{ name: "Leads", data: statusEntries.map(([, count]) => count) }];

  const temperatureChartOptions: ApexOptions = {
    colors: temperatureEntries.map(([key]) => TEMPERATURE_COLORS[key] ?? "#98A2B3"),
    chart: { fontFamily: "inherit", type: "donut" },
    labels: temperatureEntries.map(([key]) => key),
    legend: { position: "bottom", fontFamily: "inherit" },
    dataLabels: { enabled: false },
    plotOptions: { pie: { donut: { size: "70%" } } },
  };
  const temperatureChartSeries = temperatureEntries.map(([, count]) => count);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>

        {error && (
          <Alert variant="lighterror">
            <AlertTitle>Couldn&apos;t load dashboard</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {overview && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total leads" value={overview.totalLeads} icon={Users} tone="lightprimary" />
            <StatCard label="Customers" value={overview.totalCustomers} icon={UserCheck} tone="lightsecondary" />
            <StatCard label="Tasks pending" value={overview.tasksPending} icon={ListChecks} tone="lightinfo" />
            <StatCard
              label="Tasks overdue"
              value={overview.tasksOverdue}
              icon={AlertTriangle}
              tone={overview.tasksOverdue > 0 ? "lightwarning" : "lightsuccess"}
            />
          </div>
        )}

        {!overview && !error && <p className="text-sm text-muted-foreground">Loading overview…</p>}

        {overview && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Leads by status</CardTitle>
              </CardHeader>
              <CardContent>
                {statusEntries.length > 0 ? (
                  <ReactApexChart
                    options={statusChartOptions}
                    series={statusChartSeries}
                    type="bar"
                    height={280}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No leads yet.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Leads by temperature</CardTitle>
              </CardHeader>
              <CardContent>
                {temperatureEntries.length > 0 ? (
                  <ReactApexChart
                    options={temperatureChartOptions}
                    series={temperatureChartSeries}
                    type="donut"
                    height={280}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No leads yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="p-0">
          <CardHeader className="p-6 pb-0">
            <CardTitle>Salesperson performance</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {performance && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salesperson</TableHead>
                    <TableHead>Leads assigned</TableHead>
                    <TableHead>Won</TableHead>
                    <TableHead>Lost</TableHead>
                    <TableHead>Tasks pending</TableHead>
                    <TableHead>Tasks overdue</TableHead>
                    <TableHead>Tasks completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performance.map((row) => (
                    <TableRow key={row.user.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{row.user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {ROLE_LABELS[row.user.role] ?? row.user.role}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.leadsAssigned}</TableCell>
                      <TableCell>
                        <Badge variant="lightSuccess">{row.leadsWon}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="lightError">{row.leadsLost}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.tasksPending}</TableCell>
                      <TableCell>
                        {row.tasksOverdue > 0 ? (
                          <Badge variant="lightWarning">{row.tasksOverdue}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.tasksCompleted}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {performance && performance.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p>
            )}
            {!performance && !error && (
              <p className="text-sm text-muted-foreground">Loading performance…</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: "lightprimary" | "lightsecondary" | "lightinfo" | "lightwarning" | "lightsuccess";
}) {
  const toneClasses: Record<string, string> = {
    lightprimary: "bg-lightprimary text-primary",
    lightsecondary: "bg-lightsecondary text-secondary",
    lightinfo: "bg-lightinfo text-info",
    lightwarning: "bg-lightwarning text-warning",
    lightsuccess: "bg-lightsuccess text-success",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-0">
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
          <Icon className="h-6 w-6" strokeWidth={1.8} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
