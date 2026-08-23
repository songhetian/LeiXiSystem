import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Setting type definitions
// ---------------------------------------------------------------------------

type SettingType = 'number' | 'boolean';

interface SettingDef {
  /** Full key stored in SystemSetting.key (e.g. 'attendance.late_threshold') */
  key: string;
  /** Camel-case key used in the API response / request body (e.g. 'lateThreshold') */
  camelCase: string;
  defaultValue: number | boolean;
  type: SettingType;
  /** Whether this setting is safe to expose on a public (non-admin) endpoint */
  isPublic: boolean;
}

/**
 * All attendance settings stored in the SystemSetting table under group 'attendance'.
 *
 * Public settings (visible to all authenticated users):
 *   - Policy flags that affect user behaviour (makeup, notifications, proof/approval requirements)
 *
 * Private settings (admin-only):
 *   - Thresholds, limits, and numeric configuration
 */
const SETTING_DEFS: readonly SettingDef[] = [
  { key: 'attendance.late_threshold', camelCase: 'lateThreshold', defaultValue: 30, type: 'number', isPublic: false },
  { key: 'attendance.early_threshold', camelCase: 'earlyThreshold', defaultValue: 30, type: 'number', isPublic: false },
  { key: 'attendance.early_clock_in_minutes', camelCase: 'earlyClockInMinutes', defaultValue: 60, type: 'number', isPublic: false },
  { key: 'attendance.late_clock_out_minutes', camelCase: 'lateClockOutMinutes', defaultValue: 120, type: 'number', isPublic: false },
  { key: 'attendance.absent_hours', camelCase: 'absentHours', defaultValue: 4, type: 'number', isPublic: false },
  { key: 'attendance.max_annual_leave_days', camelCase: 'maxAnnualLeaveDays', defaultValue: 10, type: 'number', isPublic: false },
  { key: 'attendance.max_sick_leave_days', camelCase: 'maxSickLeaveDays', defaultValue: 15, type: 'number', isPublic: false },
  { key: 'attendance.require_proof_for_sick_leave', camelCase: 'requireProofForSickLeave', defaultValue: true, type: 'boolean', isPublic: true },
  { key: 'attendance.require_approval_for_overtime', camelCase: 'requireApprovalForOvertime', defaultValue: true, type: 'boolean', isPublic: true },
  { key: 'attendance.min_overtime_hours', camelCase: 'minOvertimeHours', defaultValue: 1, type: 'number', isPublic: false },
  { key: 'attendance.max_overtime_hours_per_day', camelCase: 'maxOvertimeHoursPerDay', defaultValue: 4, type: 'number', isPublic: false },
  { key: 'attendance.allow_makeup', camelCase: 'allowMakeup', defaultValue: true, type: 'boolean', isPublic: true },
  { key: 'attendance.makeup_deadline_days', camelCase: 'makeupDeadlineDays', defaultValue: 3, type: 'number', isPublic: true },
  { key: 'attendance.makeup_monthly_limit', camelCase: 'makeupMonthlyLimit', defaultValue: 3, type: 'number', isPublic: true },
  { key: 'attendance.makeup_days_limit', camelCase: 'makeupDaysLimit', defaultValue: 30, type: 'number', isPublic: true },
  { key: 'attendance.require_approval_for_makeup', camelCase: 'requireApprovalForMakeup', defaultValue: true, type: 'boolean', isPublic: true },
  { key: 'attendance.notify_on_late', camelCase: 'notifyOnLate', defaultValue: true, type: 'boolean', isPublic: true },
  { key: 'attendance.notify_on_early_leave', camelCase: 'notifyOnEarlyLeave', defaultValue: true, type: 'boolean', isPublic: true },
  { key: 'attendance.notify_on_absent', camelCase: 'notifyOnAbsent', defaultValue: true, type: 'boolean', isPublic: true },
];

/** Quick lookup from camelCase → SettingDef */
const SETTING_MAP: ReadonlyMap<string, SettingDef> = new Map(
  SETTING_DEFS.map((def) => [def.camelCase, def]),
);

/** Shape of the settings object returned to the API */
export type AttendanceSettings = Record<string, number | boolean>;

@Injectable()
export class AttendanceSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // GET – read settings
  // -------------------------------------------------------------------------

  /**
   * Retrieve attendance settings merged with defaults.
   *
   * @param options.publicOnly  When `true`, only return settings whose
   *                            `isPublic` flag is `true` (for a future
   *                            public-facing endpoint).  Defaults to `false`
   *                            which returns **all** settings (admin view).
   */
  async getSettings(options?: { publicOnly?: boolean }): Promise<AttendanceSettings> {
    const publicOnly = options?.publicOnly ?? false;

    // Build query – admin sees everything, public endpoint filters by isPublic
    const where: { group: string; isPublic?: boolean } = { group: 'attendance' };
    if (publicOnly) {
      where.isPublic = true;
    }

    const stored = await this.prisma.systemSetting.findMany({ where });

    // Build a lookup of stored values keyed by the full setting key
    const storedMap = new Map<string, string>();
    for (const row of stored) {
      storedMap.set(row.key, row.value);
    }

    // Merge defaults with stored values
    const result: AttendanceSettings = {};
    for (const def of SETTING_DEFS) {
      // Skip private settings when only public are requested
      if (publicOnly && !def.isPublic) continue;

      const raw = storedMap.get(def.key);
      if (raw !== undefined) {
        result[def.camelCase] =
          def.type === 'number' ? Number(raw) : raw === 'true';
      } else {
        result[def.camelCase] = def.defaultValue;
      }
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // PUT – update settings
  // -------------------------------------------------------------------------

  /**
   * Upsert each provided setting key into the `SystemSetting` table.
   *
   * Only keys that exist in {@link SETTING_DEFS} are processed – unknown
   * keys are silently ignored.
   *
   * @param data       Partial settings object (camelCase keys).
   * @param updatedBy  User ID from the JWT, recorded for audit.
   * @returns The full updated settings object (same shape as `getSettings`).
   */
  async updateSettings(
    data: Record<string, number | boolean>,
    updatedBy?: number,
  ): Promise<AttendanceSettings> {
    // Upsert each provided key
    for (const [camelCase, value] of Object.entries(data)) {
      const def = SETTING_MAP.get(camelCase);
      if (!def) continue; // ignore unknown keys

      const stringValue = String(value);

      await this.prisma.systemSetting.upsert({
        where: { key: def.key },
        update: {
          value: stringValue,
          updatedBy,
        },
        create: {
          group: 'attendance',
          key: def.key,
          value: stringValue,
          isPublic: def.isPublic,
          updatedBy,
        },
      });
    }

    // Return the full, freshly-read settings object
    return this.getSettings();
  }
}
