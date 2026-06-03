
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
    returnsGeoFences?: boolean
    hasCoordinates?: boolean
  }