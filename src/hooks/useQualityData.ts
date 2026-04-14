import { useQuery } from "@tanstack/react-query";
import { loadAccounts, loadQualityReports, loadActivities, loadUsers, loadCustomerFarms, loadContainers } from "@/lib/csvParser";

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: loadAccounts,
    staleTime: Infinity,
  });
}

export function useQualityReports() {
  return useQuery({
    queryKey: ["qualityReports"],
    queryFn: loadQualityReports,
    staleTime: Infinity,
  });
}

export function useActivities() {
  return useQuery({
    queryKey: ["activities"],
    queryFn: loadActivities,
    staleTime: Infinity,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: loadUsers,
    staleTime: Infinity,
  });
}

export function useCustomerFarms() {
  return useQuery({
    queryKey: ["customerFarms"],
    queryFn: loadCustomerFarms,
    staleTime: Infinity,
  });
}

export function useContainers() {
  return useQuery({
    queryKey: ["containers"],
    queryFn: loadContainers,
    staleTime: Infinity,
  });
}
