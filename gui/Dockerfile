# === BUILD ===
# vite.config.ts sets:
#   root: src/          (index.html lives in gui/src/)
#   outDir: ../dist     (output goes to gui/dist/ relative to the vite root)
# So after `pnpm build` the static files are at gui/dist/
FROM node:20-alpine AS build
WORKDIR /app

# Enable corepack to get pnpm without a separate install step
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

# Install dependencies first (layer-cache friendly)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy full source and build
COPY . .
RUN pnpm build

# === RUNNER ===
FROM nginx:alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/gridfs-gui.conf

# Copy built static files from build stage.
# vite build output is at /app/dist (gui/dist/) relative to the WORKDIR above.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
