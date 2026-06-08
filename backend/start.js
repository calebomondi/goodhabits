const { readFileSync } = require('fs')
const { Client } = require('pg')
const { spawn } = require('child_process')

async function migrate() {
  const sql = readFileSync('drizzle/0000_moaning_post.sql', 'utf8')
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(Boolean)

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  })
  await client.connect()

  for (const stmt of sql) {
    try { await client.query(stmt) } catch (e) {
      if (!e.message.includes('already exists')) throw e
    }
  }

  await client.end()
  console.log('Migration complete')
}

migrate().then(() => {
  spawn('node', ['dist/src/main'], { stdio: 'inherit', env: process.env })
}).catch(e => {
  console.error('Migration failed:', e.message)
  process.exit(1)
})
