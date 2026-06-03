export interface GeoFenceCoordinate {
    lat: number
    lon: number
  }

  export interface GeoFence {
    id: number
    name: string
    coordinates: GeoFenceCoordinate[]
    email: string
    username: string
    lastAnimalCount: number
    lastAlertSent: string
  }
