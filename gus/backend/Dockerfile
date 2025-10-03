FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json .eslintrc.cjs .env.example ./
COPY src ./src
RUN npm install
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY .env.example .
CMD ["node", "dist/index.js"]
