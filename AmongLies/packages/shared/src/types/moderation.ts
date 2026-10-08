export const REPORT_REASONS = ['insults', 'cheating', 'spam', 'inappropriate', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export type ReportInput =
  | { kind: 'player'; playerId: string; reason: ReportReason; details?: string }
  | { kind: 'workshop_item'; itemId: string; reason: ReportReason; details?: string };

export interface ReportEvidence {
  nickname: string;
  message: string;
  timestamp: number;
}

/** Un reporte como lo ve el panel de admin. */
export interface ReportView {
  id: string;
  kind: 'player' | 'workshop_item';
  reason: ReportReason;
  details: string;
  evidence: ReportEvidence[];
  roomCode: string | null;
  status: ReportStatus;
  resolution: string | null;
  createdAt: string;
  reporter: { userId: string | null; nickname: string; username: string | null };
  target: {
    userId: string | null;
    nickname: string | null;
    username: string | null;
    suspendedUntil: string | null;
  } | null;
  item: { id: string; title: string; published: boolean } | null;
}

export interface AdminUserView {
  userId: string;
  username: string;
  avatarId: string;
  isAdmin: boolean;
  suspendedUntil: string | null;
  suspensionReason: string | null;
}

export type ModerationError =
  | 'guest'
  | 'not_admin'
  | 'invalid'
  | 'not_found'
  | 'too_many_reports'
  | 'unavailable';

export type ModerationResult<T = object> = ({ ok: true } & T) | { ok: false; error: ModerationError };
export type ModerationAck<T = object> = (result: ModerationResult<T>) => void;
