const Fastify = require('fastify');
const mercurius = require('mercurius');

const app = Fastify();

const schema = `
  type Query {
    add(x: Int!, y: Int!): Int!
  }
`;

const resolvers = {
  Query: {
    add: async (_, { x, y }) => x + y,
  },
};

app.register(mercurius, {
  schema,
  resolvers,
  graphiql: true,
});

app.listen({ port: 3000 }, err => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log('Server listening at http://localhost:3000');
});
