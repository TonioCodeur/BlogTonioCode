# 🚀 ShipStack

ShipStack is a **modern, robust Next.js boilerplate ready for real-world projects**. Designed to save you time and keep you from reinventing the wheel for every new project.  
It combines best dev practices (Next.js 16, Prisma, React Hook Form, Radix UI, Tailwind-friendly utilities, and more) so you can focus on what truly matters: **shipping awesome code**.
Don't forget that this project is licensed—read the `LICENSE.md` file!

---

## 🧱 Overview

ShipStack gives you a solid foundation:
- The latest **Next.js 16** 🍰
- **Prisma** ready to use (with handy DB scripts)
- **Forms validated with Zod + React Hook Form**
- **Utility UI with Radix + lucide-react**
- Styling utils (clsx + class-variance-authority)
- Sleek toasts with Sonner
- Dark/Light theme support via `next-themes`
- Quick auth with `better-auth`

This is a starter made for serious, modular, and maintainable projects.

---

## 🛠️ Useful scripts

You can run everything you need with these commands
(using your favorite package manager: **npm**, **pnpm**, **yarn**, or **bun**):

### Start the dev server
```bash
npm run dev
pnpm dev
yarn dev
bun run dev
```

### Build for production (generates Prisma & Next.js build)
```bash
npm run build
pnpm build
yarn build
bun run build
```

### Start the app in production
```bash
npm run start
pnpm start
yarn start
bun run start
```

### Run eslint to clean up your code
```bash
npm run lint
pnpm lint
yarn lint
bun run lint
```

### Prisma commands
Generate the Prisma client:
```bash
npm run db:generate
pnpm db:generate
yarn db:generate
bun run db:generate
```

Push your schema to the DB:
```bash
npm run db:push
pnpm db:push
yarn db:push
bun run db:push
```

Run migrations in dev:
```bash
npm run db:migrate
pnpm db:migrate
yarn db:migrate
bun run db:migrate
```

Open Prisma Studio:
```bash
npm run db:studio
pnpm db:studio
yarn db:studio
bun run db:studio
```

### Run tests

```bash
npm test
pnpm test
yarn test
bun test
npm test:run
pnpm test:run
yarn test:run
bun test:run
npm test:ui
pnpm test:ui
yarn test:ui
bun test:ui
```
---

# Key Dependencies

Here are the technical building blocks that power ShipStack:

```json
"dependencies": {
  "@hookform/resolvers": "^5.2.2",
  "@prisma/client": "^7.2.0",
  "@radix-ui/react-dropdown-menu": "^2.1.16",
  "@radix-ui/react-label": "^2.1.8",
  "@radix-ui/react-separator": "^1.1.8",
  "@radix-ui/react-slot": "^1.2.4",
  "better-auth": "^1.4.10",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^0.562.0",
  "next": "16.1.1",
  "next-themes": "^0.4.6",
  "react": "19.2.3",
  "react-dom": "19.2.3",
  "react-hook-form": "^7.69.0",
  "sonner": "^2.0.7",
  "tailwind-merge": "^3.4.0",
  "zod": "^4.3.4"
}
```

Each dependency adds genuine power without drowning you in complicated configurations.

---

# 📌 Quick Start

Clone the project:

```bash
git clone https://github.com/ShipStack/shipstack.git
cd shipstack
```

Install dependencies:

```bash
npm install
pnpm install
yarn install
bun install
```

Run the following command to create the database:

```bash
npx prisma db push
pnpm db:push
yarn db:push
bun run db:push
```

Run the following command to generate the Prisma client:

```bash
npm run db:generate
pnpm db:generate
yarn db:generate
bun run db:generate
```

Run the following command to start the app in development mode:

```bash
npm run dev
pnpm dev
yarn dev
bun run dev
```

That's it! 🚀

---

## 💳 Payments (Lemon Squeezy)

ShipStack integrates **Lemon Squeezy** for secure payment processing. Payments are verified server-side via a **HMAC-signed webhook** — no client-side role manipulation is possible.

### How it works

```
User clicks "Buy" ──> LemonSqueezy Checkout ──> Payment confirmed
                                                      │
                                    ┌─────────────────┘
                                    ▼
                          Webhook (POST /api/webhooks/lemonsqueezy)
                                    │
                          1. Verify HMAC signature
                          2. Parse event (order_created, etc.)
                          3. Update user role to CUSTOMER in DB
                                    │
                                    ▼
                          User redirected to /order-successfull
```

### Environment variables

Add these to your `.env.local` (or Vercel dashboard):

| Variable | Description |
|---|---|
| `LEMONSQUEEZY_API_KEY` | Your Lemon Squeezy API key ([Settings > API](https://app.lemonsqueezy.com/settings/api)) |
| `LEMONSQUEEZY_STORE_ID` | Your store ID (visible in your store URL) |
| `LEMONSQUEEZY_VARIANT_ID` | The variant ID of the product to sell |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | The signing secret you set when creating the webhook |
| `NEXT_PUBLIC_APP_URL` | Your app URL (e.g. `https://shipstack-next.vercel.app`) |

### Webhook setup (Lemon Squeezy Dashboard)

1. Go to **[Settings > Webhooks](https://app.lemonsqueezy.com/settings/webhooks)**
2. Click **Add Webhook**
3. Set the fields:
   - **URL**: `https://your-domain.com/api/webhooks/lemonsqueezy`
   - **Signing secret**: the same value as your `LEMONSQUEEZY_WEBHOOK_SECRET` env var
4. Select events:
   - `order_created`
   - `order_refunded`
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_expired`
   - `subscription_resumed`
5. Save

### Supported events

| Event | Action |
|---|---|
| `order_created` | Upgrades user to `CUSTOMER`, stores `lemonSqueezyCustomerId` |
| `order_refunded` | Downgrades `CUSTOMER` back to `USER` |
| `subscription_created` | Same as `order_created` |
| `subscription_updated` | Upgrades or downgrades based on subscription `status` |
| `subscription_cancelled` | Downgrades `CUSTOMER` to `USER` |
| `subscription_expired` | Downgrades `CUSTOMER` to `USER` |
| `subscription_resumed` | Re-upgrades `USER` to `CUSTOMER` |

### Security

- **HMAC verification** — every incoming webhook is verified with `crypto.timingSafeEqual` to prevent timing attacks and signature forgery
- **No client-side upgrade** — user roles are only modified by the webhook, never by the browser
- **Protected routes** — `/order-successfull` requires authentication (enforced by `proxy.ts`)

---

# 📚 Documentation

- [Prisma](https://www.prisma.io/docs/)
- [Tailwind](https://tailwindcss.com/docs)
- [Radix UI](https://www.radix-ui.com/docs/primitives/components/dropdown-menu)
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://github.com/colinhacks/zod)
- [Sonner](https://github.com/sonner/sonner)
- [Next.js](https://nextjs.org/docs)
- [Tailwind-merge](https://github.com/benface/tailwind-merge)

---

# 📝 License

See the [LICENSE](./LICENSE.md) file for more details.