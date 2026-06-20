import { PrismaClient, CameraType, LocationStatus, SourceType } from '@prisma/client';

const prisma = new PrismaClient();

const mockLocations = [
  // Atlanta, GA (Flock headquarters & high-density region)
  {
    lat: 33.7490,
    lng: -84.3880,
    address: "Peachtree St NE & 10th St NE",
    city: "Atlanta",
    state: "GA",
    zipCode: "30309",
    cameraType: CameraType.alpr,
    status: LocationStatus.verified,
    confidenceScore: 95,
    description: "Flock Falcon ALPR camera mounted on black pole near intersection, facing North.",
    sourceType: SourceType.manual_admin,
  },
  {
    lat: 33.7756,
    lng: -84.3963,
    address: "North Ave NW & Techwood Dr NW",
    city: "Atlanta",
    state: "GA",
    zipCode: "30332",
    cameraType: CameraType.alpr,
    status: LocationStatus.verified,
    confidenceScore: 90,
    description: "ALPR camera facing west on North Ave bridge.",
    sourceType: SourceType.user_submitted,
  },
  {
    lat: 33.8463,
    lng: -84.3621,
    address: "Lenox Rd NE & Peachtree Rd",
    city: "Atlanta",
    state: "GA",
    zipCode: "30326",
    cameraType: CameraType.alpr,
    status: LocationStatus.unverified,
    confidenceScore: 45,
    description: "Reported new ALPR camera at mall entrance.",
    sourceType: SourceType.user_submitted,
  },
  // Los Angeles, CA
  {
    lat: 34.0522,
    lng: -118.2437,
    address: "W Temple St & N Grand Ave",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90012",
    cameraType: CameraType.alpr,
    status: LocationStatus.verified,
    confidenceScore: 88,
    description: "Flock Falcon camera monitoring county administration building lanes.",
    sourceType: SourceType.manual_admin,
  },
  {
    lat: 34.0906,
    lng: -118.3267,
    address: "Sunset Blvd & Gower St",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90028",
    cameraType: CameraType.fixed,
    status: LocationStatus.unverified,
    confidenceScore: 50,
    description: "Fixed surveillance dome on traffic signal pole, check if ALPR.",
    sourceType: SourceType.user_submitted,
  },
  // Houston, TX
  {
    lat: 29.7604,
    lng: -95.3698,
    address: "Texas St & Main St",
    city: "Houston",
    state: "TX",
    zipCode: "77002",
    cameraType: CameraType.alpr,
    status: LocationStatus.verified,
    confidenceScore: 85,
    description: "Flock hardware installed on utility pole facing east bound lane.",
    sourceType: SourceType.csv_import,
  },
  // Chicago, IL
  {
    lat: 41.8781,
    lng: -87.6298,
    address: "S Michigan Ave & E Ida B Wells Dr",
    city: "Chicago",
    state: "IL",
    zipCode: "60605",
    cameraType: CameraType.alpr,
    status: LocationStatus.verified,
    confidenceScore: 92,
    description: "Dual-lens ALPR facing incoming traffic lanes.",
    sourceType: SourceType.manual_admin,
  },
  // San Francisco, CA
  {
    lat: 37.7749,
    lng: -122.4194,
    address: "Market St & 8th St",
    city: "San Francisco",
    state: "CA",
    zipCode: "94103",
    cameraType: CameraType.alpr,
    status: LocationStatus.verified,
    confidenceScore: 80,
    description: "Falcon ALPR camera facing West on Market Street.",
    sourceType: SourceType.user_submitted,
  },
  {
    lat: 37.8024,
    lng: -122.4058,
    address: "Lombard St & Stockton St",
    city: "San Francisco",
    state: "CA",
    zipCode: "94133",
    cameraType: CameraType.traffic,
    status: LocationStatus.disputed,
    confidenceScore: 20,
    description: "Reported as ALPR but appears to be a standard red-light camera loop.",
    sourceType: SourceType.user_submitted,
  }
];

async function main() {
  console.log("🌱 Starting Database Seeding...");

  // Clear existing
  await prisma.locationVote.deleteMany({});
  await prisma.locationReport.deleteMany({});
  await prisma.cameraLocation.deleteMany({});

  for (const loc of mockLocations) {
    const created = await prisma.cameraLocation.create({
      data: loc,
    });
    console.log(`✅ Created location: ${created.address} (${created.city}, ${created.state})`);
  }

  // Generate PostGIS geometries manually for seeded data
  await prisma.$executeRawUnsafe(`
    UPDATE camera_locations
    SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    WHERE geom IS NULL;
  `);

  console.log("🚀 PostGIS geometries synchronized.");
  console.log("🌱 Seeding Complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
