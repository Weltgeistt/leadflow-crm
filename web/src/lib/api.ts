import type {
  AppConfig,
  EmailDetail,
  EmailRecord,
  LeadDetail,
  LeadSummary,
  NewLeadInput,
  PipelineStats,
  Stage,
} from "@shared/domain";

/** Error thrown for non-2xx responses, carrying per-field validation details. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? res.statusText, body.details);
  return body as T;
}

const send = <T>(method: string, path: string, data?: unknown) =>
  request<T>(path, { method, body: data === undefined ? undefined : JSON.stringify(data) });

export const api = {
  config: () => request<AppConfig>("/config"),
  leads: () => request<LeadSummary[]>("/leads"),
  lead: (id: number) => request<LeadDetail>(`/leads/${id}`),
  attention: () => request<LeadSummary[]>("/attention"),
  stats: () => request<PipelineStats>("/stats"),
  outbox: () => request<EmailRecord[]>("/outbox"),
  email: (id: number) => request<EmailDetail>(`/outbox/${id}`),

  createLead: (input: NewLeadInput) => send<LeadDetail>("POST", "/leads", input),
  moveLead: (id: number, stage: Stage) => send<LeadDetail>("PATCH", `/leads/${id}/stage`, { stage }),
  markContacted: (id: number) => send<LeadDetail>("POST", `/leads/${id}/contacted`),
  addNote: (id: number, body: string) => send<LeadDetail>("POST", `/leads/${id}/notes`, { body }),
  runDigest: () => send<{ sent: boolean; email: EmailRecord | null }>("POST", "/digest"),
};
