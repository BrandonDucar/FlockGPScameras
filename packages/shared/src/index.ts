// ─── Core Enums ─────────────────────────────────────────────────────────────

export enum LocationStatus {
  UNVERIFIED = 'unverified',
  VERIFIED = 'verified',
  DISPUTED = 'disputed',
  REMOVED = 'removed',
}

export enum CameraType {
  ALPR = 'alpr',           // Automatic License Plate Reader
  TRAFFIC = 'traffic',     // Traffic monitoring
  FIXED = 'fixed',         // Fixed surveillance
  MOBILE = 'mobile',       // Mobile/vehicle-mounted
  UNKNOWN = 'unknown',
}

export enum SourceType {
  USER_SUBMITTED = 'user_submitted',
  CSV_IMPORT = 'csv_import',
  MANUAL_ADMIN = 'manual_admin',
}

// ─── Core Types ─────────────────────────────────────────────────────────────

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface CameraLocation {
  id: string;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string;
  cameraType: CameraType;
  status: LocationStatus;
  confidenceScore: number;  // 0–100
  description: string | null;
  imageUrl: string | null;
  sourceType: SourceType;
  upvotes: number;
  downvotes: number;
  reportCount: number;
  createdAt: string;
  updatedAt: string;
  submittedBy: string | null;  // anonymous hash or user id
}

export interface CameraLocationSummary {
  id: string;
  lat: number;
  lng: number;
  status: LocationStatus;
  cameraType: CameraType;
  confidenceScore: number;
  city: string | null;
  state: string | null;
}

// ─── API Request/Response Types ──────────────────────────────────────────────

export interface SearchParams {
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  address?: string;
  zipCode?: string;
  city?: string;
  state?: string;
  status?: LocationStatus;
  cameraType?: CameraType;
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  locations: CameraLocationSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface LocationsInBoundsParams {
  north: number;
  south: number;
  east: number;
  west: number;
  status?: LocationStatus;
  minConfidence?: number;
}

export interface SubmitLocationBody {
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  cameraType: CameraType;
  description?: string;
  captchaToken?: string;
}

export interface VerifyLocationBody {
  vote: 'up' | 'down';
  comment?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  details?: Record<string, string[]>;
}

// ─── Map Types ───────────────────────────────────────────────────────────────

export interface MapCluster {
  id: string | number;
  lat: number;
  lng: number;
  count: number;
  isCluster: true;
}

export interface MapMarker extends CameraLocationSummary {
  isCluster: false;
}

export type MapFeature = MapCluster | MapMarker;

// ─── Confidence Score Helpers ────────────────────────────────────────────────

export function getConfidenceLabel(score: number): string {
  if (score >= 80) return 'High';
  if (score >= 50) return 'Medium';
  if (score >= 20) return 'Low';
  return 'Very Low';
}

export function getConfidenceColor(score: number): string {
  if (score >= 80) return '#22c55e';  // green
  if (score >= 50) return '#f59e0b';  // amber
  if (score >= 20) return '#f97316';  // orange
  return '#ef4444';                   // red
}

export function getStatusColor(status: LocationStatus): string {
  switch (status) {
    case LocationStatus.VERIFIED: return '#22c55e';
    case LocationStatus.UNVERIFIED: return '#f59e0b';
    case LocationStatus.DISPUTED: return '#f97316';
    case LocationStatus.REMOVED: return '#6b7280';
    default: return '#6b7280';
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const DEFAULT_RADIUS_MILES = 5;
export const MAX_RADIUS_MILES = 50;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 500;
export const US_CENTER: GeoPoint = { lat: 39.8283, lng: -98.5795 };
export const US_DEFAULT_ZOOM = 4;

export const LEGAL_DISCLAIMER = `FlockGPScameras is a community-maintained, 
crowdsourced database. Data accuracy is not guaranteed. This platform has NO 
affiliation with law enforcement, government agencies, or Flock Safety Inc. 
All data is submitted by community members and may be inaccurate, outdated, or 
incorrect. Do not use this data for any illegal purpose. Use at your own risk.`;
