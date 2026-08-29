# WildTrack

A wildlife telemetry visualization tool. Plots real GPS tracking data from the Movebank research platform on an interactive map, with a built-in API explorer for recruiters to interact with the backend directly.

The app is dataset-agnostic: which studies are loaded is configuration, and they are swapped out regularly. Nothing in the frontend or the API is tied to a particular species, region, or date range. See [Dataset](#dataset) for what is loaded now.

## Tech Stack

**Frontend:** React 19, TypeScript, Vite, MapLibre GL JS (Mapbox Vector Tiles)  
**Backend:** Spring Boot, PostGIS, Movebank API, Claude Haiku 4.5 (natural language queries)  
**Infrastructure:** AWS

## Features

- Interactive map that renders the entire loaded dataset as server-generated vector
  tiles, aggregated per zoom level, so the browser never holds more than the current
  viewport (tested at 2.6M events)
- Hotspot pins showing where the data actually is, since telemetry studies tend to be
  heavily concentrated and a world view would otherwise look empty
- Collapsible API Explorer panel covering the backend endpoints
- Pre-filled example values so anyone can run queries without prior knowledge
- Natural language query interface powered by Claude Haiku 4.5
- Geo-fence creation and alert demo

## Running Locally

### Prerequisites

- Node.js 18+
- Java 17+
- The Spring Boot backend running locally on port 8080

### Frontend Setup

```bash
# Install dependencies
npm install

# Create environment file
echo "VITE_API_BASE_URL=http://localhost:8080" > .env

# Start dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Backend Setup

See the backend repository: [GitHub/MerranB/WildTrack](https://github.com/MerranB/Wildtrack)

## API Endpoints

### Movebank Events

| Method | Endpoint                              | Description                                |
| ------ | ------------------------------------- | ------------------------------------------ |
| GET    | `/api/v1/events/all`                  | Get all telemetry events (paginated)       |
| GET    | `/api/v1/events/{id}`                 | Get a single event by ID                   |
| GET    | `/api/v1/events/tiles/{z}/{x}/{y}.mvt`| Mapbox Vector Tile for a map tile, built by PostGIS |
| GET    | `/api/v1/events/hotspots`             | Coarse density summary of the whole dataset |
| GET    | `/api/v1/events/allDataPointsByRange` | Query events by radius using PostGIS       |
| GET    | `/api/v1/events/allDataPointsByBox`   | Query events by bounding box using PostGIS |
| POST   | `/api/v1/events/updateDatabase`       | Trigger manual Movebank data ingestion     |

### Natural Language Query

| Method | Endpoint                 | Description                                                  |
| ------ | ------------------------ | ------------------------------------------------------------ |
| GET    | `/api/v1/analysis/query` | Query wildlife data using plain English via Claude Haiku 4.5 |

### Geo-fence

| Method | Endpoint                | Description           |
| ------ | ----------------------- | --------------------- |
| GET    | `/api/v1/geoFence`      | Get all geo-fences    |
| GET    | `/api/v1/geoFence/{id}` | Get a geo-fence by ID |
| POST   | `/api/v1/geoFence`      | Create a geo-fence    |
| PUT    | `/api/v1/geoFence/{id}` | Update a geo-fence    |
| DELETE | `/api/v1/geoFence/{id}` | Delete a geo-fence    |

### Demo

| Method | Endpoint       | Description                                        |
| ------ | -------------- | -------------------------------------------------- |
| POST   | `/api/v1/demo` | Simulate a geo-fence alert with your email address |

## Dataset

All data comes from [Movebank](https://www.movebank.org/) and is ingested and
transformed for use in the WildTrack application. Which studies are loaded changes
over time; each one currently loaded is credited below, along with its licence.

- **Magnificent Frigatebird_BVI_GPS-PTT_2014-2016** by Jodice, P.G.R., K. Meyer,
  S. Zaluski, and L. Soanes. Acknowledgements: RSPB, National Parks Trust of the
  Virgin Islands and BVI Department of Conservation & Fisheries. Licensed under
  CC BY 4.0.

When a study is added or removed, add or remove its entry here. Attribution is a
licence condition for CC BY data, not a formality.
