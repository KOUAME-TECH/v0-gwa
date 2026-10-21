type PaginationOptions = {
  defaultLimit?: number
  maxLimit?: number
}

export function parsePagination(
  params: URLSearchParams,
  { defaultLimit = 50, maxLimit = 100 }: PaginationOptions = {},
) {
  const normalizedMax = Math.max(1, Math.floor(maxLimit))
  const normalizedDefault = Math.min(normalizedMax, Math.max(1, Math.floor(defaultLimit)))
  const requestedLimit = Number(params.get("limit"))
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(normalizedMax, Math.max(1, Math.floor(requestedLimit)))
    : normalizedDefault
  const requestedOffset = Number(params.get("offset"))
  const offset =
    Number.isFinite(requestedOffset) && requestedOffset > 0
      ? Math.min(Number.MAX_SAFE_INTEGER - limit, Math.floor(requestedOffset))
      : 0
  return { limit, offset }
}
