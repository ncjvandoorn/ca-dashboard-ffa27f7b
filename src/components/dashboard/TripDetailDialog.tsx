import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SFTrip } from "@/pages/ActiveSF";
import { Thermometer, Droplets, Sun, MapPin, Clock } from "lucide-react";
import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Props {
  trip: SFTrip | null;
  onClose: () => void;
}

// Generate mock time-series data for the multigraph
function generateMockReadings(trip: SFTrip) {
  if (!trip.actualDepartureTime) return [];
  const points: { time: string; temp: number; light: number; humidity: number }[] = [];
  const now = Date.now();
  const hoursAgo = 48;
  for (let h = hoursAgo; h >= 0; h -= 2) {
    const t = new Date(now - h * 3600 * 1000);
    const baseTemp = trip.lastTemp ?? 3;
    const baseHum = trip.lastHumidity ?? 94;
    points.push({
      time: `${String(t.getDate()).padStart(2, "0")}/${String(t.getMonth() + 1).padStart(2, "0")} ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`,
      temp: +(baseTemp + (Math.random() - 0.5) * 3).toFixed(1),
      light: Math.random() < 0.15 ? +(Math.random() * 5).toFixed(1) : 0,
      humidity: +(baseHum + (Math.random() - 0.5) * 4).toFixed(1),
    });
  }
  return points;
}

export function TripDetailDialog({ trip, onClose }: Props) {
  const readings = useMemo(() => (trip ? generateMockReadings(trip) : []), [trip]);

  if (!trip) return null;

  const chrysalBlue = "hsl(207, 100%, 35%)";
  const chrysalGreen = "hsl(90, 67%, 41%)";
  const chrysalWarm = "hsl(38, 92%, 50%)";

  return (
    <Dialog open={!!trip} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            Trip {trip.tripId}
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              trip.tripStatus === "In Transit" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              {trip.tripStatus}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Most Recent Reading */}
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
              <span className="font-semibold text-sm">Most Recent</span>
              {trip.lastReadingTime && (
                <span className="text-xs text-muted-foreground ml-auto">{trip.lastReadingTime}</span>
              )}
            </div>
            {trip.lastLocation && (
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {trip.lastLocation}
              </p>
            )}
            {trip.serialNumber && (
              <p className="text-xs font-mono text-muted-foreground mb-3">({trip.serialNumber})</p>
            )}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1.5">
                <Thermometer className="h-4 w-4 text-destructive" />
                <span className="text-lg font-bold text-destructive">
                  {trip.lastTemp !== null ? `${trip.lastTemp} °C` : "—"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sun className="h-4 w-4 text-warning" />
                <span className="text-lg font-bold text-warning">
                  {trip.lastLight !== null ? `${trip.lastLight} %` : "—"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Droplets className="h-4 w-4 text-accent" />
                <span className="text-lg font-bold text-accent">
                  {trip.lastHumidity !== null ? `${trip.lastHumidity} %` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Origin info */}
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-foreground" />
              <span className="font-semibold text-sm">Departed from Origin</span>
            </div>
            <p className="font-medium text-sm">{trip.originName}</p>
            <p className="text-xs text-muted-foreground mb-3">{trip.originAddress}</p>
            {trip.actualDepartureTime && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Actual Departure: {trip.actualDepartureTime}
              </div>
            )}
            {trip.carrier && (
              <p className="text-xs text-muted-foreground mt-1">Carrier: {trip.carrier}</p>
            )}
            <p className="text-xs font-mono text-muted-foreground mt-1">
              Internal: {trip.internalTripId}
            </p>
          </div>
        </div>

        {/* Multigraph tabs */}
        <Tabs defaultValue="multigraph" className="w-full">
          <TabsList>
            <TabsTrigger value="multigraph">Multigraph</TabsTrigger>
            <TabsTrigger value="statistics">Trip Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="multigraph">
            {readings.length > 0 ? (
              <div className="h-[300px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={readings} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10 }}
                      interval={Math.floor(readings.length / 6)}
                    />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="temp"
                      name="Temperature (°C)"
                      stroke={chrysalBlue}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="humidity"
                      name="Humidity (%)"
                      stroke={chrysalGreen}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="light"
                      name="Light (%)"
                      stroke={chrysalWarm}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No readings available — trip has not started yet
              </p>
            )}
          </TabsContent>

          <TabsContent value="statistics">
            <div className="grid grid-cols-3 gap-4 py-4">
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Avg Temperature</p>
                <p className="text-xl font-bold text-primary">
                  {readings.length > 0
                    ? (readings.reduce((s, r) => s + r.temp, 0) / readings.length).toFixed(1) + " °C"
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Avg Humidity</p>
                <p className="text-xl font-bold text-accent">
                  {readings.length > 0
                    ? (readings.reduce((s, r) => s + r.humidity, 0) / readings.length).toFixed(1) + " %"
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Max Light</p>
                <p className="text-xl font-bold text-warning">
                  {readings.length > 0
                    ? Math.max(...readings.map((r) => r.light)).toFixed(1) + " %"
                    : "—"}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
