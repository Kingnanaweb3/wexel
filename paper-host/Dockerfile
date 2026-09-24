FROM node:22-bookworm
RUN apt-get update && apt-get install -y curl bzip2 ca-certificates && rm -rf /var/lib/apt/lists/*

# Solana CLI, to deploy Wexel onto the fork
RUN sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
# Surfpool, the mainnet fork
RUN curl -sL https://run.surfpool.run/ | bash
ENV PATH="/root/.local/share/solana/install/active_release/bin:/root/.local/bin:${PATH}"

WORKDIR /app
COPY keeper/package*.json keeper/
RUN cd keeper && npm install --no-audit --no-fund
COPY . .
CMD ["bash", "start.sh"]
