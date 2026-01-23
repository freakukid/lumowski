# Migration Notes: User to Business Model

## Overview

This migration transforms the application from a single-user model (where each user has their own inventory) to a multi-user business model (where users belong to businesses that share inventory).

## Database Changes

### New Tables
- `businesses` - Business/organization entity
- `business_members` - Links users to businesses with roles (OWNER, BOSS, EMPLOYEE)
- `invite_codes` - Invite codes for joining businesses

### Modified Tables
- `inventory_schemas` - Changed from `userId` to `businessId`
- `inventory_items` - Changed from `userId` to `businessId`, added `createdById` for audit

### Removed Columns
- `users.inventorySchema` relation (now via business)
- `users.inventoryItems` relation (now via business)

## Migration Steps

### Step 1: Backup Your Database
```bash
pg_dump -h localhost -U postgres -d lumowski > backup.sql
```

### Step 2: If You Have Existing Data

If you have existing users with inventory data, you need to run a data migration BEFORE applying the Prisma schema migration:

```sql
-- Create businesses for existing users
INSERT INTO businesses (id, name, created_at, updated_at)
SELECT
  gen_random_uuid(),
  users.name || '''s Business',
  NOW(),
  NOW()
FROM users;

-- Create business members (existing users become OWNER)
INSERT INTO business_members (id, role, business_id, user_id, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'OWNER',
  b.id,
  u.id,
  NOW(),
  NOW()
FROM users u
JOIN businesses b ON b.name = u.name || '''s Business';

-- Migrate inventory_schemas (add businessId, copy from userId)
-- First, add the new column
ALTER TABLE inventory_schemas ADD COLUMN business_id UUID;

-- Then update with business IDs
UPDATE inventory_schemas SET business_id = (
  SELECT bm.business_id
  FROM business_members bm
  WHERE bm.user_id = inventory_schemas.user_id
);

-- Migrate inventory_items
ALTER TABLE inventory_items ADD COLUMN business_id UUID;
ALTER TABLE inventory_items ADD COLUMN created_by_id UUID;

UPDATE inventory_items SET
  business_id = (
    SELECT bm.business_id
    FROM business_members bm
    WHERE bm.user_id = inventory_items.user_id
  ),
  created_by_id = user_id;
```

### Step 3: Apply Prisma Migration
```bash
npx prisma migrate dev --name add-business-model
```

### Step 4: For New Installations

For new installations without existing data, simply run:
```bash
npx prisma migrate dev --name initial
# or
npx prisma db push
```

## Verification

After migration, verify:

1. All existing users have a business membership
2. All inventory schemas are linked to a business
3. All inventory items are linked to a business and have createdById set

```sql
-- Check users have businesses
SELECT u.email, bm.role, b.name as business_name
FROM users u
LEFT JOIN business_members bm ON bm.user_id = u.id
LEFT JOIN businesses b ON b.id = bm.business_id;

-- Check schemas are linked
SELECT s.id, b.name as business_name
FROM inventory_schemas s
LEFT JOIN businesses b ON b.id = s.business_id;

-- Check items are linked
SELECT COUNT(*), i.business_id
FROM inventory_items i
GROUP BY i.business_id;
```

## Rollback

If you need to rollback, restore from backup:
```bash
psql -h localhost -U postgres -d lumowski < backup.sql
```

And revert the Prisma schema to the previous version.
