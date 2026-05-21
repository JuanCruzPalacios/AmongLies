export interface ChatMessage {
  id: string;
  playerId: string;
  playerNickname: string;
  playerAvatarId: string;
  message: string;
  timestamp: number;
  type: 'player' | 'system';
}
