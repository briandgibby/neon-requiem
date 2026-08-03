export interface CharacterUpdate {
  currentHp?: number;
  maxHp?: number;
  currentAp?: number;
  maxAp?: number;
}

export interface CharacterUpdatePublisher {
  publish(characterId: string, update: CharacterUpdate): void;
}
