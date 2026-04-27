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
    update: {},
    create: {
      slug: STARTING_ROOM_CORP,
      zoneId: corpZone.id,
      name: 'Arcology Main Plaza',
      description: 'A vast, sterile plaza with gleaming chrome surfaces and holographic advertisements for Mitsuhama and Renraku.',
      securityRating: 'AAA',
      exits: {
        north: 'corp-executive-offices',
        south: 'corp-transit-hub',
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'corp-executive-offices' },
    update: {},
    create: {
      slug: 'corp-executive-offices',
      zoneId: corpZone.id,
      name: 'Executive Office Wing',
      description: 'High-security offices for the corporate elite. The air is filtered and smells faintly of expensive cologne.',
      securityRating: 'AAA',
      baseDisposition: 'SUSPICIOUS',
      exits: {
        south: STARTING_ROOM_CORP,
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'corp-transit-hub' },
    update: {},
    create: {
      slug: 'corp-transit-hub',
      zoneId: corpZone.id,
      name: 'Transit Terminal',
      description: 'The main hub for mag-lev trains connecting the arcology to the rest of the city.',
      securityRating: 'AA',
      baseDisposition: 'NEUTRAL',
      exits: {
        north: STARTING_ROOM_CORP,
      },
    },
  });

  // Create Rooms for Shadow Hub
  const shadowCenter = await prisma.room.upsert({
    where: { slug: STARTING_ROOM_SHADOW },
    update: {},
    create: {
      slug: STARTING_ROOM_SHADOW,
      zoneId: shadowZone.id,
      name: 'The Pit',
      description: 'A dark, crowded intersection in the heart of the Undermarket. Neon signs flicker and the smell of soy-burgers and rain fills the air.',
      securityRating: 'C',
      exits: {
        east: 'shadow-black-market',
        west: 'shadow-gang-turf',
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'shadow-black-market' },
    update: {},
    create: {
      slug: 'shadow-black-market',
      zoneId: shadowZone.id,
      name: 'Black Market Alley',
      description: 'A narrow alleyway lined with vendors selling everything from illegal cyberdecks to street-grade stimulants.',
      securityRating: 'D',
      exits: {
        west: STARTING_ROOM_SHADOW,
      },
    },
  });

  await prisma.room.upsert({
    where: { slug: 'shadow-gang-turf' },
    update: {},
    create: {
      slug: 'shadow-gang-turf',
      zoneId: shadowZone.id,
      name: 'Graffiti-Scrawled Courtyard',
      description: 'A courtyard claimed by the local Neon Razors gang. Watch your step.',
      securityRating: 'D',
      exits: {
        east: STARTING_ROOM_SHADOW,
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
