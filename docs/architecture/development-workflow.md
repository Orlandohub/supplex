# Development Workflow

## Local Development Setup

### Prerequisites

```bash
# Required tools
node --version  # v20.x.x or higher
bun --version   # 1.1.x or higher
pnpm --version  # 8.15.x or higher
```

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/supplex/supplex.git
cd supplex

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 4. Setup database
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. Start development
pnpm dev
```

---
