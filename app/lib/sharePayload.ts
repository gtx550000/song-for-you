export interface SharePayload {
  message: string;
  songIds: string[];
}

export function isSharePayload(value: unknown): value is SharePayload {
  if (typeof value !== 'object' || value === null || !('message' in value) || !('songIds' in value)) {
    return false;
  }

  return (
    typeof value.message === 'string' &&
    Boolean(value.message.trim()) &&
    value.message.length <= 500 &&
    Array.isArray(value.songIds) &&
    value.songIds.length >= 1 &&
    value.songIds.length <= 5 &&
    value.songIds.every((id) => typeof id === 'string' && /^[\w-]{11}$/.test(id))
  );
}
