import { MissionGenerator } from '../../src/domains/mission/mission.generator';

describe('MissionGenerator', () => {
  const gen = new MissionGenerator();

  it('generates nodeTargetData for MATRIX-type missions', () => {
    const template = { id: 'tmpl-1', type: 'MATRIX', baseDifficulty: 2, name: 'Corp Breach' } as any;
    const result = gen.generate(template, 'seed-matrix-1', ['decker']);

    expect(result.nodeTargetData).toBeDefined();
    expect(result.nodeTargetData.length).toBeGreaterThan(0);
    expect(result.nodeTargetData[0]).toMatchObject({
      roomSlug: expect.any(String),
      objectiveIndex: expect.any(Number),
      hackThreshold: 4, // 2 + baseDifficulty(2)
    });
  });

  it('generates a HACK_NODE objective for MATRIX missions', () => {
    const template = { id: 'tmpl-1', type: 'MATRIX', baseDifficulty: 1, name: 'Breach' } as any;
    const result = gen.generate(template, 'seed-matrix-2', ['decker']);

    const hackObjective = result.objectives.find(o => o.type === 'HACK_NODE');
    expect(hackObjective).toBeDefined();
    expect(hackObjective?.isMandatory).toBe(true);
    expect(hackObjective?.isCompleted).toBe(false);
  });

  it('nodeTargetData objectiveIndex points to the HACK_NODE objective', () => {
    const template = { id: 'tmpl-1', type: 'MATRIX', baseDifficulty: 2, name: 'Corp Breach' } as any;
    const result = gen.generate(template, 'seed-matrix-3', ['decker']);

    for (const nodeTarget of result.nodeTargetData) {
      const obj = result.objectives[nodeTarget.objectiveIndex];
      expect(obj).toBeDefined();
      expect(obj.type).toBe('HACK_NODE');
    }
  });

  it('non-MATRIX missions produce an empty nodeTargetData array', () => {
    const template = { id: 'tmpl-2', type: 'ASSASSINATION', baseDifficulty: 1, name: 'Hit' } as any;
    const result = gen.generate(template, 'seed-assn', []);

    expect(result.nodeTargetData).toEqual([]);
  });
});
