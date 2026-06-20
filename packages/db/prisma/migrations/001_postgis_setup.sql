-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry column to camera_locations (lat/lng already in Prisma for ORM use)
-- This geometry column is maintained in sync for PostGIS spatial queries
ALTER TABLE camera_locations
  ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- Populate geom from lat/lng
UPDATE camera_locations
  SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
  WHERE geom IS NULL;

-- Spatial index (GIST) for radius queries
CREATE INDEX IF NOT EXISTS camera_locations_geom_idx
  ON camera_locations USING GIST(geom);

-- Function to auto-update geom when lat/lng change
CREATE OR REPLACE FUNCTION update_camera_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS camera_locations_geom_trigger ON camera_locations;
CREATE TRIGGER camera_locations_geom_trigger
  BEFORE INSERT OR UPDATE OF lat, lng ON camera_locations
  FOR EACH ROW EXECUTE FUNCTION update_camera_geom();

-- Composite index for bounding box queries (state + status)
CREATE INDEX IF NOT EXISTS camera_locations_state_status_idx
  ON camera_locations(state, status)
  WHERE is_active = true;

-- Partial index: only active locations (most queries filter this)
CREATE INDEX IF NOT EXISTS camera_locations_active_idx
  ON camera_locations(confidence_score DESC)
  WHERE is_active = true AND status != 'removed';

-- Deduplication helper: find nearby duplicates within 50 meters
-- Usage: SELECT * FROM find_nearby_duplicates(lng, lat, 50)
CREATE OR REPLACE FUNCTION find_nearby_duplicates(
  p_lng double precision,
  p_lat double precision,
  p_meters double precision DEFAULT 50
)
RETURNS TABLE(id text, distance_m double precision) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cl.id,
    ST_Distance(
      cl.geom::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance_m
  FROM camera_locations cl
  WHERE
    cl.is_active = true
    AND ST_DWithin(
      cl.geom::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_meters
    )
  ORDER BY distance_m ASC;
END;
$$ LANGUAGE plpgsql;
