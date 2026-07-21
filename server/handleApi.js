import {
  SHEETS,
  SPREADSHEET_ID,
  getSheetsClient,
  resolveSheet,
  objectToRow,
  rowsToObjects,
  colLetter,
  ensureHeaders,
  seedAllergenesIfEmpty,
  seedSubstitutionsIfEmpty,
  appendRows,
  readSheetObjects,
  rewriteSheet,
  deleteRecipeById,
} from './sheetsCore.js'
import { resolveNutrition, sleep } from './nutrition.js'

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
  })
}

function match(path, pattern) {
  const pathParts = path.split('/').filter(Boolean)
  const patternParts = pattern.split('/').filter(Boolean)
  if (pathParts.length !== patternParts.length) return null
  const params = {}
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i]
    if (p.startsWith(':')) {
      params[p.slice(1)] = decodeURIComponent(pathParts[i])
    } else if (p !== pathParts[i]) {
      return null
    }
  }
  return params
}

async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return null
  const text = await req.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Handler unique pour Netlify Functions (et éventuellement un serveur local).
 * @param {Request} req
 * @returns {Promise<Response>}
 */
export async function handleApi(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      },
    })
  }

  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method.toUpperCase()

  try {
    if (method === 'GET' && path === '/api/health') {
      return json({ ok: true, spreadsheetId: SPREADSHEET_ID })
    }

    if (method === 'GET' && path === '/api/meta') {
      const sheets = getSheetsClient()
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
      return json({
        title: meta.data.properties?.title,
        spreadsheetId: SPREADSHEET_ID,
        sheets: (meta.data.sheets || []).map((s) => ({
          title: s.properties.title,
          sheetId: s.properties.sheetId,
          rowCount: s.properties.gridProperties?.rowCount,
          columnCount: s.properties.gridProperties?.columnCount,
        })),
        schema: SHEETS,
      })
    }

    if (method === 'POST' && path === '/api/schema/sync') {
      const sheets = getSheetsClient()
      for (const sheet of Object.values(SHEETS)) {
        await ensureHeaders(sheets, sheet)
      }
      const allergenes = await seedAllergenesIfEmpty(sheets)
      const substitutions = await seedSubstitutionsIfEmpty(sheets)
      return json({ ok: true, schema: SHEETS, allergenes, substitutions })
    }

    {
      const params = match(path, '/api/sheets/:sheetKey')
      if (params) {
        const sheet = resolveSheet(params.sheetKey)

        if (method === 'GET') {
          const sheets = getSheetsClient()
          const result = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${sheet.name}'`,
          })
          const values = result.data.values || []
          const headers = values[0] || sheet.columns
          const rows = rowsToObjects(values)
          return json({
            sheet: sheet.name,
            headers,
            columns: sheet.columns,
            rows,
            count: rows.length,
          })
        }

        if (method === 'POST') {
          const payload = (await readBody(req)) || {}
          const row = objectToRow(payload, sheet.columns)
          if (sheet.idField && !payload[sheet.idField]) {
            return json({ error: `Champ requis: ${sheet.idField}` }, 400)
          }
          const sheets = getSheetsClient()
          const result = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${sheet.name}'!A:Z`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [row] },
          })
          return json(
            {
              ok: true,
              updatedRange: result.data.updates?.updatedRange,
              row: Object.fromEntries(sheet.columns.map((c, i) => [c, row[i]])),
            },
            201,
          )
        }
      }
    }

    {
      const params = match(path, '/api/sheets/:sheetKey/:row')
      if (params && method === 'PUT') {
        const sheet = resolveSheet(params.sheetKey)
        const rowNumber = Number(params.row)
        if (!Number.isInteger(rowNumber) || rowNumber < 2) {
          return json({ error: 'Numéro de ligne invalide (doit être >= 2)' }, 400)
        }
        const body = (await readBody(req)) || {}
        const sheets = getSheetsClient()
        const existing = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${sheet.name}'!${rowNumber}:${rowNumber}`,
        })
        const currentValues = existing.data.values?.[0] || []
        const headerRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${sheet.name}'!1:1`,
        })
        const headers = headerRes.data.values?.[0] || sheet.columns
        const current = Object.fromEntries(headers.map((col, i) => [col, currentValues[i] ?? '']))
        const merged = { ...current, ...body }
        const row = objectToRow(merged, sheet.columns)
        const endCol = colLetter(sheet.columns.length)
        const result = await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${sheet.name}'!A${rowNumber}:${endCol}${rowNumber}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [row] },
        })
        return json({
          ok: true,
          updatedRange: result.data.updatedRange,
          row: {
            _row: rowNumber,
            ...Object.fromEntries(sheet.columns.map((c, i) => [c, row[i]])),
          },
        })
      }
    }

    if (method === 'POST' && path === '/api/recipes') {
      const {
        recipe,
        ingredients = [],
        links = [],
        steps = [],
        newIngredients = [],
      } = (await readBody(req)) || {}

      if (!recipe?.idRecette || !recipe?.nomRecette || !recipe?.type) {
        return json(
          { error: 'Recette invalide: idRecette, nomRecette et type sont requis' },
          400,
        )
      }
      if (!steps.length) return json({ error: 'Au moins une étape est requise' }, 400)
      if (!links.length) return json({ error: 'Au moins un ingrédient est requis' }, 400)

      const sheets = getSheetsClient()
      for (const sheet of Object.values(SHEETS)) {
        await ensureHeaders(sheets, sheet)
      }

      const ingredientRows = [...newIngredients, ...ingredients].filter(Boolean)
      const uniqueIngredients = []
      const seen = new Set()
      for (const ing of ingredientRows) {
        if (!ing.idIngr || seen.has(ing.idIngr)) continue
        seen.add(ing.idIngr)
        uniqueIngredients.push(ing)
      }

      const existing = await readSheetObjects(sheets, 'ingredients')
      const existingIds = new Set(existing.rows.map((r) => r.idIngr))
      const toCreate = uniqueIngredients.filter((i) => !existingIds.has(i.idIngr))

      await appendRows(sheets, 'ingredients', toCreate)
      await appendRows(sheets, 'recettes', [recipe])
      await appendRows(sheets, 'ingredientsRecette', links)
      await appendRows(sheets, 'etape', steps)

      return json(
        {
          ok: true,
          recipe,
          ingredientsCreated: toCreate.length,
          links: links.length,
          steps: steps.length,
        },
        201,
      )
    }

    {
      const params = match(path, '/api/recipes/:id')
      if (params) {
        const idRecette = params.id

        if (method === 'PUT') {
          const {
            recipe,
            links = [],
            steps = [],
            newIngredients = [],
          } = (await readBody(req)) || {}

          if (!recipe?.nomRecette || !recipe?.type) {
            return json({ error: 'nomRecette et type sont requis' }, 400)
          }
          if (!steps.length || !links.length) {
            return json({ error: 'Ingrédients et étapes requis' }, 400)
          }

          const sheets = getSheetsClient()
          const recettes = await readSheetObjects(sheets, 'recettes')
          const existing = recettes.rows.find((r) => r.idRecette === idRecette)
          if (!existing) return json({ error: 'Recette introuvable' }, 404)

          const payloadRecipe = { ...existing, ...recipe, idRecette }
          const allLinks = await readSheetObjects(sheets, 'ingredientsRecette')
          const allEtapes = await readSheetObjects(sheets, 'etape')
          const allIngredients = await readSheetObjects(sheets, 'ingredients')

          const remainingRecettes = recettes.rows.map((r) =>
            r.idRecette === idRecette ? payloadRecipe : r,
          )
          const remainingLinks = [
            ...allLinks.rows.filter((l) => l.idRecette !== idRecette),
            ...links.map((l) => ({ ...l, idRecette })),
          ]
          const remainingEtapes = [
            ...allEtapes.rows.filter((e) => e.idRecette !== idRecette),
            ...steps.map((s, i) => ({
              ...s,
              idRecette,
              ordre: String(s.ordre || i + 1),
            })),
          ]

          const existingIds = new Set(allIngredients.rows.map((r) => r.idIngr))
          const toCreate = (newIngredients || []).filter(
            (i) => i.idIngr && !existingIds.has(i.idIngr),
          )
          const ingredientsOut = [...allIngredients.rows, ...toCreate]

          await rewriteSheet(sheets, 'recettes', remainingRecettes)
          await rewriteSheet(sheets, 'ingredientsRecette', remainingLinks)
          await rewriteSheet(sheets, 'etape', remainingEtapes)
          if (toCreate.length) {
            await rewriteSheet(sheets, 'ingredients', ingredientsOut)
          }

          return json({ ok: true, recipe: payloadRecipe })
        }

        if (method === 'DELETE') {
          const sheets = getSheetsClient()
          const result = await deleteRecipeById(sheets, idRecette)
          return json({ ok: true, ...result })
        }
      }
    }

    if (method === 'POST' && path === '/api/nutrition/lookup') {
      const body = (await readBody(req)) || {}
      const name = String(body.name || body.nomIngr || '').trim()
      if (!name) return json({ error: 'name requis' }, 400)
      const result = await resolveNutrition(name, { preferApi: body.preferApi !== false })
      if (!result) return json({ ok: false, found: false, name })
      return json({ ok: true, found: true, name, ...result })
    }

    if (method === 'POST' && path === '/api/nutrition/enrich') {
      const body = (await readBody(req)) || {}
      const force = Boolean(body.force)
      const sheets = getSheetsClient()
      const { rows } = await readSheetObjects(sheets, 'ingredients')
      let updated = 0
      let skipped = 0
      const out = []

      for (const row of rows) {
        const hasNutrition = Number(row.kcal100) > 0 || Number(row.proteines100) > 0
        if (hasNutrition && !force) {
          skipped += 1
          out.push(row)
          continue
        }
        const nutrition = await resolveNutrition(row.nomIngr)
        await sleep(4500) // ~13 req/min — limite Open Food Facts
        if (!nutrition) {
          out.push(row)
          skipped += 1
          continue
        }
        updated += 1
        out.push({
          ...row,
          kcal100: nutrition.kcal100,
          proteines100: nutrition.proteines100,
          glucides100: nutrition.glucides100,
          lipides100: nutrition.lipides100,
          nutritionSource: nutrition.nutritionSource || '',
        })
      }

      await rewriteSheet(sheets, 'ingredients', out)
      return json({ ok: true, updated, skipped, total: rows.length })
    }

    if (method === 'POST' && path === '/api/ingredients/import') {
      const body = (await readBody(req)) || {}
      const items = Array.isArray(body.items) ? body.items : []
      if (!items.length) return json({ error: 'items[] requis' }, 400)

      const sheets = getSheetsClient()
      for (const sheet of Object.values(SHEETS)) {
        await ensureHeaders(sheets, sheet)
      }
      const existing = await readSheetObjects(sheets, 'ingredients')
      const byName = new Map(
        existing.rows.map((r) => [String(r.nomIngr || '').trim().toLowerCase(), r]),
      )

      const toCreate = []
      let enriched = 0
      for (const raw of items) {
        const nomIngr = String(raw.nomIngr || raw.nom || raw.name || raw.produit || '').trim()
        if (!nomIngr) continue
        const key = nomIngr.toLowerCase()
        if (byName.has(key)) continue

        let nutrition = {
          kcal100: raw.kcal100 ?? '',
          proteines100: raw.proteines100 ?? '',
          glucides100: raw.glucides100 ?? '',
          lipides100: raw.lipides100 ?? '',
          nutritionSource: raw.nutritionSource || '',
        }
        if (!nutrition.kcal100 && body.enrich !== false) {
          const looked = await resolveNutrition(nomIngr, {
            barcode: String(raw.barcode || raw.code || raw.ean || ''),
          })
          await sleep(4500) // Open Food Facts rate limit
          if (looked) {
            nutrition = {
              kcal100: looked.kcal100,
              proteines100: looked.proteines100,
              glucides100: looked.glucides100,
              lipides100: looked.lipides100,
              nutritionSource: looked.nutritionSource || '',
            }
            enriched += 1
          }
        }

        const idIngr =
          String(raw.idIngr || '').trim() ||
          `ing-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
        const row = {
          idIngr,
          nomIngr,
          unite: String(raw.unite || 'g'),
          prixUnitaire: String(raw.prixUnitaire ?? raw.prix ?? 0),
          saison: String(raw.saison || 'toute'),
          idAllergie: String(raw.idAllergie || ''),
          ...nutrition,
        }
        toCreate.push(row)
        byName.set(key, row)
      }

      await appendRows(sheets, 'ingredients', toCreate)
      return json({
        ok: true,
        created: toCreate.length,
        enriched,
        totalAfter: byName.size,
      })
    }

    return json({ error: 'Not found' }, 404)
  } catch (err) {
    return json({ error: err.message || 'Erreur serveur' }, err.status || 500)
  }
}
