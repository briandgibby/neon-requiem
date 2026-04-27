import { PRNG } from '../../shared/utils/prng';
import { MissionTemplateRecord, MissionInstanceData, MissionObjective } from './mission.types';

export class MissionGenerator {
  /**
   * Generates a deterministic mission instance based on a seed.
   */
  generate(template: MissionTemplateRecord, seed: string, partyComposition: string[]): MissionInstanceData {
    const rng = new PRNG(seed);
    const layout: string[] = [];
    const objectives: MissionObjective[] = [];
    const spawnData: any[] = [];

    // 1. Determine Zone/Difficulty
    const difficulty = template.baseDifficulty;
    
    // 2. Mock layout generation (In a real system, this would pull from available Room pools)
    const roomPool = ['office-a', 'office-b', 'server-room', 'vault', 'corridor-1', 'corridor-2'];
    const numRooms = 3 + rng.nextInt(0, difficulty * 2);
    
    for (let i = 0; i < numRooms; i++) {
      layout.push(rng.pick(roomPool));
    }

    // 3. Generate Objectives based on Template Type
    if (template.type === 'RETRIEVAL') {
      const targetRoom = rng.pick(layout);
      objectives.push({
        type: 'STEAL_ITEM',
        description: `Retrieve the stolen prototype from ${targetRoom}`,
        isMandatory: true,
        isCompleted: false,
        targetRoomSlug: targetRoom
      });
    } else if (template.type === 'SABOTAGE') {
      const targetRoom = layout[layout.length - 1]; // End of the path
      objectives.push({
        type: 'PLANT_EXPLOSIVE',
        description: `Sabotage the mainframe in ${targetRoom}`,
        isMandatory: true,
        isCompleted: false,
        targetRoomSlug: targetRoom
      });
    }

    // 4. Handle Party Composition (Dynamic Pathing)
    const hasDecker = partyComposition.includes('decker') || partyComposition.includes('technomancer');
    if (!hasDecker && template.type === 'MATRIX') {
      // Add a physical override or warn
      objectives.push({
        type: 'PHYSICAL_OVERRIDE',
        description: 'Locate the physical terminal override since no decker is present.',
        isMandatory: true,
        isCompleted: false
      });
    }

    // 5. Pre-flight Validation (Placeholder)
    this.validateSolvability(layout, objectives);

    return {
      layout,
      objectives,
      spawnData
    };
  }

  private validateSolvability(layout: string[], objectives: MissionObjective[]) {
    // A* Pathfinding check would go here to ensure all targetRoomSlugs are reachable
    return true;
  }
}
