export interface RoomEvent {
  text: string;
  type: 'info' | 'combat';
}

export interface RoomEventPublisher {
  publish(roomId: string, event: RoomEvent): void;
}
