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

export type UserRole = 'admin' | 'player' | 'nikita';

const DATE_COLUMN_TYPE = getDateColumnType();

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  username!: string;

  @Column({ type: 'varchar' })
  passwordHash!: string;

  @Column({ type: 'varchar' })
  role!: UserRole;

  @CreateDateColumn({ type: DATE_COLUMN_TYPE })
  createdAt!: Date;

  @OneToMany(() => RoundScore, (score) => score.user)
  scores!: Relation<RoundScore[]>;
}
