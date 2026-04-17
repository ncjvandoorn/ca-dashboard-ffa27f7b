import { useQuery } from "@tanstack/react-query";
import {
  loadAccounts,
  loadQualityReports,
  loadActivities,
  loadUsers,
  loadCustomerFarms,
  loadContainers,
  loadServicesOrders,
  loadShipperArrivals,
  loadShipperReports,
  loadShippingLines,
} from "@/lib/csvParser";

export function useAccounts() {
  return useQuery({ queryKey: ["accounts"], queryFn: loadAccounts, staleTime: Infinity });
}

export function useQualityReports() {
  return useQuery({ queryKey: ["qualityReports"], queryFn: loadQualityReports, staleTime: Infinity });
}

export function useActivities() {
  return useQuery({ queryKey: ["activities"], queryFn: loadActivities, staleTime: Infinity });
}

export function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: loadUsers, staleTime: Infinity });
}

export function useCustomerFarms() {
  return useQuery({ queryKey: ["customerFarms"], queryFn: loadCustomerFarms, staleTime: Infinity });
}

export function useContainers() {
  return useQuery({ queryKey: ["containers"], queryFn: loadContainers, staleTime: Infinity });
}

export function useServicesOrders() {
  return useQuery({ queryKey: ["servicesOrders"], queryFn: loadServicesOrders, staleTime: Infinity });
}

export function useShipperArrivals() {
  return useQuery({ queryKey: ["shipperArrivals"], queryFn: loadShipperArrivals, staleTime: Infinity });
}

export function useShipperReports() {
  return useQuery({ queryKey: ["shipperReports"], queryFn: loadShipperReports, staleTime: Infinity });
}

export function useShippingLines() {
  return useQuery({ queryKey: ["shippingLines"], queryFn: loadShippingLines, staleTime: Infinity });
}
