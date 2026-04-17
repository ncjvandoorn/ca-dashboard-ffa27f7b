import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SFTrip } from "@/pages/ActiveSF";
import { useSensiwatchReadings } from "@/hooks/useSensiwatchData";
import { Thermometer, Droplets, Sun, MapPin, Clock, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TripPathMap } from "./TripPathMap";

interface Props {
  trip: SFTrip | null;
  onClose: () => void;
}

export function TripDetailDialog({ trip, onClose }: Props) {
  const { readings, isLoading: readingsLoading } = useSensiwatchReadings(
    trip?.serialNumber ?? null,
    trip?.actualDepartureTime ?? null
  );

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
              trip.tripStatus === "In Transit" || trip.tripStatus === "InTransit"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}>
              {trip.tripStatus}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Trip route map */}
        <div className="mb-4 rounded-xl border border-border overflow-hidden">
          <TripPathMap trip={trip} height={280} />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <MostRecentCard trip={trip} />
          <OriginCard trip={trip} />
        </div>

        {/* Multigraph tabs */}
        <Tabs defaultValue="multigraph" className="w-full">
          <TabsList>
            <TabsTrigger value="multigraph">Multigraph</TabsTrigger>
            <TabsTrigger value="statistics">Trip Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="multigraph">
            {readingsLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading sensor data…</span>
              </div>
            ) : readings.length > 0 ? (
              <div className="h-[300px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={readings} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10 }}
                      interval={Math.max(0, Math.floor(readings.length / 6))}
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
                    <Line yAxisId="left" type="monotone" dataKey="temp" name="Temperature (°C)" stroke={chrysalBlue} strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humidity (%)" stroke={chrysalGreen} strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="light" name="Light (%)" stroke={chrysalWarm} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No sensor readings available for this trip
              </p>
            )}
          </TabsContent>

          <TabsContent value="statistics">
            <div className="grid grid-cols-3 gap-4 py-4">
              <StatBox label="Avg Temperature" value={readings.length > 0 ? (readings.reduce((s, r) => s + r.temp, 0) / readings.length).toFixed(1) + " °C" : "—"} color="text-primary" />
              <StatBox label="Avg Humidity" value={readings.length > 0 ? (readings.reduce((s, r) => s + r.humidity, 0) / readings.length).toFixed(1) + " %" : "—"} color="text-accent" />
              <StatBox label="Max Light" value={readings.length > 0 ? Math.max(...readings.map((r) => r.light)).toFixed(1) + " %" : "—"} color="text-warning" />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function MostRecentCard({ trip }: { trip: SFTrip }) {
  return (
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
  );
}

function OriginCard({ trip }: { trip: SFTrip }) {
  return (
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
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
