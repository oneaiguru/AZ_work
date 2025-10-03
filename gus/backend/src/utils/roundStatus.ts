import { Round } from '../entities/Round.js';

export type RoundStatus = 'cooldown' | 'active' | 'finished';

export const resolveRoundStatus = (round: Round, referenceDate = new Date()): RoundStatus => {
  const now = referenceDate.getTime();
  const start = round.startTime.getTime();
  const end = round.endTime.getTime();

  if (now < start) {
    return 'cooldown';
  }

  if (now >= start && now <= end) {
    return 'active';
  }

  return 'finished';
};
