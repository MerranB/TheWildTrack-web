import { apiUrl } from "./api";

export const DEFAULT_PAGE_SIZE = 2000;
// Backstop so a malformed response can never spin the loop forever.
export const MAX_PAGES = 1000;
// Ceiling on markers handed to Leaflet in one run — past this the tab locks up.
export const MAX_MAPPED_ROWS = 50000;

export interface PageResult<T> {
  content: T[];
  pagesDone: number;
  /** Page to resume from — the first one not successfully consumed. */
  nextPage: number;
  totalElements: number | null;
  totalPages: number | null;
  /** Set when the walk stopped on a safety cap rather than the last page. */
  capped: string | null;
}

/** Thrown mid-walk, carrying whatever pages were fetched before the failure. */
export class PagingError<T> extends Error {
  partial: PageResult<T>;

  constructor(message: string, partial: PageResult<T>) {
    super(message);
    this.name = "PagingError";
    this.partial = partial;
  }
}

/**
 * A Spring `Page` body, or a bare array from an endpoint that isn't paged yet.
 * Tolerating both keeps the UI working on either side of a backend rollout.
 */
function readPage<T>(data: unknown) {
  if (Array.isArray(data)) {
    return { content: data as T[], last: true, number: null, total: null, pages: null };
  }
  const body = (data ?? {}) as Record<string, unknown>;
  return {
    content: Array.isArray(body.content) ? (body.content as T[]) : [],
    last: body.last === true,
    number: typeof body.number === "number" ? body.number : null,
    total: typeof body.totalElements === "number" ? body.totalElements : null,
    pages: typeof body.totalPages === "number" ? body.totalPages : null,
  };
}

/**
 * Walks a paged endpoint from `startPage` until the API reports the last page,
 * concatenating every page's content.
 */
export async function fetchAllPages<T>({
  buildRequest,
  startPage = 0,
  maxRows = Infinity,
  onPage,
}: {
  buildRequest: (page: number) => { url: string; options?: RequestInit };
  startPage?: number;
  maxRows?: number;
  onPage?: (progress: PageResult<T>) => void;
}): Promise<PageResult<T>> {
  const result: PageResult<T> = {
    content: [],
    pagesDone: 0,
    nextPage: Math.max(0, startPage),
    totalElements: null,
    totalPages: null,
    capped: null,
  };

  for (;;) {
    if (result.pagesDone >= MAX_PAGES) {
      result.capped = `Hit the ${MAX_PAGES}-page safety cap.`;
      break;
    }
    if (result.content.length >= maxRows) {
      result.capped = `Hit the ${maxRows.toLocaleString()}-row cap.`;
      break;
    }

    const page = result.nextPage;
    const { url, options } = buildRequest(page);
    const res = await fetch(apiUrl(url), options);

    if (res.status === 429) {
      throw new PagingError(
        `429 rate limited after ${result.pagesDone} page(s) — the API caps calls to this endpoint per day.`,
        result,
      );
    }
    if (!res.ok) {
      throw new PagingError(
        `${res.status} ${res.statusText} on page ${page}`,
        result,
      );
    }

    const body = readPage<T>(await res.json());
    result.content.push(...body.content);
    result.pagesDone++;
    if (body.total != null) result.totalElements = body.total;
    if (body.pages != null) result.totalPages = body.pages;

    const current = body.number ?? page;
    result.nextPage = current + 1;
    onPage?.(result);

    // Authoritative stop signal from the Page wrapper, then fallbacks for
    // responses that omit it.
    if (body.last) break;
    if (result.totalPages != null && current >= result.totalPages - 1) break;
    if (body.content.length === 0) break;
  }

  return result;
}
