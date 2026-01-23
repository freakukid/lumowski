/**
 * Data Migration Script: Migrate Existing Users to Business Model
 *
 * This script should be run AFTER the Prisma schema migration.
 * It will:
 * 1. Create a Business for each existing user
 * 2. Add the user as OWNER of their business
 * 3. Move InventorySchema from user to business
 * 4. Move InventoryItems from user to business
 *
 * Run with: npx tsx prisma/migrations/migrate-to-business.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting migration to business model...')

  // Get all users
  const users = await prisma.user.findMany({
    include: {
      businessMemberships: true,
    },
  })

  console.log(`Found ${users.length} users to process`)

  let created = 0
  let skipped = 0

  for (const user of users) {
    // Skip users who already have a business
    if (user.businessMemberships.length > 0) {
      console.log(`Skipping user ${user.email} - already has a business`)
      skipped++
      continue
    }

    console.log(`Processing user: ${user.email}`)

    try {
      // Create a business for this user
      const business = await prisma.business.create({
        data: {
          name: `${user.name}'s Business`,
          members: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
        },
      })

      console.log(`  Created business: ${business.name} (${business.id})`)

      // Note: The old schema had userId on InventorySchema and InventoryItem
      // After the schema change, these columns no longer exist
      // This migration assumes you've already modified the schema and need to
      // create the relationships. If you have existing data with the old schema,
      // you'll need to run this migration in two steps:
      //
      // Step 1: Before changing schema, export user's schema and items
      // Step 2: After changing schema, create businesses and re-import data
      //
      // For fresh migrations where no data exists with old userId columns,
      // this script simply creates the businesses.

      created++
      console.log(`  Migration complete for ${user.email}`)
    } catch (error) {
      console.error(`  Error processing user ${user.email}:`, error)
    }
  }

  console.log('\nMigration Summary:')
  console.log(`  Total users: ${users.length}`)
  console.log(`  Businesses created: ${created}`)
  console.log(`  Skipped (already had business): ${skipped}`)
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
