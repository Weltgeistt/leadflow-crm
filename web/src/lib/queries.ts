import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LeadDetail, LeadSummary, Stage } from "@shared/domain";
import { api } from "./api";

export const keys = {
  config: ["config"] as const,
  leads: ["leads"] as const,
  lead: (id: number) => ["leads", id] as const,
  attention: ["attention"] as const,
  stats: ["stats"] as const,
  outbox: ["outbox"] as const,
  email: (id: number) => ["outbox", id] as const,
};

export const useConfig = () => useQuery({ queryKey: keys.config, queryFn: api.config, staleTime: Infinity });
export const useLeads = () => useQuery({ queryKey: keys.leads, queryFn: api.leads });
export const useAttention = () => useQuery({ queryKey: keys.attention, queryFn: api.attention });
export const useStats = () => useQuery({ queryKey: keys.stats, queryFn: api.stats });
export const useOutbox = () => useQuery({ queryKey: keys.outbox, queryFn: api.outbox });

export const useLead = (id: number | null) =>
  useQuery({ queryKey: keys.lead(id ?? 0), queryFn: () => api.lead(id!), enabled: id !== null });

export const useEmail = (id: number | null) =>
  useQuery({ queryKey: keys.email(id ?? 0), queryFn: () => api.email(id!), enabled: id !== null });

/** After any change to a lead, refresh everything derived from it. */
function useLeadUpdated() {
  const qc = useQueryClient();
  return (lead: LeadDetail) => {
    qc.setQueryData(keys.lead(lead.id), lead);
    void qc.invalidateQueries({ queryKey: keys.leads });
    void qc.invalidateQueries({ queryKey: keys.attention });
    void qc.invalidateQueries({ queryKey: keys.stats });
  };
}

/** Drag-and-drop stage change with an optimistic update, rolled back on error. */
export function useMoveLead() {
  const qc = useQueryClient();
  const onUpdated = useLeadUpdated();
  return useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: Stage }) => api.moveLead(id, stage),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: keys.leads });
      const previous = qc.getQueryData<LeadSummary[]>(keys.leads);
      qc.setQueryData<LeadSummary[]>(keys.leads, (leads) =>
        leads?.map((l) =>
          l.id === id
            ? { ...l, stage, needsFollowUp: false, daysIdle: 0, lastActivityAt: new Date().toISOString() }
            : l,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(keys.leads, context.previous);
    },
    onSuccess: onUpdated,
  });
}

export function useMarkContacted() {
  const onUpdated = useLeadUpdated();
  return useMutation({ mutationFn: (id: number) => api.markContacted(id), onSuccess: onUpdated });
}

export function useAddNote() {
  const onUpdated = useLeadUpdated();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => api.addNote(id, body),
    onSuccess: onUpdated,
  });
}

export function useRunDigest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.runDigest,
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.outbox }),
  });
}
