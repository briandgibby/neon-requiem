import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding the Urban Sprawl (Plan 12)...');

  // 1. Create the Main Sprawl Zone
  const sprawlZone = await prisma.zone.upsert({
    where: { slug: 'neon-district' },
    update: {},
    create: {
      slug: 'neon-district',
      name: 'The Neon District',
      securityRating: 'B',
    },
  });

  // 2. The Neon Strip (Entertainment District)
  // [0,0] - The Strip Entrance
  const stripEntrance = await prisma.room.upsert({
    where: { slug: 'strip-entrance' },
    update: {},
    create: {
      slug: 'strip-entrance',
      zoneId: sprawlZone.id,
      name: 'The Neon Strip - Main Gate',
      description: 'A colossal holographic dragon snakes through the air above the entrance, its scales shimmering in shades of violet and emerald. The ground here is a glass-reinforced composite, glowing with internal fiber optics that pulse like a synthetic heartbeat. Crowds of salarymen and street-punks alike push past each other, their faces washed in the relentless glare of a thousand advertisements.',
      securityRating: 'B',
      isPOI: true,
      poiCategory: 'HUB',
      gridX: 0,
      gridY: 0,
      exits: {
        north: 'the-broken-circuit',
        east: 'neon-boulevard-1',
      }
    }
  });

  // [0,1] - The Broken Circuit (BAR)
  await prisma.room.upsert({
    where: { slug: 'the-broken-circuit' },
    update: {},
    create: {
      slug: 'the-broken-circuit',
      zoneId: sprawlZone.id,
      name: 'The Broken Circuit',
      description: 'The air inside is thick with a mixture of clove-smoke, ozone, and cheap synth-ale. Distorted synth-wave music thumps through high-fidelity speakers mounted to the exposed industrial piping in the ceiling. The bar itself is a long slab of polished obsidian, behind which a bartender with a cybernetic arm deftly pours glowing concoctions. Booths along the walls are filled with low-voiced conversations and the occasional flash of a neural link.',
      securityRating: 'B',
      isPOI: true,
      poiCategory: 'BAR',
      gridX: 0,
      gridY: 1,
      exits: {
        south: 'strip-entrance',
      }
    }
  });

  // [1,0] - Neon Boulevard 1
  await prisma.room.upsert({
    where: { slug: 'neon-boulevard-1' },
    update: {},
    create: {
      slug: 'neon-boulevard-1',
      zoneId: sprawlZone.id,
      name: 'Neon Boulevard - West',
      description: 'Rain-slicked pavement reflects the vertical forest of signs rising on either side of the wide avenue. Enormous screens display endless loops of "Perfect Life" bioware, their colors bleeding into the puddles below. A mag-lev train whispers overhead on a suspended rail, casting a momentary shadow over the neon-drenched street.',
      securityRating: 'B',
      gridX: 1,
      gridY: 0,
      exits: {
        west: 'strip-entrance',
        east: 'black-market-gate',
      }
    }
  });

  // 3. The Black Market (The Crime Mall equivalent)
  // [2,0] - Black Market Gate
  const marketGate = await prisma.room.upsert({
    where: { slug: 'black-market-gate' },
    update: {},
    create: {
      slug: 'black-market-gate',
      zoneId: sprawlZone.id,
      name: 'The Black Market Entrance',
      description: 'The gleaming lights of the Strip fade here, replaced by the flickering, stuttering glow of unshielded wiring and bootleg signs. A narrow opening between two monolithic concrete buildings leads into a maze of alleyways. Men in heavy trench coats stand in the shadows, their eyes scanning the newcomers with predatory intent. This is where the law of the corps ends and the rule of the nuyen begins.',
      securityRating: 'C',
      isPOI: true,
      poiCategory: 'HUB',
      gridX: 2,
      gridY: 0,
      exits: {
        west: 'neon-boulevard-1',
        north: 'hardware-alley',
      }
    }
  });

  // [2,1] - Hardware Alley (WEAPONS/DECKS)
  await prisma.room.upsert({
    where: { slug: 'hardware-alley' },
    update: {},
    create: {
      slug: 'hardware-alley',
      zoneId: sprawlZone.id,
      name: 'Hardware Alley',
      description: 'The alley is barely wide enough for two people to walk abreast. The walls are covered in a dense carpet of cables, junction boxes, and terminal stubs. Stalls built into the alcoves display everything from refurbished Ares Predators to black-market Sony cyberdecks with their casing removed to reveal glowing custom cooling loops. The air smells of solder and hot metal.',
      securityRating: 'C',
      isPOI: true,
      poiCategory: 'SHOP',
      gridX: 2,
      gridY: 1,
      exits: {
        south: 'black-market-gate',
        north: 'reagent-row',
      }
    }
  });

  // [2,2] - Reagent Row (MAGIC SUPPLIES)
  await prisma.room.upsert({
    where: { slug: 'reagent-row' },
    update: {},
    create: {
      slug: 'reagent-row',
      zoneId: sprawlZone.id,
      name: 'Reagent Row',
      description: 'The hum of electronics is softer here, replaced by the faint, rhythmic tinkling of wind chimes and the heavy scent of exotic incense. Small shops with beaded curtains sell bundles of dried sage, jars of preserved paranormal organs, and vials of shimmering mana-infused dust. Symbols of ancient traditions are spray-painted over the faded corporate logos on the brickwork.',
      securityRating: 'C',
      isPOI: true,
      poiCategory: 'SHOP',
      gridX: 2,
      gridY: 2,
      exits: {
        south: 'hardware-alley',
        east: 'clinic-row-entrance',
      }
    }
  });

  // 4. Clinic Row (Medical District)
  // [3,2] - Clinic Row Entrance
  await prisma.room.upsert({
    where: { slug: 'clinic-row-entrance' },
    update: {},
    create: {
      slug: 'clinic-row-entrance',
      zoneId: sprawlZone.id,
      name: 'Clinic Row Entrance',
      description: 'The chaotic energy of the Black Market gives way to a sterile, almost oppressive quiet. The walls are paneled in white polymer, and the floor is a seamless gray anti-static mat. The lighting is sharp and clinical, humming with a frequency that sets teeth on edge. This district belongs to the street docs and the desperate.',
      securityRating: 'B',
      isPOI: true,
      poiCategory: 'HUB',
      gridX: 3,
      gridY: 2,
      exits: {
        west: 'reagent-row',
        north: 'the-street-clinic',
      }
    }
  });

  // [3,3] - The Street Clinic (CLINIC)
  await prisma.room.upsert({
    where: { slug: 'the-street-clinic' },
    update: {},
    create: {
      slug: 'the-street-clinic',
      zoneId: sprawlZone.id,
      name: 'The Bio-Fix Clinic',
      description: 'The waiting area is filled with individuals whose bodies are works in progress—half-finished cybernetic limbs, glowing optic replacements still settling in their sockets, and the occasional unconscious runner on a mag-stretcher. The smell of high-grade antiseptic and burnt flesh is pervasive. Behind a reinforced glass window, a receptionist with multiple optical lenses processes nuyen transfers for life-saving surgeries.',
      securityRating: 'B',
      isPOI: true,
      poiCategory: 'CLINIC',
      gridX: 3,
      gridY: 3,
      exits: {
        south: 'clinic-row-entrance',
      }
    }
  });

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
