  import type { ApiEndpoint } from '../types/ApiEndpoint'

  export const endpoints: Record<string, ApiEndpoint[]> = {
    'Movebank Events': [
      {
        method: 'GET',
        path: '/api/v1/events/all',
        description: 'Returns all wildlife telemetry events in the database.',
        returnsEvents: true,
        fields: [],
      },
      {
        method: 'GET',
        path: '/api/v1/events/:id',
        description: 'Returns a single telemetry event by its database ID.',
        returnsEvents: true,
        fields: [
          { key: 'id', label: 'ID', defaultValue: '1', description: 'Event database ID', isPathParam: true },
        ],
      },
      {
        method: 'GET',
        path: '/api/v1/events/allDataPointsByRange',
        description: 'Returns all telemetry events within a given radius (in degrees) of a coordinate point. Uses a PostGIS spatial query. 1 degree is approximately 111km.',
        returnsEvents: true,
        fields: [
          { key: 'lat', label: 'Latitude', defaultValue: '18.4312', description: 'Center point latitude' },
          { key: 'lon', label: 'Longitude', defaultValue: '-64.6235', description: 'Center point longitude' },
          { key: 'range', label: 'Range (degrees)', defaultValue: '1', description: '1 degree ≈ 111km' },
          { key: 'page', label: 'Page', defaultValue: '0', description: 'Page number' },
          { key: 'size', label: 'Size', defaultValue: '100', description: 'Results per page' },
        ],
      },
      {
        method: 'GET',
        path: '/api/v1/events/allDataPointsByBox',
        description: 'Returns all telemetry events within a geographic bounding box. Uses a PostGIS spatial query.',
        returnsEvents: true,
        fields: [
          { key: 'minLat', label: 'Min Latitude', defaultValue: '18.3', description: 'Southern boundary' },
          { key: 'maxLat', label: 'Max Latitude', defaultValue: '18.6', description: 'Northern boundary' },
          { key: 'minLon', label: 'Min Longitude', defaultValue: '-64.8', description: 'Western boundary' },
          { key: 'maxLon', label: 'Max Longitude', defaultValue: '-64.4', description: 'Eastern boundary' },
          { key: 'page', label: 'Page', defaultValue: '0', description: 'Page number' },
          { key: 'size', label: 'Size', defaultValue: '100', description: 'Results per page' },
        ],
      },
      {
        method: 'POST',
        path: '/api/v1/events/updateDatabase',
        description: 'Manually triggers ingestion of the Magnificent Frigatebird dataset from Movebank. This re-fetches and stores the latest data from the Movebank API into the database.',
        returnsEvents: false,
        fields: [],
      },
    ],
    'Natural Language Query': [
      {
        method: 'GET',
        path: '/api/v1/analysis/query',
        description: 'Accepts a plain-English query, uses Claude Haiku 4.5 to extract spatial and temporal parameters, and returns matching telemetry events. Dataset covers Magnificent Frigatebird GPS tracking near the British Virgin Islands, 2014–2016.',
        returnsEvents: true,
        fields: [
          { key: 'userPrompt', label: 'Query', defaultValue: 'Show frigatebirds near Tortola after 2015', description:
          'A plain-English location and/or time query' },
          { key: 'page', label: 'Page', defaultValue: '0', description: 'Page number' },
          { key: 'size', label: 'Size', defaultValue: '100', description: 'Results per page' },
        ],
      },
    ],
    'Geo-fence': [
      {
        method: 'GET',
        path: '/api/v1/geoFence',
        description: 'Retrieves all geo-fences stored in the database, paginated.',
        returnsEvents: false,
        returnsGeoFences: true,
        fields: [
          { key: 'page', label: 'Page', defaultValue: '0', description: 'Page number' },
          { key: 'size', label: 'Size', defaultValue: '20', description: 'Results per page' },
        ],
      },
      {
        method: 'GET',
        path: '/api/v1/geoFence/:id',
        description: 'Returns a single geo-fence by its database ID.',
        returnsEvents: false,
        returnsGeoFences: true,
        fields: [
          { key: 'id', label: 'ID', defaultValue: '1', description: 'Geo-fence database ID', isPathParam: true },
        ],
      },
      {
        method: 'POST',
        path: '/api/v1/geoFence',
        description: 'Creates a new geo-fence. Note: the scheduled alert trigger is disabled in this environment as the dataset is historical (2014–2016). Use the Demo endpoint to see geo-fence alerts in action.',
        returnsEvents: false,
        fields: [
          { key: 'name', label: 'Name', defaultValue: 'Tortola Zone', description: 'Geo-fence name' },
          { key: 'email', label: 'Email', defaultValue: 'researcher@wildtrack.com', description: 'Alert email address'
        },
          { key: 'username', label: 'Username', defaultValue: 'researcher1', description: 'Username' },
        ],
        hasCoordinates: true,
        body: {
          lastAnimalCount: 0,
        },
      },
      {
        method: 'PUT',
        path: '/api/v1/geoFence/:id',
        description: 'Updates an existing geo-fence by ID.',
        returnsEvents: false,
        returnsGeoFences: true,
        fields: [
          { key: 'id', label: 'ID', defaultValue: '1', description: 'Geo-fence ID to update', isPathParam: true },
          { key: 'name', label: 'Name', defaultValue: 'Tortola Zone Updated', description: 'Updated name' },
          { key: 'email', label: 'Email', defaultValue: 'updated@wildtrack.com', description: 'Updated email' },
          { key: 'username', label: 'Username', defaultValue: 'researcher1', description: 'Username' },
        ],
        hasCoordinates: true,
        body: {
          lastAnimalCount: 0,
        },
      },
      {
        method: 'DELETE',
        path: '/api/v1/geoFence/:id',
        description: 'Deletes a geo-fence by its database ID.',
        returnsEvents: false,
        fields: [
          { key: 'id', label: 'ID', defaultValue: '1', description: 'Geo-fence ID to delete', isPathParam: true },
        ],
      },
    ],
    'Demo': [
      {
        method: 'POST',
        path: '/api/v1/demo',
        description: 'Demonstrates the geo-fence alert feature with simulated data. Since the dataset is historical (2014–2016), real movement events will never trigger alerts — this endpoint simulates that process so you can see the full geo-fence alert pipeline in action.',
        returnsEvents: false,
         fields: [ { key: 'email', label: 'Email', defaultValue: 'your@email.com', description: 'Email address to receive the demo geo-fence alert' },
  ],
   body: {
    name: 'Demo Tortola Zone',
    coordinates: [
      { lat: 18.3812, lon: -64.6735 },
      { lat: 18.4812, lon: -64.6735 },
      { lat: 18.4812, lon: -64.5735 },
      { lat: 18.3812, lon: -64.5735 },
      { lat: 18.3812, lon: -64.6735 },
    ],
    username: 'demo-user',
    lastAnimalCount: 0,
  },
      },
    ],
  }