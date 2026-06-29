// Real clubs + REAL current squads, fetched at build time (Wikipedia "2026–27
// <club> season" pages; Man United fell back to its 2025–26 page because the
// 2026–27 squad table isn't populated yet). Kit colours are documented official
// hex (teamcolorcodes.com was unreachable, so sourced from Wikipedia/Wikimedia —
// not invented). Crests are from github.com/luukhopman/football-logos.
//
// NOTE: these are REAL clubs/players but every MATCH is SIMULATED — see season.ts.

import type { Club, Player } from './types.ts';

/** The date the squads were snapshotted (surfaced in the UI + README). */
export const SQUAD_SNAPSHOT_DATE = '2026-06-29';

export const clubs: Club[] = [
  {
    id: 'RMA',
    name: 'Real Madrid',
    shortCode: 'RMA',
    primaryColor: '#FFFFFF',
    secondaryColor: '#00215F',
    crest: 'crests/RMA.png',
  },
  {
    id: 'FCB',
    name: 'FC Barcelona',
    shortCode: 'FCB',
    primaryColor: '#00529F',
    secondaryColor: '#A2214B',
    crest: 'crests/FCB.png',
  },
  {
    id: 'MUN',
    name: 'Manchester United',
    shortCode: 'MUN',
    primaryColor: '#DA291C',
    secondaryColor: '#003366',
    crest: 'crests/MUN.png',
  },
  {
    id: 'BAY',
    name: 'Bayern Munich',
    shortCode: 'BAY',
    primaryColor: '#DA291C', // same red as MUN — crest + secondary keep them apart
    secondaryColor: '#FFFFFF',
    crest: 'crests/BAY.png',
  },
];

// Current first-team squads (~11 each). Fetched at build time; uncertain players
// were dropped rather than invented.
export const players: Player[] = [
  // Real Madrid — 2026–27 season page
  { id: 'RMA-1', name: 'Thibaut Courtois', clubId: 'RMA', position: 'GK' },
  { id: 'RMA-2', name: 'Andriy Lunin', clubId: 'RMA', position: 'GK' },
  { id: 'RMA-3', name: 'Éder Militão', clubId: 'RMA', position: 'DF' },
  { id: 'RMA-4', name: 'Antonio Rüdiger', clubId: 'RMA', position: 'DF' },
  { id: 'RMA-5', name: 'Ferland Mendy', clubId: 'RMA', position: 'DF' },
  { id: 'RMA-6', name: 'Trent Alexander-Arnold', clubId: 'RMA', position: 'DF' },
  { id: 'RMA-7', name: 'Jude Bellingham', clubId: 'RMA', position: 'MF' },
  { id: 'RMA-8', name: 'Federico Valverde', clubId: 'RMA', position: 'MF' },
  { id: 'RMA-9', name: 'Vinícius Júnior', clubId: 'RMA', position: 'FW' },
  { id: 'RMA-10', name: 'Kylian Mbappé', clubId: 'RMA', position: 'FW' },
  { id: 'RMA-11', name: 'Rodrygo', clubId: 'RMA', position: 'FW' },

  // FC Barcelona — 2026–27 season page
  { id: 'FCB-1', name: 'Joan García', clubId: 'FCB', position: 'GK' },
  { id: 'FCB-2', name: 'Ronald Araújo', clubId: 'FCB', position: 'DF' },
  { id: 'FCB-3', name: 'Jules Koundé', clubId: 'FCB', position: 'DF' },
  { id: 'FCB-4', name: 'Pau Cubarsí', clubId: 'FCB', position: 'DF' },
  { id: 'FCB-5', name: 'Alejandro Balde', clubId: 'FCB', position: 'DF' },
  { id: 'FCB-6', name: 'Frenkie de Jong', clubId: 'FCB', position: 'MF' },
  { id: 'FCB-7', name: 'Pedri', clubId: 'FCB', position: 'MF' },
  { id: 'FCB-8', name: 'Gavi', clubId: 'FCB', position: 'MF' },
  { id: 'FCB-9', name: 'Lamine Yamal', clubId: 'FCB', position: 'FW' },
  { id: 'FCB-10', name: 'Raphinha', clubId: 'FCB', position: 'FW' },
  { id: 'FCB-11', name: 'Ferran Torres', clubId: 'FCB', position: 'FW' },

  // Manchester United — fallback: 2025–26 season page (2026–27 squad not yet populated)
  { id: 'MUN-1', name: 'André Onana', clubId: 'MUN', position: 'GK' },
  { id: 'MUN-2', name: 'Diogo Dalot', clubId: 'MUN', position: 'DF' },
  { id: 'MUN-3', name: 'Matthijs de Ligt', clubId: 'MUN', position: 'DF' },
  { id: 'MUN-4', name: 'Harry Maguire', clubId: 'MUN', position: 'DF' },
  { id: 'MUN-5', name: 'Lisandro Martínez', clubId: 'MUN', position: 'DF' },
  { id: 'MUN-6', name: 'Luke Shaw', clubId: 'MUN', position: 'DF' },
  { id: 'MUN-7', name: 'Bruno Fernandes', clubId: 'MUN', position: 'MF' },
  { id: 'MUN-8', name: 'Kobbie Mainoo', clubId: 'MUN', position: 'MF' },
  { id: 'MUN-9', name: 'Manuel Ugarte', clubId: 'MUN', position: 'MF' },
  { id: 'MUN-10', name: 'Benjamin Šeško', clubId: 'MUN', position: 'FW' },
  { id: 'MUN-11', name: 'Joshua Zirkzee', clubId: 'MUN', position: 'FW' },

  // Bayern Munich — 2026–27 season page
  { id: 'BAY-1', name: 'Manuel Neuer', clubId: 'BAY', position: 'GK' },
  { id: 'BAY-2', name: 'Sven Ulreich', clubId: 'BAY', position: 'GK' },
  { id: 'BAY-3', name: 'Dayot Upamecano', clubId: 'BAY', position: 'DF' },
  { id: 'BAY-4', name: 'Kim Min-jae', clubId: 'BAY', position: 'DF' },
  { id: 'BAY-5', name: 'Jonathan Tah', clubId: 'BAY', position: 'DF' },
  { id: 'BAY-6', name: 'Alphonso Davies', clubId: 'BAY', position: 'DF' },
  { id: 'BAY-7', name: 'Joshua Kimmich', clubId: 'BAY', position: 'MF' },
  { id: 'BAY-8', name: 'Jamal Musiala', clubId: 'BAY', position: 'MF' },
  { id: 'BAY-9', name: 'Harry Kane', clubId: 'BAY', position: 'FW' },
  { id: 'BAY-10', name: 'Serge Gnabry', clubId: 'BAY', position: 'FW' },
  { id: 'BAY-11', name: 'Luis Díaz', clubId: 'BAY', position: 'FW' },
];
