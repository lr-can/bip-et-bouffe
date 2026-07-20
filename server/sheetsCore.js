import { google } from 'googleapis'
import { createPrivateKey } from 'crypto'

export const SPREADSHEET_ID =
  process.env.COOKING_SPREADSHEET_ID ||
  '1L8bndWNnVsjCMKi8GxEKyXsFSfA1HANkinrtfzUqbOY'

export const SHEETS = {
  recettes: {
    name: 'recettes',
    columns: [
      'idRecette',
      'nomRecette',
      'type',
      'mood',
      'difficulte',
      'tps',
      'nbPerso',
      'allergie',
      'imageUrl',
    ],
    idField: 'idRecette',
  },
  ingredients: {
    name: 'ingredients',
    columns: ['idIngr', 'nomIngr', 'unite', 'prixUnitaire', 'saison', 'idAllergie'],
    idField: 'idIngr',
  },
  allergenes: {
    name: 'allergenes',
    columns: ['idAllergie', 'nomAllergie'],
    idField: 'idAllergie',
  },
  ingredientsRecette: {
    name: 'ingredientsRecette',
    columns: ['idIngr', 'idRecette', 'qteParPersonne'],
    idField: null,
  },
  etape: {
    name: 'etape',
    columns: ['idEtape', 'idRecette', 'texte', 'ordre'],
    idField: 'idEtape',
  },
}

const DEFAULT_ALLERGENS = [
  { idAllergie: 'all-gluten', nomAllergie: 'Gluten' },
  { idAllergie: 'all-lactose', nomAllergie: 'Lactose / lait' },
  { idAllergie: 'all-oeuf', nomAllergie: 'Œuf' },
  { idAllergie: 'all-arachide', nomAllergie: 'Arachide' },
  { idAllergie: 'all-fruits-coque', nomAllergie: 'Fruits à coque' },
  { idAllergie: 'all-soja', nomAllergie: 'Soja' },
  { idAllergie: 'all-poisson', nomAllergie: 'Poisson' },
  { idAllergie: 'all-crustaces', nomAllergie: 'Crustacés' },
  { idAllergie: 'all-sesame', nomAllergie: 'Sésame' },
  { idAllergie: 'all-moutarde', nomAllergie: 'Moutarde' },
  { idAllergie: 'all-celeri', nomAllergie: 'Céleri' },
  { idAllergie: 'all-sulfites', nomAllergie: 'Sulfites' },
  { idAllergie: 'all-lupin', nomAllergie: 'Lupin' },
  { idAllergie: 'all-mollusques', nomAllergie: 'Mollusques' },
]

function normalizePrivateKey(raw) {
  if (!raw) throw new Error('GG_private_key manquante dans .env')
  let key = raw.trim()
  if (
    (key.startsWith("'") && key.endsWith("'")) ||
    (key.startsWith('"') && key.endsWith('"'))
  ) {
    key = key.slice(1, -1)
  }
  key = key.replace(/\\+n/g, '\n')
  createPrivateKey(key)
  return key
}

export function getSheetsClient() {
  const email = (process.env.GG_client_email || '').replace(/^'|'$/g, '')
  const auth = new google.auth.JWT({
    email,
    key: normalizePrivateKey(process.env.GG_private_key),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

export function rowsToObjects(values) {
  if (!values?.length) return []
  const [headers, ...rows] = values
  return rows
    .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row, index) => {
      const obj = { _row: index + 2 }
      headers.forEach((header, i) => {
        obj[header] = row[i] ?? ''
      })
      return obj
    })
}

export function objectToRow(obj, columns) {
  return columns.map((col) => {
    const value = obj[col]
    return value === undefined || value === null ? '' : String(value)
  })
}

export function resolveSheet(key) {
  const sheet = SHEETS[key]
  if (!sheet) {
    const err = new Error(`Feuille inconnue: ${key}`)
    err.status = 404
    throw err
  }
  return sheet
}

export function colLetter(index) {
  let n = index
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export async function ensureSheetExists(sheets, sheetName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const exists = (meta.data.sheets || []).some(
    (s) => s.properties?.title === sheetName,
  )
  if (exists) return false
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: sheetName } } }],
    },
  })
  return true
}

