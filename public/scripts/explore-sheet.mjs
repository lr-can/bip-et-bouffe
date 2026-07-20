import 'dotenv/config'
import { google } from 'googleapis'
import { createPrivateKey } from 'crypto'

const spreadsheetId = '1L8bndWNnVsjCMKi8GxEKyXsFSfA1HANkinrtfzUqbOY'

function normalizePrivateKey(raw) {
  if (!raw) throw new Error('GG_private_key manquante')
  let key = raw.trim()
  if ((key.startsWith("'") && key.endsWith("'")) || (key.startsWith('"') && key.endsWith('"'))) {
    key = key.slice(1, -1)
  }
  // dotenv peut laisser \\\n, \\n ou \n littéraux
  key = key.replace(/\\+n/g, '\n')
  createPrivateKey(key)
  return key
}

function getAuth() {
  const email = (process.env.GG_client_email || '').replace(/^'|'$/g, '')
  const key = normalizePrivateKey(process.env.GG_private_key)
  return new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function main() {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const sheetNames = meta.data.sheets.map((s) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId,
    rowCount: s.properties.gridProperties?.rowCount,
    columnCount: s.properties.gridProperties?.columnCount,
  }))
  console.log('=== SHEETS ===')
  console.log(JSON.stringify(sheetNames, null, 2))

  for (const sheet of sheetNames) {
    const range = `'${sheet.title}'`
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })
    const values = res.data.values || []
    console.log(`\n=== ${sheet.title} (${values.length} rows) ===`)
    console.log(JSON.stringify(values.slice(0, 8), null, 2))
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2))
  process.exit(1)
})
