import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/data-source.js';
import { env } from '../config/env.js';
import { User, UserRole } from '../entities/User.js';

interface LoginBody {
  username: string;
  password: string;
}

const roleByName = (username: string): UserRole => {
  if (username.toLowerCase() === 'admin') {
    return 'admin';
  }

  if (username === 'Никита' || username.toLowerCase() === 'nikita') {
    return 'nikita';
  }

  return 'player';
};

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: LoginBody }>('/login', async (request, reply) => {
    const { username, password } = request.body;

    if (!username || !password) {
      reply.status(400).send({ message: 'Имя пользователя и пароль обязательны' });
      return;
    }

    const userRepository = AppDataSource.getRepository(User);

    let user = await userRepository.findOne({ where: { username } });

    if (!user) {
      const passwordHash = await bcrypt.hash(password, 10);
      user = userRepository.create({
        username,
        passwordHash,
        role: roleByName(username)
      });
      await userRepository.save(user);
    } else {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        reply.status(401).send({ message: 'Неверный пароль' });
        return;
      }
    }

    const token = app.jwt.sign({
      sub: user.id,
      username: user.username,
      role: user.role
    });

    reply
      .setCookie('guss_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: env.NODE_ENV === 'production'
      })
      .send({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
  });

  app.get('/me', { preHandler: app.authenticate }, async (request) => {
    return { user: request.user };
  });
}
