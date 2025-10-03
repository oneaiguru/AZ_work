import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation
} from 'typeorm';
import { RoundScore } from './RoundScore.js';

export type UserRole = 'admin' | 'player' | 'nikita';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  username!: string;

  @Column()
  passwordHash!: string;

  @Column({ type: 'varchar' })
  role!: UserRole;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @OneToMany(() => RoundScore, (score) => score.user)
  scores!: Relation<RoundScore[]>;
}
