/**
 * Import d’un fichier Excel produits → feuille ingredients (+ nutrition OFF).
 *
 * Usage:
 *   node scripts/import-produits.mjs "./mercurial produit applis.xlsx"
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { newId } from '../src/utils/recipe.js'

const require = createRequire(import.meta.url)

function pick(row, keys) {
  for (const key of keys) {
    const found = Object.keys(row).find(
      (k) => k.trim().toLowerCase() === key.toLowerCase(),
    )
    if (found != null && String(row[found]).trim() !== '') return row[found]
  }
  // fuzzy contains
  for (const key of keys) {
    const found = Object.keys(row).find((k) =>
      k.trim().toLowerCase().includes(key.toLowerCase()),
    )
    if (found != null && String(row[found]).trim() !== '') return row[found]
  }
  return ''
}

function rowToItem(row) {
  const nomIngr = String(
    pick(row, [
      'nomIngr',
      'nom',
      'name',
      'produit',
      'product',
      'ingredient',
      'denomination',
      'dénomination',
      'libellé',
      'libelle',
      'désignation',
      'designation',
      'article',
    ]),
  ).trim()
  if (!nomIngr) return null

  const uniteRaw = String(
    pick(row, ['unite', 'unité', 'Unité', 'unit', 'u']) || '',
  ).trim()
  const prixRaw = pick(row, [
    'prixUnitaire',
    'Prix unitaire',
    'prix',
    'price',
    'tarif',
  ])

  // Lignes de catégorie (ex. "BOF") : pas d'unité ni de prix
  if (!uniteRaw && (prixRaw === '' || prixRaw == null)) return null

  let unite = uniteRaw || 'g'
  const uNorm = unite
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  if (/^kg|kilo/.test(uNorm)) unite = 'kg'
  else if (/^g|gr|gramme/.test(uNorm)) unite = 'g'
  else if (/^l|litre/.test(uNorm)) unite = 'l'
  else if (/^ml/.test(uNorm)) unite = 'ml'
  else if (/^cl/.test(uNorm)) unite = 'cl'
  else if (/piece|pce|pcs|unit/.test(uNorm)) unite = 'pièce'
  else unite = uniteRaw

  const saisonRaw = String(pick(row, ['saison', 'season', 'Colonne1']) || '').trim()

  return {
    idIngr: String(pick(row, ['idIngr', 'id']) || newId('ing')),
    nomIngr,
    unite,
    prixUnitaire: String(prixRaw ?? 0),
    saison: saisonRaw || 'toute',
    idAllergie: String(pick(row, ['idAllergie', 'allergie', 'allergene']) || ''),
    kcal100: String(pick(row, ['kcal100', 'kcal', 'calories', 'energie']) || ''),
    proteines100: String(pick(row, ['proteines100', 'proteines', 'protéines', 'protein']) || ''),
    glucides100: String(pick(row, ['glucides100', 'glucides', 'carbs', 'carbohydrates']) || ''),
    lipides100: String(pick(row, ['lipides100', 'lipides', 'fat', 'matieres grasses']) || ''),
    barcode: String(pick(row, ['barcode', 'ean', 'gtin', 'codebarres', 'code-barres']) || ''),
  }
}

async function main() {
  const fileArg = process.argv[2]
  if (!fileArg) {
    console.error('Usage: node scripts/import-produits.mjs <fichier.xlsx>')
    process.exit(1)
  }
  const filePath = path.resolve(fileArg)
  if (!fs.existsSync(filePath)) {
    console.error('Fichier introuvable:', filePath)
    process.exit(1)
  }
  const stat = fs.statSync(filePath)
  if (stat.size < 500) {
    console.error(
      'Ce fichier est trop petit pour un vrai Excel (souvent un verrou _$ / ~$). Ferme Excel et copie le .xlsx réel.',
    )
    process.exit(1)
  }

  let XLSX
  try {
    XLSX = require('xlsx')
  } catch {
    console.error('Installe xlsx: npm install xlsx')
    process.exit(1)
  }

  const wb = XLSX.readFile(filePath)
  const sheetName = wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  console.log(`Feuille "${sheetName}" — ${rows.length} lignes`)
  if (rows[0]) console.log('Colonnes:', Object.keys(rows[0]).join(', '))

  const items = rows.map(rowToItem).filter(Boolean)
  console.log(`${items.length} produits mappés`)
  if (!items.length) {
    console.error('Aucun produit importable (vérifie les colonnes denomination / Unité / Prix).')
    process.exit(1)
  }

  // Scripts Node : API locale optionnelle, sinon URL Netlify via API_URL
  const base =
    process.env.API_URL ||
    (process.env.VITE_API_URL && !/localhost|127\.0\.0\.1/i.test(process.env.VITE_API_URL)
      ? process.env.VITE_API_URL
      : 'http://localhost:3001')
  const enrich = process.argv.includes('--no-enrich') ? false : true

  console.log(`Import vers ${base} (enrich=${enrich})…`)
  const res = await fetch(`${base}/api/ingredients/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, enrich }),
  })
  const data = await res.json()
  if (!res.ok) {
    console.error('Erreur API:', data)
    process.exit(1)
  }
  console.log('Import OK:', data)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
