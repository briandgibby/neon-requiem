import { EcsRegistry } from '../registry';
import { Tickable } from '../../heartbeat';
import { ComponentTypes, MatrixNodeComponent, IceComponent, DeckerComponent, HealthComponent, StunComponent } from '../components';

export class IceAiSystem implements Tickable {
  readonly name = 'ecs_ice_ai_system';
  readonly frequency = 3; // ICE attacks every 3 ticks

  constructor(private readonly registry: EcsRegistry) {}

  async onTick(_tickCount: number): Promise<void> {
    const nodeIds = this.registry.getEntitiesWith([ComponentTypes.MatrixNode]);
    
    // Build a map of active nodes and their deckers
    const deckersByNode = new Map<string, string[]>();
    const deckerIds = this.registry.getEntitiesWith([ComponentTypes.Decker]);
    for (const deckerId of deckerIds) {
      const decker = this.registry.getComponent<DeckerComponent>(deckerId, ComponentTypes.Decker);
      if (decker) {
        if (!deckersByNode.has(decker.activeNodeEntityId)) {
          deckersByNode.set(decker.activeNodeEntityId, []);
        }
        deckersByNode.get(decker.activeNodeEntityId)!.push(deckerId);
      }
    }

    const iceIds = this.registry.getEntitiesWith([ComponentTypes.Ice, ComponentTypes.Position]);

    for (const iceId of iceIds) {
       const ice = this.registry.getComponent<IceComponent>(iceId, ComponentTypes.Ice);
       // We use Position component to store the Node ID the ICE belongs to, or we could add a nodeEntityId to IceComponent. Let's assume Position.roomId = NodeEntityId for Matrix.
       const pos = this.registry.getComponent<any>(iceId, ComponentTypes.Position);
       const health = this.registry.getComponent<HealthComponent>(iceId, ComponentTypes.Health);
       
       if (!ice || !pos || !health || health.current <= 0) continue;

       const nodeId = pos.roomId;
       const node = this.registry.getComponent<MatrixNodeComponent>(nodeId, ComponentTypes.MatrixNode);

       // ICE only attacks if the node is at RED alert
       if (node && node.alertLevel === 'RED') {
          const deckersInNode = deckersByNode.get(nodeId) || [];
          if (deckersInNode.length > 0) {
             const targetDeckerId = deckersInNode[Math.floor(Math.random() * deckersInNode.length)];
             await this.executeIceAttack(ice, targetDeckerId);
          }
       }
    }
  }

  private async executeIceAttack(ice: IceComponent, targetDeckerId: string) {
    const decker = this.registry.getComponent<DeckerComponent>(targetDeckerId, ComponentTypes.Decker);
    const health = this.registry.getComponent<HealthComponent>(targetDeckerId, ComponentTypes.Health);
    const stun = this.registry.getComponent<StunComponent>(targetDeckerId, ComponentTypes.Stun);

    if (!decker || !health || !stun) return;

    const iceRoll = ice.attack + Math.floor(Math.random() * 10) + 1;
    let damage = Math.max(2, iceRoll - 5);
    
    if (ice.type === 'BLACK') {
       // Biofeedback Resistance: Hardcoded body/willpower approximation for now, or we fetch AttributesComponent
       const attrs = this.registry.getComponent<any>(targetDeckerId, ComponentTypes.Attributes);
       const bodyWill = attrs ? attrs.body + attrs.willpower : 6;
       const physResistRoll = bodyWill + decker.biofeedbackBuffer + Math.floor(Math.random() * 10) + 1;
       
       const resisted = physResistRoll >= iceRoll;
       if (!resisted) {
          const actualDamage = Math.max(5, iceRoll - physResistRoll);
          health.current = Math.max(0, health.current - actualDamage);
       }
    } else {
       // Neural/Program Resistance: Hardcoded logic approximation for now
       const attrs = this.registry.getComponent<any>(targetDeckerId, ComponentTypes.Attributes);
       const logic = attrs ? attrs.logic : 3;
       const neuralResistRoll = logic + decker.firewall + Math.floor(Math.random() * 10) + 1;
       
       const resisted = neuralResistRoll >= iceRoll;
       if (!resisted) {
          const actualDamage = Math.max(2, iceRoll - neuralResistRoll);
          if (ice.type === 'WHITE' || ice.type === 'GRAY') {
              stun.current = Math.max(0, stun.current - actualDamage);
          }
       }
    }
  }
}
