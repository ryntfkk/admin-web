// Helpers to unwrap Go database/sql null wrapper types that leak into JSON
// because admin endpoints return raw sqlc rows.
//   sql.NullString  -> { String, Valid }
//   sql.NullInt64   -> { Int64, Valid }
//   sql.NullInt32   -> { Int32, Valid }
//   sql.NullBool    -> { Bool, Valid }
//   sql.NullTime    -> { Time, Valid }
//   uuid.NullUUID   -> { UUID, Valid }
//   NullResolutionType -> { ResolutionType, Valid }

export interface NullString { String: string; Valid: boolean }
export interface NullInt64 { Int64: number; Valid: boolean }
export interface NullInt32 { Int32: number; Valid: boolean }
export interface NullInt16 { Int16: number; Valid: boolean }
export interface NullBool { Bool: boolean; Valid: boolean }
export interface NullTime { Time: string; Valid: boolean }
export interface NullUUID { UUID: string; Valid: boolean }

type MaybeNull<T> = T | null | undefined;

export function nstr(v: MaybeNull<NullString | string>): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  return v.Valid ? v.String : null;
}

export function nint(v: MaybeNull<NullInt64 | NullInt32 | NullInt16 | number>): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if ('Int64' in v) return v.Valid ? v.Int64 : null;
  if ('Int32' in v) return v.Valid ? v.Int32 : null;
  // sql.NullInt16 (mis. reviews.rating_quality) → { Int16, Valid }. Tanpa cabang
  // ini nilainya jadi objek mentah → render sebagai React child = crash.
  if ('Int16' in v) return v.Valid ? v.Int16 : null;
  return null;
}

export function nbool(v: MaybeNull<NullBool | boolean>): boolean {
  if (v == null) return false;
  if (typeof v === 'boolean') return v;
  return v.Valid ? v.Bool : false;
}

export function ntime(v: MaybeNull<NullTime | string>): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  return v.Valid ? v.Time : null;
}

export function nuuid(v: MaybeNull<NullUUID | string>): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  return v.Valid ? v.UUID : null;
}

export function nenum<K extends string>(
  v: MaybeNull<{ Valid: boolean } & Record<K, string>>,
  key: K,
): string | null {
  if (v == null) return null;
  return v.Valid ? v[key] : null;
}
