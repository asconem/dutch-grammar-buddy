# Dutch Grammar Buddy 🇳🇱

Translate Dutch phrases and ask an AI tutor to explain the grammar. Built for supplementing Duolingo with actual grammar explanations.

## How It Works

1. **Paste a Dutch phrase** → gets translated to English via Claude Sonnet
2. **Ask grammar questions** → a tutor explains word choice, sentence structure, rules, etc.
3. **Follow up** → multi-turn chat keeps context so you can dig deeper

## Setup

### 1. Get an Anthropic API Key

- Go to [console.anthropic.com](https://console.anthropic.com)
- Create an account and add billing (even $5 will last a long time)
- Go to **Settings → API Keys** and create a new key

### 2. Local Development

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/dutch-grammar-buddy.git
cd dutch-grammar-buddy

# Install dependencies
npm install

# Create your env file
cp .env.local.example .env.local
# Edit .env.local and paste your API key

# Run it
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Deploy to Vercel (Free)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click **"Add New Project"** → import your repo
4. In **Environment Variables**, add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your API key (the `sk-ant-...` string)
5. Click **Deploy**

That's it. You'll get a URL like `dutch-grammar-buddy.vercel.app`.

## Cost

Uses Claude Sonnet for both translation and grammar chat. At typical usage (a few phrases per day), expect to spend **well under $1/month**.

## Tech Stack

- **Next.js 14** (App Router)
- **Anthropic Claude Sonnet** via API
- **Vercel** for hosting
