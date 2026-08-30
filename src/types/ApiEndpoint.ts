
  export interface ApiField {
    key: string
    label: string
    defaultValue: string
    description: string
    isPathParam?: boolean
  }

  export interface ApiEndpoint {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    path: string
    description: string
    fields: ApiField[]
    body?: Record<string, unknown>
    returnsEvents: boolean
    adminOnly?: boolean
    /** Set when the endpoint defers its work until an emailed code is confirmed. */
    verifyPath?: string
    /** Completes "...to complete email verification and ___" in the code prompt. */
    verifyAction?: string
    returnsGeoFences?: boolean
    hasCoordinates?: boolean
    paged?: boolean
  }