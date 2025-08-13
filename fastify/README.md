# Fastify GraphQL Example

This example demonstrates a basic [Fastify](https://www.fastify.io/) server exposing a GraphQL API using [Mercurius](https://mercurius.dev/).

The schema defines a single query, `add`, which returns the sum of two integers.

## Setup

Install dependencies:

```bash
npm install
```

## Running the server

```bash
npm start
```

The server listens on [http://localhost:3000](http://localhost:3000) and provides a GraphiQL interface at `/graphiql`.

## Testing

Send a GraphQL request to verify the `add` resolver:

```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{ "query": "{ add(x: 1, y: 2) }" }' \
  http://localhost:3000/graphql
```

The response should be:

```json
{"data":{"add":3}}
```
