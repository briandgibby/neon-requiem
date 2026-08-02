import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { STARTING_ROOM_SHADOW, STARTING_ROOM_CORP } from '../src/shared/constants';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding world data...');

  // Create Zones
  const corpZone = await prisma.zone.upsert({
    where: { slug: 'corp-hub' },
    update: {},
    create: {
      slug: 'corp-hub',
      name: 'Gleaming Arcology Hub',
      securityRating: 'AAA',
    },
  });

  const shadowZone = await prisma.zone.upsert({
    where: { slug: 'shadow-hub' },
    update: {},
    create: {
      slug: 'shadow-hub',
      name: 'Undermarket Sprawl',
      securityRating: 'C',
    },
  });

  // Create Rooms for Corp Hub
  const corpCenter = await prisma.room.upsert({
    where: { slug: STARTING_ROOM_CORP },
    update: {
      gridX: 5,
      gridY: 5,
    },
    create: {
      slug: STARTING_ROOM_CORP,
      zoneId: corpZone.id,
      name: 'Arcology Main Plaza',
      description: 'A vast, sterile plaza with gleaming chrome surfaces and holographic advertisements for Mitsuhama and Renraku.',
      securityRating: 'AAA',
      gridX: 5,
      gridY: 5,
      exits: {
        north: 'corp-executive-offices',
        south: 'corp-transit-hub',
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'corp-executive-offices' },
    update: {
      gridX: 5,
      gridY: 6,
    },
    create: {
      slug: 'corp-executive-offices',
      zoneId: corpZone.id,
      name: 'Executive Office Wing',
      description: 'High-security offices for the corporate elite. The air is filtered and smells faintly of expensive cologne.',
      securityRating: 'AAA',
      baseDisposition: 'SUSPICIOUS',
      gridX: 5,
      gridY: 6,
      exits: {
        south: STARTING_ROOM_CORP,
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'corp-transit-hub' },
    update: {
      gridX: 5,
      gridY: 4,
      exits: {
        north: STARTING_ROOM_CORP,
        south: 'neon-bazaar',
      },
    },
    create: {
      slug: 'corp-transit-hub',
      zoneId: corpZone.id,
      name: 'Transit Terminal',
      description: 'The main hub for mag-lev trains connecting the arcology to the rest of the city.',
      securityRating: 'AA',
      baseDisposition: 'NEUTRAL',
      gridX: 5,
      gridY: 4,
      exits: {
        north: STARTING_ROOM_CORP,
        south: 'neon-bazaar',
      },
    },
  });

  // Create Rooms for Shadow Hub
  const shadowCenter = await prisma.room.upsert({
    where: { slug: STARTING_ROOM_SHADOW },
    update: {
      gridX: 5,
      gridY: 5,
      exits: {
        east: 'shadow-black-market',
        west: 'shadow-gang-turf',
      },
    },
    create: {
      slug: STARTING_ROOM_SHADOW,
      zoneId: shadowZone.id,
      name: 'The Pit',
      description: 'A dark, crowded intersection in the heart of the Undermarket. Neon signs flicker and the smell of soy-burgers and rain fills the air.',
      securityRating: 'C',
      gridX: 5,
      gridY: 5,
      exits: {
        east: 'shadow-black-market',
        west: 'shadow-gang-turf',
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'shadow-black-market' },
    update: {
      isPOI: true,
      poiCategory: 'SHOP',
      gridX: 6,
      gridY: 5,
    },
    create: {
      slug: 'shadow-black-market',
      zoneId: shadowZone.id,
      name: 'Black Market Alley',
      description: 'A narrow alleyway lined with vendors selling everything from illegal cyberdecks to street-grade stimulants.',
      securityRating: 'D',
      isPOI: true,
      poiCategory: 'SHOP',
      gridX: 6,
      gridY: 5,
      exits: {
        west: STARTING_ROOM_SHADOW,
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'shadow-gang-turf' },
    update: {
      gridX: 4,
      gridY: 5,
    },
    create: {
      slug: 'shadow-gang-turf',
      zoneId: shadowZone.id,
      name: 'Graffiti-Scrawled Courtyard',
      description: 'A courtyard claimed by the local Neon Razors gang. Watch your step.',
      securityRating: 'D',
      gridX: 4,
      gridY: 5,
      exits: {
        east: STARTING_ROOM_SHADOW,
      },
    },
  });

  // Create Neon District zone and rooms
  console.log('Seeding Neon District...');

  const neonZone = await prisma.zone.upsert({
    where: { slug: 'neon-district' },
    update: {},
    create: {
      slug: 'neon-district',
      name: 'Neon District',
      securityRating: 'B',
    },
  });

  const neonBazaar = await prisma.room.upsert({
    where: { slug: 'neon-bazaar' },
    update: {
      gridX: 5,
      gridY: 5,
      exits: {
        south: 'shadow-gang-turf',
        east: 'neon-arms-dealer',
        west: 'neon-street-doc',
        north: 'corp-transit-hub',
      },
    },
    create: {
      slug: 'neon-bazaar',
      zoneId: neonZone.id,
      name: 'The Neon Bazaar',
      description: 'A busy open-air market strung with coloured lights and vendor stalls. The smell of grilled synth-meat and ozone fills the air.',
      securityRating: 'B',
      isPOI: true,
      poiCategory: 'HUB',
      gridX: 5,
      gridY: 5,
      exits: {
        south: 'shadow-gang-turf',
        east: 'neon-arms-dealer',
        west: 'neon-street-doc',
        north: 'corp-transit-hub',
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'neon-arms-dealer' },
    update: {
      gridX: 6,
      gridY: 5,
    },
    create: {
      slug: 'neon-arms-dealer',
      zoneId: neonZone.id,
      name: 'Iron Hand Armaments',
      description: 'Racks of legally-grey hardware fill every wall. The proprietor eyes each customer with quiet assessment.',
      securityRating: 'B',
      isPOI: true,
      poiCategory: 'SHOP',
      gridX: 6,
      gridY: 5,
      exits: {
        west: 'neon-bazaar',
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'neon-street-doc' },
    update: {
      gridX: 4,
      gridY: 5,
    },
    create: {
      slug: 'neon-street-doc',
      zoneId: neonZone.id,
      name: "Dr. Kira's Patchwork",
      description: 'A cramped but spotless clinic. Shelves of neatly labelled stims and trauma supplies line the walls behind a scarred counter.',
      securityRating: 'B',
      isPOI: true,
      poiCategory: 'SHOP',
      gridX: 4,
      gridY: 5,
      exits: {
        east: 'neon-bazaar',
      },
    },
  });

  console.log('Seeding Redmond Barrens...');

  const redmondZone = await prisma.zone.upsert({
    where: { slug: 'redmond-barrens' },
    update: {},
    create: {
      slug: 'redmond-barrens',
      name: 'Redmond Barrens',
      securityRating: 'Z',
    },
  });

  await prisma.room.upsert({
    where: { slug: 'redmond-tourist-grave' },
    update: {
      gridX: 5,
      gridY: 5,
      isSafeZone: false,
      exits: {
        north: 'redmond-razor-market',
        south: 'redmond-coffin-bar',
        east: 'redmond-scrapheap',
        west: 'redmond-derelict-warehouse',
      },
    },
    create: {
      slug: 'redmond-tourist-grave',
      zoneId: redmondZone.id,
      name: 'The Tourist Grave',
      description: 'An intersection of cracked asphalt littered with glass shards and rusted hulls of abandoned vehicles. Unshielded power grids hum overhead, casting sparks into the dirty puddles below. Gang members wearing leather jackets with glowing synth-strips sit on the hood of a burnt-out taxi, lazily watching the streets. The heavy smell of burnt rubber and chemical fires drifts from the south, under the persistent grey drizzle.',
      securityRating: 'Z',
      gridX: 5,
      gridY: 5,
      exits: {
        north: 'redmond-razor-market',
        south: 'redmond-coffin-bar',
        east: 'redmond-scrapheap',
        west: 'redmond-derelict-warehouse',
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'redmond-razor-market' },
    update: {
      isPOI: true,
      poiCategory: 'HUB',
      gridX: 5,
      gridY: 6,
      isSafeZone: true,
      exits: {
        south: 'redmond-tourist-grave',
        east: 'redmond-trunk-swap',
        west: 'redmond-shaman-shack',
        north: 'redmond-cable-junkie',
      },
    },
    create: {
      slug: 'redmond-razor-market',
      zoneId: redmondZone.id,
      name: 'The Neon Razor Market',
      description: 'Under the shadow of a partially collapsed highway overpass, a makeshift bazaar thrives behind barricades of scrap metal and razor wire. Heavily armed Neon Razor gang enforcers patrol the perimeter, keeping a tense peace and ensuring no unapproved violence occurs within the gate. Stalls constructed from rusted oil drums and corrugated iron display salvage and contraband. The smell of exhaust, hot copper, and cheap soy-noodles hangs thick in the air, creating a seedy oasis of commerce.',
      securityRating: 'Z',
      isPOI: true,
      poiCategory: 'HUB',
      isSafeZone: true,
      gridX: 5,
      gridY: 6,
      exits: {
        south: 'redmond-tourist-grave',
        east: 'redmond-trunk-swap',
        west: 'redmond-shaman-shack',
        north: 'redmond-cable-junkie',
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'redmond-trunk-swap' },
    update: {
      isPOI: true,
      poiCategory: 'SHOP',
      gridX: 6,
      gridY: 6,
      isSafeZone: true,
      exits: {
        west: 'redmond-razor-market',
      },
    },
    create: {
      slug: 'redmond-trunk-swap',
      zoneId: redmondZone.id,
      name: 'The Trunk Swap',
      description: 'A propped-open trunk of a dirty retro car in a dark alley displays pistols, makeshift firearms, and heavy combat vests laid out on oil-stained blankets. A dwarf vendor sits on a crate nearby, polishing a shotgun, while a gang sentinel stands watch at the mouth of the alley. The sharp smell of gun oil and gasoline is thick, mixed with the quiet hum of an electric space heater.',
      securityRating: 'Z',
      isPOI: true,
      poiCategory: 'SHOP',
      isSafeZone: true,
      gridX: 6,
      gridY: 6,
      exits: {
        west: 'redmond-razor-market',
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'redmond-shaman-shack' },
    update: {
      isPOI: true,
      poiCategory: 'SHOP',
      gridX: 4,
      gridY: 6,
      isSafeZone: true,
      exits: {
        east: 'redmond-razor-market',
      },
    },
    create: {
      slug: 'redmond-shaman-shack',
      zoneId: redmondZone.id,
      name: "The Shaman's Shack",
      description: 'Tucked between two crumbling brick tenements, a tarp-covered shack smells of burning sage and synthetic incense. Shelves made from scrap timber are loaded with jars of swamp-leech preserves, bone charms, and reagent bundles. Stuttered neon glyphs are painted on the doorway to ward off hostile spirits, while a silent gang guard sits on a stool outside with a shotgun across his lap.',
      securityRating: 'Z',
      isPOI: true,
      poiCategory: 'SHOP',
      isSafeZone: true,
      gridX: 4,
      gridY: 6,
      exits: {
        east: 'redmond-razor-market',
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'redmond-cable-junkie' },
    update: {
      isPOI: true,
      poiCategory: 'SHOP',
      gridX: 5,
      gridY: 7,
      isSafeZone: true,
      exits: {
        south: 'redmond-razor-market',
      },
    },
    create: {
      slug: 'redmond-cable-junkie',
      zoneId: redmondZone.id,
      name: 'The Cable Junkie',
      description: 'This shop is little more than a windowless metal shipping container welded onto the chassis of a flatbed truck. Bundles of salvaged fiber-optic cables hang from the ceiling like creepers, lit by the green glow of retrofitted monitors showing active matrix diagnostics. Cyberdecks with exposed motherboard circuitry and custom cooling tubes sit on a workbench, alongside stacks of cracked optical drives. A gang-hired decker monitors the door from behind a barrier of unshielded servers, ensuring transactions remain undisturbed.',
      securityRating: 'Z',
      isPOI: true,
      poiCategory: 'SHOP',
      isSafeZone: true,
      gridX: 5,
      gridY: 7,
      exits: {
        south: 'redmond-razor-market',
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'redmond-coffin-bar' },
    update: {
      isPOI: true,
      poiCategory: 'BAR',
      gridX: 5,
      gridY: 4,
      isSafeZone: true,
      exits: {
        north: 'redmond-tourist-grave',
        south: 'redmond-collapsed-court',
      },
    },
    create: {
      slug: 'redmond-coffin-bar',
      zoneId: redmondZone.id,
      name: 'The Coffin Bar',
      description: 'Built entirely from stacked metal shipping containers, this seedy dive bar offers a quiet escape from the lawless sprawl. Low-frequency synth-bass vibrates through the metal floor, and the only light comes from a rusted beer sign and the neon blue liquid in dirty glasses. Patrons sit in booths made of hollowed-out cargo crates, talking in low whispers while the bartender cleans glasses with a dirty rag. Outside, gang enforcers stand by the heavy steel door, keeping the local violence far from the bar\'s threshold.',
      securityRating: 'Z',
      isPOI: true,
      poiCategory: 'BAR',
      isSafeZone: true,
      gridX: 5,
      gridY: 4,
      exits: {
        north: 'redmond-tourist-grave',
        south: 'redmond-collapsed-court',
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'redmond-collapsed-court' },
    update: {
      gridX: 5,
      gridY: 3,
      isSafeZone: false,
      exits: {
        north: 'redmond-coffin-bar',
      },
    },
    create: {
      slug: 'redmond-collapsed-court',
      zoneId: redmondZone.id,
      name: 'The Collapsed Courthouse',
      description: 'The imposing facade of a municipal courthouse has crumbled, leaving a pile of concrete slabs and twisted rebar blocking the lobby entrance. Inside, decaying filing cabinets stand open, their waterlogged tax forms and criminal records forming a rotting carpet on the floor. Faint magical residue still clings to the shattered seals on the vault door in the rear, whispering of forgotten secrets.',
      securityRating: 'Z',
      gridX: 5,
      gridY: 3,
      exits: {
        north: 'redmond-coffin-bar',
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'redmond-derelict-warehouse' },
    update: {
      gridX: 4,
      gridY: 5,
      isSafeZone: false,
      exits: {
        east: 'redmond-tourist-grave',
        west: 'redmond-ruined-mall',
      },
    },
    create: {
      slug: 'redmond-derelict-warehouse',
      zoneId: redmondZone.id,
      name: 'Derelict Shipping Warehouse',
      description: 'A cavernous, shadow-choked warehouse with a partially collapsed roof allowing toxic rain to puddle on the cracked concrete floor. Rusted steel shelves are tipped over, spilling rotting packing crates and bundles of dead copper wires. Dust motes dance in the flickering blue light of a broken security camera, and scratching sounds behind the debris suggest local fauna—or desperate scavengers—lurking in the darkness.',
      securityRating: 'Z',
      gridX: 4,
      gridY: 5,
      exits: {
        east: 'redmond-tourist-grave',
        west: 'redmond-ruined-mall',
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'redmond-ruined-mall' },
    update: {
      gridX: 3,
      gridY: 5,
      isSafeZone: false,
      exits: {
        east: 'redmond-derelict-warehouse',
      },
    },
    create: {
      slug: 'redmond-ruined-mall',
      zoneId: redmondZone.id,
      name: 'The Shattered Mall',
      description: 'The shattered dome of the mall skylight exposes the dead escalators and overgrown planters to the grey sky. Once-vibrant retail facades are now gutted shells, spray-painted with gang markers and corporate slogans. Shadows move behind cracked display windows, and the faint, echoing sound of dripping water is occasionally broken by the low chatter of scavengers or security drones on patrol.',
      securityRating: 'Z',
      gridX: 3,
      gridY: 5,
      exits: {
        east: 'redmond-derelict-warehouse',
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'redmond-scrapheap' },
    update: {
      gridX: 6,
      gridY: 5,
      isSafeZone: false,
      exits: {
        west: 'redmond-tourist-grave',
        east: 'shadow-gang-turf',
      },
    },
    create: {
      slug: 'redmond-scrapheap',
      zoneId: redmondZone.id,
      name: 'The Scrapheap',
      description: 'A vast, unsecured field of crushed cars, industrial slag, and rusted sheet metal stretching as far as the eye can see. There are no gang sentries or corporate security forces here, leaving the area entirely lawless and vulnerable to predators. Opt-in combat warnings trigger on AR HUDs as the ambient matrix signal drops to a faint, crackling hiss. The smell of burning rubber and chemical runoff rises from a stagnant pond, reflecting the dark, toxic clouds above.',
      securityRating: 'Z',
      gridX: 6,
      gridY: 5,
      exits: {
        west: 'redmond-tourist-grave',
        east: 'shadow-gang-turf',
      },
    },
  });

  // Connect shadow-gang-turf north to the bazaar and west to Redmond
  await prisma.room.update({
    where: { slug: 'shadow-gang-turf' },
    data: {
      exits: {
        east: STARTING_ROOM_SHADOW,
        north: 'neon-bazaar',
        west: 'redmond-scrapheap',
      },
    },
  });


  console.log('Seeding Matrix items...');
  
  // Cyberdecks
  await prisma.item.upsert({
    where: { slug: 'sony-c-series' },
    update: {},
    create: {
      slug: 'sony-c-series',
      name: 'Sony C-Series Deck',
      description: 'A reliable entry-level cyberdeck used by street deckers.',
      type: 'DECK',
      stats: { attack: 2, sleaze: 3, dataProc: 2, firewall: 2 }
    }
  });

  await prisma.item.upsert({
    where: { slug: 'fairlight-excalibur' },
    update: {},
    create: {
      slug: 'fairlight-excalibur',
      name: 'Fairlight Excalibur',
      description: 'The pinnacle of neural decking technology.',
      type: 'DECK',
      rarity: 'legendary',
      stats: { attack: 7, sleaze: 7, dataProc: 8, firewall: 9 }
    }
  });

  // Programs
  await prisma.item.upsert({
    where: { slug: 'prog-armor' },
    update: {},
    create: {
      slug: 'prog-armor',
      name: 'Armor Program',
      description: 'Strengthens your firewall against neural damage.',
      type: 'PROGRAM',
      stats: { bonusFirewall: 2 }
    }
  });

  console.log('Seeding Matrix nodes and ICE...');

  // Matrix Nodes
  const publicNode = await prisma.matrixNode.upsert({
    where: { slug: 'public-info-kiosk' },
    update: {},
    create: {
      slug: 'public-info-kiosk',
      name: 'Public Information Kiosk',
      description: 'A low-security node for local news and weather.',
      securityLevel: 2,
      hostType: 'public',
      roomId: corpCenter.id
    }
  });

  const corpNode = await prisma.matrixNode.upsert({
    where: { slug: 'mitsuhama-exec-host' },
    update: {},
    create: {
      slug: 'mitsuhama-exec-host',
      name: 'Mitsuhama Executive Host',
      description: 'A high-security corporate host protecting sensitive financial data.',
      securityLevel: 8,
      hostType: 'corporate',
      roomId: (await prisma.room.findUnique({ where: { slug: 'corp-executive-offices' } }))!.id
    }
  });

  // ICE for Corp Node
  await prisma.intCountermeasure.create({
    data: {
      slug: 'killer-ice-01',
      name: 'Killer ICE',
      type: 'BLACK',
      nodeId: corpNode.id,
      hp: 50,
      currentHp: 50,
      attack: 12,
      defense: 8
    }
  });

  await prisma.intCountermeasure.create({
    data: {
      slug: 'blaster-ice-01',
      name: 'Blaster ICE',
      type: 'GRAY',
      nodeId: corpNode.id,
      hp: 30,
      currentHp: 30,
      attack: 8,
      defense: 6
    }
  });

  // Reagents
  await prisma.item.upsert({
    where: { slug: 'reagents' },
    update: {},
    create: {
      slug: 'reagents',
      name: 'Magical Reagents',
      description: 'Used as a buffer for spellcasting to prevent neural strain.',
      type: 'CONSUMABLE',
      rarity: 'common',
      slots: 1
    }
  });

  // Medical Supplies
  await prisma.item.upsert({
    where: { slug: 'medical-supplies' },
    update: {},
    create: {
      slug: 'medical-supplies',
      name: 'Medical Supplies',
      description: 'Standard medical components for treating wounds and neural strain.',
      type: 'CONSUMABLE',
      rarity: 'common',
      slots: 1
    }
  });

  await prisma.item.upsert({
    where: { slug: 'trauma-kit' },
    update: {},
    create: {
      slug: 'trauma-kit',
      name: 'DocWagon Trauma Kit',
      description: 'Bulky life-saving equipment capable of clearing death sickness.',
      type: 'CONSUMABLE',
      rarity: 'rare',
      slots: 3
    }
  });

  await prisma.item.upsert({
    where: { slug: 'combat-stim' },
    update: {},
    create: {
      slug: 'combat-stim',
      name: 'Adrenaline Boost Stim',
      description: 'Suppresses stat penalties from death sickness temporarily. Causes a severe crash later.',
      type: 'CONSUMABLE',
      rarity: 'uncommon',
      slots: 1
    }
  });

  await prisma.item.upsert({
    where: { slug: 'truth-serum' },
    update: {},
    create: {
      slug: 'truth-serum',
      name: 'Veritas Serum',
      description: 'Loosens the lips of even the most stubborn corporate stooges.',
      type: 'CONSUMABLE',
      rarity: 'rare',
      slots: 1
    }
  });

  // Specialized Weapons
  await prisma.item.upsert({
    where: { slug: 'dart-pistol' },
    update: {},
    create: {
      slug: 'dart-pistol',
      name: 'Dart-X Paralyzer',
      description: 'A non-lethal sidearm used for subdual and interrogation prep.',
      type: 'WEAPON',
      rarity: 'uncommon',
      slots: 1,
      equipSlot: 'HAND_1',
      stats: { damage: 2, stunModifier: 8 }
    }
  });

  await prisma.item.upsert({
    where: { slug: 'triage-token' },
    update: {},
    create: {
      slug: 'triage-token',
      name: 'Triage Token',
      description: 'Emergency rescue beacon. Summons a DocWagon team to extract you to safety.',
      type: 'CONSUMABLE',
      rarity: 'legendary',
      slots: 1
    }
  });

  // Cleanup Items
  await prisma.item.upsert({
    where: { slug: 'c-squared' },
    update: {},
    create: {
      slug: 'c-squared',
      name: 'C-Squared Cleaning Agent',
      description: 'High-grade bleach and enzymatic cleaner to remove all biological traces from a room.',
      type: 'CONSUMABLE',
      rarity: 'common',
      slots: 1
    }
  });

  await prisma.item.upsert({
    where: { slug: 'body-bag' },
    update: {},
    create: {
      slug: 'body-bag',
      name: 'Reinforced Body Bag',
      description: 'Standard issue containment for concealing the aftermath of a lethal encounter.',
      type: 'CONSUMABLE',
      rarity: 'common',
      slots: 1
    }
  });

  // Neon District items
  await prisma.item.upsert({
    where: { slug: 'ares-predator' },
    update: {},
    create: {
      slug: 'ares-predator',
      name: 'Ares Predator IV',
      description: 'The shadowrunner\'s sidearm of choice. Reliable, concealable, and hits hard.',
      type: 'WEAPON',
      rarity: 'common',
      slots: 1,
      equipSlot: 'HAND_1',
      stats: { damage: 8, stunModifier: 0 },
    },
  });

  await prisma.item.upsert({
    where: { slug: 'armored-jacket' },
    update: {},
    create: {
      slug: 'armored-jacket',
      name: 'Armored Jacket',
      description: 'A heavy synthetic-weave jacket with trauma plates sewn in. Standard issue for anyone who expects trouble.',
      type: 'ARMOR',
      rarity: 'common',
      slots: 1,
      equipSlot: 'BODY',
      stats: { armorBonus: 4 },
    },
  });

  await prisma.item.upsert({
    where: { slug: 'stim-patch' },
    update: {},
    create: {
      slug: 'stim-patch',
      name: 'Stimulant Patch',
      description: 'A fast-acting dermal patch that clears fatigue and minor stun. Short duration.',
      type: 'CONSUMABLE',
      rarity: 'common',
      slots: 1,
    },
  });

  await prisma.item.upsert({
    where: { slug: 'nano-bandage' },
    update: {},
    create: {
      slug: 'nano-bandage',
      name: 'NanoBandage',
      description: 'Self-applying nano-agent wrap. Seals wounds and begins clotting within seconds.',
      type: 'CONSUMABLE',
      rarity: 'uncommon',
      slots: 1,
    },
  });

  console.log('Seeding Spells and Adept Powers...');

  // Spells
  await prisma.spell.upsert({
    where: { slug: 'mana-blast' },
    update: {},
    create: {
      slug: 'mana-blast',
      name: 'Mana Blast',
      type: 'COMBAT',
      tradition: 'ANY',
      apCost: 2,
      manaCost: 15,
      description: 'A direct bolt of mana that bypasses physical armor.'
    }
  });

  await prisma.spell.upsert({
    where: { slug: 'haste' },
    update: {},
    create: {
      slug: 'haste',
      name: 'Haste',
      type: 'UTILITY',
      tradition: 'ANY',
      apCost: 3,
      manaCost: 40,
      description: 'Accelerates neural pathways, granting +2 AP to the target.'
    }
  });

  // Adept Powers
  await prisma.adeptPower.upsert({
    where: { slug: 'rockskin-aura' },
    update: {},
    create: {
      slug: 'rockskin-aura',
      name: 'Rockskin Aura',
      type: 'AURA',
      apCost: 1,
      manaCost: 0,
      description: 'Sustains a protective aura that increases team armor.'
    }
  });

  await prisma.adeptPower.upsert({
    where: { slug: 'killing-hands' },
    update: {},
    create: {
      slug: 'killing-hands',
      name: 'Killing Hands',
      type: 'SELF',
      apCost: 0,
      manaCost: 0,
      description: 'Passive: Unarmed attacks deal lethal physical damage.'
    }
  });

  console.log('Seeding Mission Templates...');

  await prisma.missionTemplate.upsert({
    where: { slug: 'prototype-retrieval' },
    update: {},
    create: {
      slug: 'prototype-retrieval',
      name: 'Prototype Retrieval',
      type: 'RETRIEVAL',
      description: 'Infiltrate the lab and retrieve the experimental neural link.',
      baseDifficulty: 2,
      basePayout: 2500,
      requiredClasses: []
    }
  });

  await prisma.missionTemplate.upsert({
    where: { slug: 'corporate-sabotage' },
    update: {},
    create: {
      slug: 'corporate-sabotage',
      name: 'Network Sabotage',
      type: 'MATRIX',
      description: 'Hack into the Mitsuhama grid and delete their financial quarterly projections.',
      baseDifficulty: 3,
      basePayout: 4000,
      requiredClasses: ['decker']
    }
  });

  console.log('Seeding Mob templates...');

  await prisma.mobTemplate.upsert({
    where: { slug: 'security-guard' },
    update: {},
    create: {
      slug: 'security-guard',
      name: 'Corporate Security Guard',
      level: 5,
      body: 6, agility: 5, dexterity: 5, strength: 6, logic: 4, intuition: 4, willpower: 5, charisma: 4,
      maxHp: 80, maxAp: 6, armorValue: 5,
      masteryCQC: 4, masteryPistol: 4, masteryRifle: 0, masteryAutomatic: 0
    }
  });

  await prisma.mobTemplate.upsert({
    where: { slug: 'combat-drone' },
    update: {},
    create: {
      slug: 'combat-drone',
      name: 'Mitsuhama Hunter-Seeker Drone',
      level: 8,
      body: 4, agility: 8, dexterity: 8, strength: 2, logic: 8, intuition: 8, willpower: 10, charisma: 1,
      maxHp: 50, maxAp: 8, armorValue: 10,
      masteryCQC: 0, masteryPistol: 0, masteryRifle: 0, masteryAutomatic: 8
    }
  });

  console.log('Seeding Shop Inventories...');

  const blackMarket = await prisma.room.findUnique({ where: { slug: 'shadow-black-market' } });
  if (blackMarket) {
    const shopItems = [
      { slug: 'sony-c-series', price: 500 },
      { slug: 'prog-armor', price: 150 },
      { slug: 'medical-supplies', price: 50 },
      { slug: 'reagents', price: 25 },
      { slug: 'dart-pistol', price: 300 },
    ];

    for (const itemData of shopItems) {
      const item = await prisma.item.findUnique({ where: { slug: itemData.slug } });
      if (item) {
        await prisma.shopItem.upsert({
          where: { roomId_itemId: { roomId: blackMarket.id, itemId: item.id } },
          update: { price: itemData.price },
          create: {
            roomId: blackMarket.id,
            itemId: item.id,
            price: itemData.price,
            stock: -1 // Infinite stock for common items
          }
        });
      }
    }
  }

  // Iron Hand Armaments inventory
  const armsShop = await prisma.room.findUnique({ where: { slug: 'neon-arms-dealer' } });
  if (armsShop) {
    const armsItems = [
      { slug: 'ares-predator', price: 400 },
      { slug: 'armored-jacket', price: 500 },
      { slug: 'medical-supplies', price: 80 },
      { slug: 'body-bag', price: 40 },
      { slug: 'c-squared', price: 35 },
    ];
    for (const itemData of armsItems) {
      const item = await prisma.item.findUnique({ where: { slug: itemData.slug } });
      if (item) {
        await prisma.shopItem.upsert({
          where: { roomId_itemId: { roomId: armsShop.id, itemId: item.id } },
          update: { price: itemData.price },
          create: { roomId: armsShop.id, itemId: item.id, price: itemData.price, stock: -1 },
        });
      }
    }
  }

  // Dr. Kira's Patchwork inventory
  const streetDoc = await prisma.room.findUnique({ where: { slug: 'neon-street-doc' } });
  if (streetDoc) {
    const docItems = [
      { slug: 'stim-patch', price: 20 },
      { slug: 'nano-bandage', price: 75 },
      { slug: 'medical-supplies', price: 50 },
      { slug: 'trauma-kit', price: 750 },
      { slug: 'combat-stim', price: 150 },
    ];
    for (const itemData of docItems) {
      const item = await prisma.item.findUnique({ where: { slug: itemData.slug } });
      if (item) {
        await prisma.shopItem.upsert({
          where: { roomId_itemId: { roomId: streetDoc.id, itemId: item.id } },
          update: { price: itemData.price },
          create: { roomId: streetDoc.id, itemId: item.id, price: itemData.price, stock: -1 },
        });
      }
    }
  }

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
