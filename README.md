# WildTrack

A wildlife telemetry visualization tool. Plots real GPS tracking data from Magnificent Frigatebirds in the British Virgin Islands (2014–2016) on an interactive map, with a built-in API explorer for recruiters to interact with the backend directly.

## Tech Stack

**Frontend:** React 19, TypeScript, Vite, React-Leaflet, React-Leaflet-Cluster  
**Backend:** Spring Boot, PostGIS, Movebank API, Claude Haiku 4.5 (natural language queries)  
**Infrastructure:** AWS

## Features

- Interactive map with clustered markers from 9,000+ real telemetry events
- Collapsible API Explorer panel with all 12 backend endpoints
- Pre-filled example values so anyway can run queries without prior knowledge
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
| GET    | `/api/v1/events`                      | Get all telemetry events (paginated)       |
| GET    | `/api/v1/events/{id}`                 | Get a single event by ID                   |
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

Animal tracking data from "Magnificent Frigatebird_BVI_GPS-PTT_2014-2016" by Jodice, P.G.R., K. Meyer, S. Zaluski, and L. Soanes. Acknowledgements: RSPB, National Parks Trust of the Virgin Islands and BVI Department of Conservation & Fisheries. Licensed under CC BY 4.0. Data ingested and transformed for use in WildTrack application.
