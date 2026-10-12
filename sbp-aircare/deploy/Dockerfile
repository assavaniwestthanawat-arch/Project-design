# SBP AirCare — production image (Rev.10). Build context = the sbp-aircare/ folder:
#   docker compose -f deploy/compose.yaml up -d --build      (normal way — deploy/DEPLOY_TH.md)
#   docker build -f deploy/Dockerfile -t sbp-aircare .        (image only)
# Only what the server serves or needs goes in: server/, assets/ (without the photo index and README/txt notes), the
# public pages, the legal pages, backoffice.html and package.json. Never internal/ (special/project rates — CLAUDE.md
# §6.6 #3/#4), tests/, tools/, backoffice/ (Apps Script + dev data), *.md, dist/, node_modules/ or .env files.
# .dockerignore keeps those out of the build context; the first stage below prunes again, so a careless context still
# cannot leak a document into the final image. No npm install: the server has no runtime dependencies.

FROM node:24-bookworm-slim AS site
WORKDIR /src
COPY package.json ./
COPY server/ server/
COPY assets/ assets/
COPY a.html b.html c.html d.html a2.html b2.html c2.html d2.html a3.html b3.html c3.html backoffice.html privacy.html terms.html refund.html 404.html ./
RUN find . \( -name '*.md' -o -name '*.txt' -o -name 'README*' -o -name '.*' -o -name '*.py' \) -type f -delete \
 && rm -f assets/photos/photos.json \
 && find . -type d -empty -delete

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DATA_DIR=/data
WORKDIR /app
# code stays root-owned (read-only for the app); only /data is writable by the 'node' user
COPY --from=site /src/ ./
RUN mkdir -p /data && chown node:node /data && chmod 750 /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/healthz').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
STOPSIGNAL SIGTERM
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.mjs"]
