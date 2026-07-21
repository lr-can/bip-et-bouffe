import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { typeLabel, spiceLabel, dietLabels } from '@/utils/recipe'
import { groupShoppingByCategory } from '@/composables/useShoppingList'
import router from '@/router'

const COLORS = {
  navy: [15, 32, 74],
  orange: [255, 107, 53],
  rose: [255, 77, 141],
  mint: [45, 212, 191],
  turquoise: [6, 182, 212],
  muted: [92, 101, 120],
  soft: [247, 248, 252],
  white: [255, 255, 255],
  line: [226, 230, 240],
  warnBg: [255, 244, 237],
  warnText: [180, 60, 30],
}

const QR_SIZE = 38

function formatQty(n) {
  if (Number.isInteger(n)) return String(n)
  return Number(n).toFixed(2).replace(/\.00$/, '')
}

/**
 * jsPDF (Helvetica) ne gère pas bien emojis / certains unicode :
 * ça produit des rendus cassés du type "&h&e&a&l&t&h&y…".
 */
function pdfSafe(value) {
  return String(value ?? '')
    .replace(/\u26a0\ufe0f?/g, '!') // ⚠
    .replace(/[·•▸►]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/€/g, ' EUR')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * URL absolue d'une recette via le router Vue (history mode).
 * Ex. https://app.example.com/recette/rec-xxx
 */
export function recipeAbsoluteUrl(idRecette) {
  if (!idRecette) return ''
  const resolved = router.resolve({ name: 'recipe', params: { id: String(idRecette) } })
  const path = resolved.href.startsWith('/') ? resolved.href : `/${resolved.href}`
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : ''
  // import.meta.env.BASE_URL est déjà inclus dans resolved.href par Vue Router
  return `${origin}${path}`
}

async function qrDataUrl(text) {
  if (!text) return null
  try {
    return await QRCode.toDataURL(text, {
      margin: 1,
      width: 160,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f204a', light: '#ffffff' },
    })
  } catch {
    return null
  }
}

async function loadLogoDataUrl() {
  try {
    const res = await fetch('/logo.png')
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function drawRoundedRect(doc, x, y, w, h, r, style = 'F') {
  doc.roundedRect(x, y, w, h, r, r, style)
}

function drawCheckbox(doc, x, y, size = 10) {
  doc.setDrawColor(...COLORS.navy)
  doc.setLineWidth(1)
  doc.setFillColor(...COLORS.white)
  doc.roundedRect(x, y - size + 2, size, size, 1.5, 1.5, 'FD')
}

export async function downloadMenuPdf({
  title = 'Planning Bip & Bouffe',
  personnes = 4,
  days = null,
  recipes = [],
  shoppingList = [],
  totalCost = 0,
  allergies = '',
  collectedAllergies = [],
} = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 42
  const contentWidth = pageWidth - margin * 2
  let y = 0
  let page = 1

  const logo = await loadLogoDataUrl()

  // Prépare les QR pour toutes les recettes du planning
  const qrById = new Map()
  const allPlanRecipes = []
  if (days?.length) {
    for (const day of days) {
      for (const recipe of day.recipes || []) {
        if (recipe?.idRecette) allPlanRecipes.push(recipe)
      }
    }
  } else {
    for (const recipe of recipes || []) {
      if (recipe?.idRecette) allPlanRecipes.push(recipe)
    }
  }
  const uniqueIds = [...new Set(allPlanRecipes.map((r) => r.idRecette))]
  await Promise.all(
    uniqueIds.map(async (id) => {
      const url = recipeAbsoluteUrl(id)
      const dataUrl = await qrDataUrl(url)
      if (dataUrl) qrById.set(id, dataUrl)
    }),
  )

  const ensureSpace = (needed = 28) => {
    if (y + needed > pageHeight - 52) {
      drawFooter()
      doc.addPage()
      page += 1
      drawHeader(false)
    }
  }

  const drawHeader = (full = true) => {
    doc.setFillColor(...COLORS.orange)
    doc.rect(0, 0, pageWidth, full ? 92 : 56, 'F')
    doc.setFillColor(...COLORS.rose)
    doc.rect(pageWidth * 0.55, 0, pageWidth * 0.45, full ? 92 : 56, 'F')
    doc.setFillColor(...COLORS.navy)
    doc.rect(0, full ? 92 : 56, pageWidth, 4, 'F')

    if (logo) {
      try {
        doc.addImage(logo, 'PNG', margin, full ? 18 : 10, full ? 48 : 34, full ? 48 : 34)
      } catch {
        /* ignore logo errors */
      }
    }

    const textX = margin + (logo ? (full ? 62 : 46) : 0)
    doc.setTextColor(...COLORS.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(full ? 20 : 14)
    doc.text('Bip & Bouffe', textX, full ? 38 : 28)
    if (full) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text('Bien manger pour mieux servir', textX, 54)
    }
    y = full ? 118 : 78
  }

  const drawFooter = () => {
    doc.setDrawColor(...COLORS.line)
    doc.setLineWidth(0.8)
    doc.line(margin, pageHeight - 36, pageWidth - margin, pageHeight - 36)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.muted)
    doc.text('Bip & Bouffe - planning entre amis', margin, pageHeight - 20)
    doc.text(`Page ${page}`, pageWidth - margin, pageHeight - 20, { align: 'right' })
  }

  const sectionTitle = (text) => {
    ensureSpace(36)
    doc.setFillColor(...COLORS.navy)
    drawRoundedRect(doc, margin, y - 12, 6, 18, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...COLORS.navy)
    doc.text(pdfSafe(text), margin + 14, y)
    y += 22
  }

  const bodyText = (text, opts = {}) => {
    const {
      size = 10,
      bold = false,
      color = COLORS.navy,
      gap = 12,
      maxW = contentWidth,
      x = margin,
    } = opts
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(pdfSafe(text), maxW)
    ensureSpace(lines.length * (size + 3) + 8)
    doc.text(lines, x, y)
    y += lines.length * (size + 3) + gap - 8
  }

  const startDedicatedPage = (heading, subtitle = '') => {
    drawFooter()
    doc.addPage()
    page += 1
    drawHeader(false)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...COLORS.navy)
    doc.text(pdfSafe(heading), margin, y)
    y += 18
    if (subtitle) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...COLORS.muted)
      doc.text(pdfSafe(subtitle), margin, y)
      y += 16
    }
    y += 6
  }

  drawHeader(true)

  ensureSpace(70)
  doc.setFillColor(...COLORS.soft)
  drawRoundedRect(doc, margin, y, contentWidth, 58, 10, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...COLORS.navy)
  doc.text(pdfSafe(title), margin + 16, y + 24)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.muted)
  doc.text(
    pdfSafe(
      `${personnes} personne(s)  -  ${days?.length || 1} jour(s)  -  ${Number(totalCost || 0).toFixed(2)} EUR estimes`,
    ),
    margin + 16,
    y + 42,
  )
  y += 74

  const allergyBits = [
    allergies?.trim(),
    ...(collectedAllergies || []).filter(Boolean),
  ].filter(Boolean)
  const uniqueAllergies = [...new Set(allergyBits.map((a) => a.trim()).filter(Boolean))]

  if (uniqueAllergies.length || allergies?.trim()) {
    ensureSpace(54)
    doc.setFillColor(...COLORS.warnBg)
    drawRoundedRect(doc, margin, y, contentWidth, 44, 10, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.warnText)
    doc.text('Allergies a surveiller', margin + 14, y + 18)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const allergyLine = allergies?.trim()
      ? `Eviter : ${allergies.trim()}${collectedAllergies?.length ? `  |  Recettes : ${collectedAllergies.join(', ')}` : ''}`
      : `Mentionnees dans les recettes : ${uniqueAllergies.join(', ')}`
    const allergyLines = doc.splitTextToSize(pdfSafe(allergyLine), contentWidth - 28)
    doc.text(allergyLines.slice(0, 2), margin + 14, y + 34)
    y += 58
  }

  if (days?.length) {
    sectionTitle('Au menu')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.muted)
    doc.text('Scanne le QR pour ouvrir la recette sur Bip & Bouffe.', margin, y)
    y += 14

    days.forEach((day, index) => {
      const recipeCount = day.recipes?.length || 0
      const rowH = 48
      const blockH = 28 + recipeCount * rowH + 12
      ensureSpace(blockH)

      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(...COLORS.line)
      doc.setLineWidth(1)
      drawRoundedRect(doc, margin, y, contentWidth, blockH - 6, 12, 'FD')

      const accents = [COLORS.orange, COLORS.turquoise, COLORS.rose, COLORS.mint]
      doc.setFillColor(...accents[index % accents.length])
      drawRoundedRect(doc, margin, y, 8, blockH - 6, 4, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(...COLORS.navy)
      doc.text(`Jour ${index + 1}`, margin + 20, y + 20)
      if (day.cost != null) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...COLORS.muted)
        doc.text(
          pdfSafe(`${Number(day.cost || 0).toFixed(2)} EUR`),
          pageWidth - margin - 16,
          y + 20,
          { align: 'right' },
        )
      }

      let rowY = y + 34
      for (const recipe of day.recipes || []) {
        doc.setFillColor(...COLORS.soft)
        drawRoundedRect(doc, margin + 16, rowY - 8, contentWidth - 32, rowH - 6, 6, 'F')

        const typeStr = pdfSafe(typeLabel(recipe.type).toUpperCase())
        const nameStr = pdfSafe(recipe.nomRecette || '-')
        const meta = pdfSafe(
          [recipe.mood, recipe.tps, recipe.allergie && `Allergie: ${recipe.allergie}`]
            .filter(Boolean)
            .join(' - '),
        )

        const qr = qrById.get(recipe.idRecette)
        const textRight = qr ? pageWidth - margin - 28 - QR_SIZE : pageWidth - margin - 28
        const nameMaxW = textRight - (margin + 88)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(...COLORS.orange)
        doc.text(typeStr, margin + 24, rowY + 6)

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...COLORS.navy)
        doc.setFontSize(10)
        const nameLines = doc.splitTextToSize(nameStr, Math.max(80, nameMaxW))
        doc.text(nameLines[0] || '-', margin + 88, rowY + 6)

        if (meta) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(...COLORS.muted)
          const metaLines = doc.splitTextToSize(meta, Math.max(80, nameMaxW + 64))
          doc.text(metaLines[0] || '', margin + 24, rowY + 20)
        }

        if (qr) {
          try {
            doc.addImage(qr, 'PNG', pageWidth - margin - 16 - QR_SIZE, rowY - 4, QR_SIZE, QR_SIZE)
          } catch {
            /* ignore */
          }
        }

        rowY += rowH
      }
      y += blockH + 8
    })
  } else {
    sectionTitle('Recette')
    for (const recipe of recipes) {
      ensureSpace(40 + (qrById.has(recipe.idRecette) ? QR_SIZE : 0))
      const qr = qrById.get(recipe.idRecette)
      if (qr) {
        try {
          doc.addImage(qr, 'PNG', pageWidth - margin - QR_SIZE, y - 8, QR_SIZE, QR_SIZE)
        } catch {
          /* ignore */
        }
      }
      bodyText(`${typeLabel(recipe.type)} - ${recipe.nomRecette}`, {
        size: 12,
        bold: true,
        gap: 6,
        maxW: contentWidth - (qr ? QR_SIZE + 12 : 0),
      })
      bodyText(
        [
          recipe.mood && `Ambiance : ${recipe.mood}`,
          recipe.difficulte && `Difficulte : ${recipe.difficulte}`,
          `Epice : ${spiceLabel(recipe.spiceLevel)}`,
          dietLabels(recipe).length && dietLabels(recipe).join(' / '),
          recipe.tps && `Temps : ${recipe.tps}`,
          recipe.allergie && `Allergies : ${recipe.allergie}`,
          `Cout : ${Number(recipe.cout || 0).toFixed(2)} EUR`,
          recipe.nutritionParPers?.kcal != null &&
            `Nutrition / pers : ${Math.round(recipe.nutritionParPers.kcal)} kcal`,
        ]
          .filter(Boolean)
          .join('  -  '),
        { size: 9, color: COLORS.muted, gap: 10 },
      )
      if (recipe.ingredients?.length) {
        bodyText('Ingredients', { size: 10, bold: true, gap: 4 })
        for (const ing of recipe.ingredients) {
          bodyText(
            `- ${ing.nomIngr} - ${formatQty(ing.quantite)} ${ing.unite || ''}`.trim(),
            { size: 9, gap: 3 },
          )
        }
        y += 6
      }
      if (recipe.etapes?.length) {
        bodyText('Etapes', { size: 10, bold: true, gap: 4 })
        recipe.etapes.forEach((etape, i) => {
          bodyText(`${i + 1}. ${etape.texte}`, { size: 9, gap: 4 })
        })
      }
      y += 10
    }
  }

  // —— Liste de courses : page(s) dédiée(s), triée par catégorie, cases à cocher ——
  if (shoppingList.length) {
    const groups = groupShoppingByCategory(shoppingList)
    startDedicatedPage(
      'Liste de courses',
      `${shoppingList.length} article(s) - coche au fur et a mesure`,
    )

    const drawCategoryHeader = (categorie, count) => {
      ensureSpace(34)
      doc.setFillColor(...COLORS.navy)
      drawRoundedRect(doc, margin, y - 4, contentWidth, 20, 6, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...COLORS.white)
      doc.text(pdfSafe(categorie), margin + 10, y + 10)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(String(count), pageWidth - margin - 10, y + 10, { align: 'right' })
      y += 28
    }

    const ensureShoppingSpace = (needed, categorie, count) => {
      if (y + needed <= pageHeight - 52) return
      drawFooter()
      doc.addPage()
      page += 1
      drawHeader(false)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(...COLORS.navy)
      doc.text('Liste de courses (suite)', margin, y)
      y += 20
      drawCategoryHeader(categorie, count)
    }

    for (const group of groups) {
      const rowH = 20
      drawCategoryHeader(group.categorie, group.items.length)

      group.items.forEach((item, i) => {
        ensureShoppingSpace(rowH + 4, group.categorie, group.items.length)
        if (i % 2 === 0) {
          doc.setFillColor(...COLORS.soft)
          drawRoundedRect(doc, margin, y - 12, contentWidth, rowH, 4, 'F')
        }

        drawCheckbox(doc, margin + 8, y, 11)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(...COLORS.navy)
        const qty = pdfSafe(`${formatQty(item.quantite)} ${item.unite || ''}`.trim())
        const nameMax = contentWidth - 120
        const nameLines = doc.splitTextToSize(pdfSafe(item.nomIngr), nameMax)
        doc.text(nameLines[0] || '-', margin + 28, y)

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...COLORS.muted)
        doc.text(qty, pageWidth - margin - 10, y, { align: 'right' })
        y += rowH
      })

      y += 10
    }
  }

  drawFooter()
  const filename = `planning-bip-et-bouffe-${Date.now()}.pdf`
  doc.save(filename)
  return filename
}

export async function downloadRecipePdf(recipe, personnes) {
  return downloadMenuPdf({
    title: recipe.nomRecette || 'Recette',
    personnes: personnes || recipe.personnes || 2,
    recipes: [recipe],
    shoppingList: (recipe.ingredients || []).map((ing) => ({
      ...ing,
      categorie: ing.categorie || 'Divers',
    })),
    totalCost: recipe.cout || 0,
    allergies: recipe.allergie || '',
    collectedAllergies: recipe.allergie ? [recipe.allergie] : [],
  })
}
