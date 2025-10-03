import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn
} from 'typeorm';
import { getDateColumnType } from '../config/dateColumnType.js';
import { User } from './User.js';
import { Round } from './Round.js';

const DATE_COLUMN_TYPE = getDateColumnType();

@Entity('round_scores')
@Index(['user', 'round'], { unique: true })
export class RoundScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (user) => user.scores)
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @ManyToOne(() => Round, (round) => round.scores)
  @JoinColumn({ name: 'round_id' })
  round!: Relation<Round>;

  @Column({ type: 'integer', default: 0 })
  taps!: number;

  @Column({ type: 'integer', default: 0 })
  score!: number;

  @CreateDateColumn({ type: DATE_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: DATE_COLUMN_TYPE })
  updatedAt!: Date;
}
