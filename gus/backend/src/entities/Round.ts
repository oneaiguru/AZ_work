import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation
} from 'typeorm';
import { getDateColumnType } from '../config/dateColumnType.js';
import { RoundScore } from './RoundScore.js';

const DATE_COLUMN_TYPE = getDateColumnType();

@Entity('rounds')
export class Round {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: DATE_COLUMN_TYPE })
  startTime!: Date;

  @Column({ type: DATE_COLUMN_TYPE })
  endTime!: Date;

  @Column({ type: 'integer', default: 0 })
  totalScore!: number;

  @CreateDateColumn({ type: DATE_COLUMN_TYPE })
  createdAt!: Date;

  @OneToMany(() => RoundScore, (score) => score.round)
  scores!: Relation<RoundScore[]>;
}
