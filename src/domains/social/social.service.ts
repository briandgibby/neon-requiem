import { SocialRepository } from './social.repository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { TalkResult, DisguiseResult, SINResult, Disposition } from './social.types';

export class SocialService {
  constructor(private readonly socialRepo: SocialRepository) {}

  async checkLegalStatus(characterId: string, roomSlug: string): Promise<SINResult> {
    const character = await this.socialRepo.findCharacterById(characterId);
    if (!character) throw new NotFoundError('Character');

    const room = await this.socialRepo.getRoomBySlug(roomSlug);
    if (!room) throw new NotFoundError('Room');

    // AAA and AA zones require a valid SIN
    const highSec = room.securityRating === 'AAA' || room.securityRating === 'AA';
    
    if (highSec && !character.hasValidSIN && !character.disguiseIdentity) {
      return {
        success: false,
        message: 'CITIZENSHIP VERIFICATION FAILED: Access denied. Security forces notified.',
        hasValidSIN: false
      };
    }

    return {
      success: true,
      message: 'Legal status verified.',
      hasValidSIN: character.hasValidSIN
    };
  }

  async smoothTalk(characterId: string, roomSlug: string): Promise<TalkResult> {
    const character = await this.socialRepo.findCharacterById(characterId);
    if (!character) throw new NotFoundError('Character');

    const room = await this.socialRepo.getRoomBySlug(roomSlug);
    if (!room) throw new NotFoundError('Room');

    // Success = (Charisma + LuckPool) + 1d20 vs (Difficulty 15-25 based on Security)
    const luckBonus = Math.floor(character.luckPool / 2);
    const playerRoll = character.charisma + luckBonus + Math.floor(Math.random() * 20) + 1;
    
    let difficulty = 15;
    if (room.securityRating === 'AAA') difficulty = 25;
    else if (room.securityRating === 'AA') difficulty = 22;
    else if (room.securityRating === 'A') difficulty = 20;

    const success = playerRoll >= difficulty;

    if (success) {
      // Temporarily improve room disposition (placeholder logic)
      return {
        success: true,
        message: 'Your silver tongue works its magic. Suspicion fades.',
        newDisposition: 'NEUTRAL'
      };
    } else {
      return {
        success: false,
        message: 'Your attempts at persuasion fall on deaf ears. If anything, you look more suspicious now.',
        newDisposition: 'SUSPICIOUS'
      };
    }
  }

  async applyDisguise(characterId: string, identity: string | null): Promise<DisguiseResult> {
    const character = await this.socialRepo.findCharacterById(characterId);
    if (!character) throw new NotFoundError('Character');

    await this.socialRepo.updateDisguise(characterId, identity);

    return {
      success: true,
      message: identity ? `Disguise applied: ${identity}.` : 'Disguise removed.',
      identity
    };
  }

  async burnSIN(characterId: string): Promise<SINResult> {
    const character = await this.socialRepo.findCharacterById(characterId);
    if (!character) throw new NotFoundError('Character');

    await this.socialRepo.updateSINStatus(characterId, false);

    return {
      success: false,
      message: 'CRITICAL ERROR: Your SIN has been flagged and burned. You are now SINless.',
      hasValidSIN: false
    };
  }

  async purchaseFakeSIN(characterId: string): Promise<SINResult> {
    const character = await this.socialRepo.findCharacterById(characterId);
    if (!character) throw new NotFoundError('Character');

    // Placeholder for Nuyen check (e.g., 5000¥)
    await this.socialRepo.updateSINStatus(characterId, true);

    return {
      success: true,
      message: 'New identity forged. High-security clearance restored.',
      hasValidSIN: true
    };
  }
}