export async function ensureHeaders(sheets, sheet) {
  await ensureSheetExists(sheets, sheet.name)

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheet.name}'`,
  })
  const values = result.data.values || []
  const current = values[0] || []
  const needsUpdate =
    sheet.columns.length !== current.length ||
    sheet.columns.some((col, i) => current[i] !== col)

  if (!needsUpdate) return

  const dataRows = values.slice(1).filter((row) =>
    row.some((cell) => String(cell ?? '').trim() !== ''),
  )
  const remapped = dataRows.map((row) => {
    const obj = {}
    current.forEach((header, i) => {
      obj[header] = row[i] ?? ''
    })
    return objectToRow(obj, sheet.columns)
  })

  const end = colLetter(Math.max(sheet.columns.length, current.length, 1))
  const clearRows = Math.max(values.length, remapped.length + 1)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheet.name}'!A1:${end}${clearRows}`,
  })
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheet.name}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [sheet.columns, ...remapped] },
  })
}

export async function appendRows(sheets, sheetKey, rows) {
  if (!rows.length) return null
  const sheet = resolveSheet(sheetKey)
  const values = rows.map((row) => objectToRow(row, sheet.columns))
  return sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheet.name}'!A:Z`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  })
}

export async function readSheetObjects(sheets, sheetKey) {
  const sheet = resolveSheet(sheetKey)
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheet.name}'`,
  })
  const values = result.data.values || []
  return {
    sheet,
    headers: values[0] || sheet.columns,
    rows: rowsToObjects(values),
  }
}

export async function rewriteSheet(sheets, sheetKey, objects) {
  const sheet = resolveSheet(sheetKey)
  const end = colLetter(Math.max(sheet.columns.length, 8))
  const dataRows = objects.map((obj) => objectToRow(obj, sheet.columns))
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheet.name}'!A:${end}`,
  })
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheet.name}'!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [sheet.columns, ...dataRows] },
  })
}

export async function seedAllergenesIfEmpty(sheets) {
  const { rows } = await readSheetObjects(sheets, 'allergenes')
  if (rows.length > 0) return { seeded: false, count: rows.length }
  await appendRows(sheets, 'allergenes', DEFAULT_ALLERGENS)
  return { seeded: true, count: DEFAULT_ALLERGENS.length }
}

export async function deleteRecipeById(sheets, idRecette) {
  const recettes = await readSheetObjects(sheets, 'recettes')
  const links = await readSheetObjects(sheets, 'ingredientsRecette')
  const etapes = await readSheetObjects(sheets, 'etape')
  const ingredients = await readSheetObjects(sheets, 'ingredients')

  const remainingRecettes = recettes.rows.filter((r) => r.idRecette !== idRecette)
  if (remainingRecettes.length === recettes.rows.length) {
    const err = new Error('Recette introuvable')
    err.status = 404
    throw err
  }

  const removedLinkIds = links.rows
    .filter((l) => l.idRecette === idRecette)
    .map((l) => l.idIngr)
  const remainingLinks = links.rows.filter((l) => l.idRecette !== idRecette)
  const remainingEtapes = etapes.rows.filter((e) => e.idRecette !== idRecette)

  const stillUsed = new Set(remainingLinks.map((l) => l.idIngr))
  const orphanIds = removedLinkIds.filter((id) => !stillUsed.has(id))
  const cleanedIngredients = ingredients.rows.filter((ing) => !orphanIds.includes(ing.idIngr))

  await rewriteSheet(sheets, 'recettes', remainingRecettes)
  await rewriteSheet(sheets, 'ingredientsRecette', remainingLinks)
  await rewriteSheet(sheets, 'etape', remainingEtapes)
  await rewriteSheet(sheets, 'ingredients', cleanedIngredients)

  return {
    deleted: idRecette,
    remainingRecipes: remainingRecettes.length,
    orphansRemoved: orphanIds.length,
  }
}
