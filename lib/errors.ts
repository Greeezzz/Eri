export type ApiErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_PLATFORM'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UPSTREAM_FAILED'
  | 'TIMEOUT';

export const HTTP_BY_CODE: Record<ApiErrorCode, number> = {
  INVALID_URL: 400,
  UNSUPPORTED_PLATFORM: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM_FAILED: 502,
  TIMEOUT: 504,
};

export class ApiError extends Error {
  code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }

  get status(): number {
    return HTTP_BY_CODE[this.code] ?? 500;
  }
}

/** Terjemahkan error upstream (axios/fetch) jadi code yang bisa ditampilkan ke user. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  const anyErr = err as { code?: string; name?: string; message?: string; response?: { status?: number } };
  const upstreamStatus = anyErr?.response?.status;

  if (anyErr?.code === 'ECONNABORTED' || anyErr?.name === 'AbortError' || anyErr?.name === 'TimeoutError') {
    return new ApiError('TIMEOUT', 'Server sumbernya kelamaan jawab. Coba lagi sebentar.');
  }
  if (upstreamStatus === 429) {
    return new ApiError('RATE_LIMITED', 'Kebanyakan permintaan ke server sumber. Tunggu sebentar ya.');
  }
  return new ApiError('UPSTREAM_FAILED', 'Server sumbernya lagi ga bisa dihubungi. Coba lagi nanti.');
}
