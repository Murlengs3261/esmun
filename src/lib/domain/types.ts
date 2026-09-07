/**
 * Tipos del dominio ESMUN.
 * Espejan el esquema de supabase/migrations. Si cambias una migración,
 * cambia esto en el mismo commit.
 */

export type ParticipantRole = "mesa" | "delegado" | "staff" | "prensa" | "invitado";
export type SessionState = "draft" | "open" | "closed";
export type SessionKind = "refrigerio" | "almuerzo" | "acreditacion" | "otro";
export type AppRole = "admin" | "dispatcher";

export type ScanResult =
  | "granted"
  | "duplicate"
  | "unknown_token"
  | "not_eligible"
  | "session_closed"
  | "inactive";

/** Cómo se llaman los dos roles del sistema de cara a la gente. El enum
 *  de la base sigue siendo 'admin' | 'dispatcher': renombrar columnas por
 *  una etiqueta no compensa. */
export const APP_ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  dispatcher: "Escaneador",
};

export const ROLE_LABEL: Record<ParticipantRole, string> = {
  mesa: "Mesa",
  delegado: "Delegado",
  staff: "Staff",
  prensa: "Prensa",
  invitado: "Invitado",
};

export interface EventRow {
  id: string;
  name: string;
  organization: string;
  starts_on: string;
  ends_on: string;
  is_active: boolean;
}

export interface Profile {
  id: string;
  event_id: string | null;
  display_name: string;
  role: AppRole;
  is_active: boolean;
}

export interface Station {
  id: string;
  event_id: string;
  label: string;
  location: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Forum {
  id: string;
  event_id: string;
  name: string;
  short_name: string;
  sort_order: number;
}

export interface Delegation {
  id: string;
  forum_id: string;
  country: string;
  seats: number;
}

export interface Participant {
  id: string;
  event_id: string;
  external_code: string | null;
  full_name: string;
  role: ParticipantRole;
  forum_id: string | null;
  delegation_id: string | null;
  position: string | null;
  dietary_notes: string | null;
  qr_token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DispatchSession {
  id: string;
  event_id: string;
  name: string;
  kind: SessionKind;
  day_number: number | null;
  state: SessionState;
  eligible_roles: ParticipantRole[];
  scheduled_at: string | null;
  opened_at: string | null;
  closed_at: string | null;
  sort_order: number;
}

export interface Redemption {
  id: string;
  session_id: string;
  participant_id: string;
  dispatched_by: string;
  station_label: string | null;
  device_id: string | null;
  redeemed_at: string;
  was_offline: boolean;
  synced_at: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
}

/* ── Respuesta de redeem_qr ────────────────────────────────────────────
   Es un tipo discriminado a propósito: el componente de veredicto no
   puede compilar si olvida un caso. */

export type RedeemResponse =
  | {
      status: "granted";
      name: string;
      detail: string;
      /** Falta solo en un canje hecho sin red: el padrón local no lo trae. */
      role?: ParticipantRole;
      diet: string | null;
      redeemed_at: string;
      /** Se registró en el teléfono y sube cuando vuelva la señal. */
      offline?: boolean;
    }
  | {
      status: "duplicate";
      name: string;
      detail: string;
      redeemed_at: string;
      station: string | null;
      by: string | null;
    }
  | { status: "unknown_token" }
  | {
      status: "not_eligible";
      name: string;
      role?: ParticipantRole;
      eligible_roles?: ParticipantRole[];
      reason?: string;
    }
  | { status: "session_closed"; closed_at: string | null };

/** Lo que puede mostrar el panel de veredicto: la respuesta de la base o
 *  dos estados que solo existen en el teléfono. `sin_red` es cuando no hay
 *  señal y tampoco padrón local; `fallo` es un error que no es de red. */
export type ScanVerdict =
  | RedeemResponse
  | { status: "sin_red" }
  | { status: "fallo"; message: string };

/** Una fila del padrón que el teléfono descarga al abrir la sesión. */
export interface RosterEntry {
  qr_token: string;
  name: string;
  detail: string;
  diet: string | null;
}

/** Un canje esperando subir desde la cola local. */
export interface QueuedRedemption {
  id: string;
  qr_token: string;
  station: string | null;
  device_id: string;
  redeemed_at: string;
  attempts: number;
  last_attempt_at: string | null;
}
