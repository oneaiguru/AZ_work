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
import { User } from './User.js';
import { Round } from './Round.js';

@Entity('round_scores')
@Index(['user', 'round'], { unique: true })
export class RoundScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (user) => user.scores, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @ManyToOne(() => Round, (round) => round.scores)
  @JoinColumn({ name: 'round_id' })
  round!: Relation<Round>;

  @Column({ type: 'integer', default: 0 })
  taps!: number;

  @Column({ type: 'integer', default: 0 })
  score!: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
