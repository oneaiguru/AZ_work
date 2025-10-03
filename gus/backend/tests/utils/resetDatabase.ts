import { AppDataSource } from '../../src/config/data-source.js';
import { RoundScore } from '../../src/entities/RoundScore.js';
import { Round } from '../../src/entities/Round.js';
import { User } from '../../src/entities/User.js';

export async function resetDatabase() {
  if (!AppDataSource.isInitialized) {
    return;
  }

  const scoreRepo = AppDataSource.getRepository(RoundScore);
  const roundRepo = AppDataSource.getRepository(Round);
  const userRepo = AppDataSource.getRepository(User);

  await scoreRepo.clear();
  await roundRepo.clear();
  await userRepo.clear();
}
