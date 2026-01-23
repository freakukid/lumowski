# Lumowski - Inventory Management System

## Tech Stack

### Frontend
- **Nuxt 3.17** - Vue 3 meta-framework with SSR support
- **Vue 3.5** - Composition API with `<script setup>` syntax
- **Pinia 3** - State management
- **Tailwind CSS** - Utility-first CSS with custom theme system
- **TypeScript 5.7** - Type safety throughout

### Backend
- **Nitro** - Nuxt's server engine (file-based API routes)
- **Prisma 6** - ORM with PostgreSQL
- **Socket.io 4.8** - Real-time updates
- **Zod** - Schema validation

### Authentication
- **JWT** - Access + refresh token pattern
- **bcrypt** - Password hashing
- **Google OAuth** - Google Identity Services (One Tap + popup fallback)

### Other
- **PWA** - @vite-pwa/nuxt for installable app
- **PostgreSQL** - Database

## Project Structure

```
├── assets/css/main.css    # Theme system (CSS variables) + Tailwind
├── components/            # Vue components
│   ├── Dynamic*.vue       # Dynamic inventory system components
│   ├── SchemaEditor.vue   # User-defined column editor
│   └── ThemeSwitcher.vue  # Theme dropdown
├── composables/           # Vue composables
│   ├── useAuth.ts         # Authentication logic
│   ├── useGoogleAuth.ts   # Google Sign-In
│   ├── useInventory.ts    # Inventory CRUD
│   ├── useSchema.ts       # User schema management
│   ├── useSocket.ts       # WebSocket connection
│   └── useTheme.ts        # Theme switching
├── layouts/               # Page layouts
├── middleware/            # Route middleware (auth)
├── pages/                 # File-based routing
│   ├── index.vue          # Inventory list
│   ├── inventory/[id].vue # View/edit item
│   ├── inventory/new.vue  # Create item
│   ├── settings/schema.vue# Column configuration
│   ├── login.vue
│   └── register.vue
├── plugins/               # Nuxt plugins
├── prisma/
│   └── schema.prisma      # Database schema
├── server/
│   ├── api/               # API routes (Nitro)
│   │   ├── auth/          # Auth endpoints
│   │   ├── inventory/     # CRUD endpoints
│   │   └── schema/        # Schema endpoints
│   └── utils/             # Server utilities
├── stores/                # Pinia stores
│   ├── auth.ts
│   ├── inventory.ts
│   └── theme.ts
├── types/                 # TypeScript types
└── tailwind.config.js     # Tailwind with CSS variable colors
```

## Key Patterns

### Dynamic Inventory System
Users define their own columns (schema) stored as JSON. Items store data as `{ columnId: value }` pairs.

```typescript
// Column definition (in InventorySchema.columns)
interface ColumnDefinition {
  id: string
  name: string
  type: 'text' | 'number' | 'currency' | 'date' | 'select'
  role?: 'name' | 'quantity' | 'minQuantity' | 'price' | 'cost'
  options?: string[]  // For select type
  required?: boolean
  order: number
}
```

### Theme System
- **CSS variables** defined in `assets/css/main.css` (single source of truth)
- **Theme metadata** in `stores/theme.ts` (id, name, dark flag only)
- Colors: `primary`, `accent`, `surface` (each with 50-950 shades)
- Switch themes via `html[data-theme="theme-id"]` attribute

To add a theme:
1. Add metadata to `stores/theme.ts`
2. Add CSS variables in `main.css`: `html[data-theme="your-id"] { ... }`
3. Add preview gradient in `ThemeSwitcher.vue`

### API Routes
File-based in `server/api/`. Convention:
- `index.get.ts` - GET /api/resource
- `index.post.ts` - POST /api/resource
- `[id].get.ts` - GET /api/resource/:id
- `[id].put.ts` - PUT /api/resource/:id
- `[id].delete.ts` - DELETE /api/resource/:id

### Authentication Flow
- JWT stored in httpOnly cookies
- Access token: 15min, Refresh token: 7 days
- `useAuth()` composable for auth state
- `auth` middleware protects routes

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:migrate   # Run Prisma migrations
npm run db:push      # Push schema to DB (dev)
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database
```

## Environment Variables

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```
