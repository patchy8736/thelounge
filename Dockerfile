# Multi-stage Dockerfile for TheLounge
FROM node:22-alpine AS builder

WORKDIR /src

# Copy package files first for better caching
COPY package.json yarn.lock .yarnrc.yml ./

# Install build tools and dependencies
RUN apk add --no-cache python3 make g++ && \
    corepack enable && \
    yarn install --immutable

# Copy source and build
COPY . .
RUN NODE_ENV=production yarn build && yarn cache clean

# Runtime stage
FROM node:22-alpine

ENV THELOUNGE_HOME=/var/opt/thelounge
ENV NODE_ENV=production

RUN corepack enable && \
    mkdir -p ${THELOUNGE_HOME} && \
    chown node:node ${THELOUNGE_HOME}

WORKDIR /app

# Copy package files
COPY --chown=node:node package.json yarn.lock .yarnrc.yml ./

# Copy built artifacts and node_modules from builder (includes compiled native modules)
COPY --chown=node:node --from=builder /src/dist ./dist
COPY --chown=node:node --from=builder /src/public ./public
COPY --chown=node:node --from=builder /src/defaults ./defaults
COPY --chown=node:node --from=builder /src/node_modules ./node_modules
COPY --chown=node:node --from=builder /src/index.js ./
COPY --chown=node:node --from=builder /src/client/index.html.tpl ./client/index.html.tpl

USER node
ENV HOME=/home/node

VOLUME "${THELOUNGE_HOME}"
EXPOSE 9000

CMD ["node", "index", "start"]
