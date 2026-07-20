import { jsPDF } from 'jspdf'
import { typeLabel } from '@/utils/recipe'

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

function formatQty(n) {
  if (Number.isInteger(n)) return String(n)
  return Number(n).toFixed(2).replace(/\.00$/, '')
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

  const ensureSpace = (needed = 28) => {
    if (y + needed > pageHeight - 52) {
      drawFooter()
      doc.addPage()
      page += 1
      drawHeader(false)
    }
  }

  const drawHeader = (full = true) => {
    // bandeau dégradé simulé (bandes)
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
    doc.text('Bip & Bouffe — planning entre amis', margin, pageHeight - 20)
    doc.text(`Page ${page}`, pageWidth - margin, pageHeight - 20, { align: 'right' })
  }

  const sectionTitle = (text) => {
    ensureSpace(36)
    doc.setFillColor(...COLORS.navy)
    drawRoundedRect(doc, margin, y - 12, 6, 18, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...COLORS.navy)
    doc.text(text, margin + 14, y)
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
    const lines = doc.splitTextToSize(String(text ?? ''), maxW)
    ensureSpace(lines.length * (size + 3) + 8)
    doc.text(lines, x, y)
    y += lines.length * (size + 3) + gap - 8
  }

  drawHeader(true)

  // carte résumé
  ensureSpace(70)
  doc.setFillColor(...COLORS.soft)
  drawRoundedRect(doc, margin, y, contentWidth, 58, 10, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...COLORS.navy)
  doc.text(title, margin + 16, y + 24)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.muted)
  doc.text(
    `${personnes} personne(s)  ·  ${days?.length || 1} jour(s)  ·  ${totalCost.toFixed(2)} € estimés`,
    margin + 16,
    y + 42,
  )
  y += 74

  // allergies
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
    doc.text('Allergies à surveiller', margin + 14, y + 18)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const allergyLine = allergies?.trim()
      ? `Éviter : ${allergies.trim()}${collectedAllergies?.length ? `  |  Recettes : ${collectedAllergies.join(', ')}` : ''}`
      : `Mentionnées dans les recettes : ${uniqueAllergies.join(', ')}`
    const allergyLines = doc.splitTextToSize(allergyLine, contentWidth - 28)
    doc.text(allergyLines.slice(0, 2), margin + 14, y + 34)
    y += 58
  }

  if (days?.length) {
    sectionTitle('Au menu')
    days.forEach((day, index) => {
      const blockH = 28 + (day.recipes?.length || 0) * 28 + 12
      ensureSpace(blockH)

      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(...COLORS.line)
      doc.setLineWidth(1)
      drawRoundedRect(doc, margin, y, contentWidth, blockH - 6, 12, 'FD')

      // accent jour
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
        doc.text(`${day.cost.toFixed(2)} €`, pageWidth - margin - 16, y + 20, { align: 'right' })
      }

      let rowY = y + 38
      for (const recipe of day.recipes || []) {
        doc.setFillColor(...COLORS.soft)
        drawRoundedRect(doc, margin + 16, rowY - 12, contentWidth - 32, 22, 6, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...COLORS.orange)
        doc.text(typeLabel(recipe.type).toUpperCase(), margin + 24, rowY + 2)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...COLORS.navy)
        doc.setFontSize(10)
        doc.text(recipe.nomRecette || '—', margin + 88, rowY + 2)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...COLORS.muted)
        const meta = [recipe.mood, recipe.tps, recipe.allergie && `⚠ ${recipe.allergie}`]
          .filter(Boolean)
          .join(' · ')
        if (meta) doc.text(meta, pageWidth - margin - 20, rowY + 2, { align: 'right' })
        rowY += 28
      }
      y += blockH + 8
    })
  } else {
    sectionTitle('Recette')
    for (const recipe of recipes) {
      ensureSpace(40)
      bodyText(`${typeLabel(recipe.type)} — ${recipe.nomRecette}`, { size: 12, bold: true, gap: 6 })
      bodyText(
        [
          recipe.mood && `Ambiance : ${recipe.mood}`,
          recipe.difficulte && `Difficulté : ${recipe.difficulte}`,
          recipe.tps && `Temps : ${recipe.tps}`,
          recipe.allergie && `Allergies : ${recipe.allergie}`,
          `Coût : ${(recipe.cout || 0).toFixed(2)} €`,
        ]
          .filter(Boolean)
          .join('  ·  '),
        { size: 9, color: COLORS.muted, gap: 10 },
      )
      if (recipe.ingredients?.length) {
        bodyText('Ingrédients', { size: 10, bold: true, gap: 4 })
        for (const ing of recipe.ingredients) {
          bodyText(
            `• ${ing.nomIngr} — ${formatQty(ing.quantite)} ${ing.unite || ''}`.trim(),
            { size: 9, gap: 3 },
          )
        }
        y += 6
      }
      if (recipe.etapes?.length) {
        bodyText('Étapes', { size: 10, bold: true, gap: 4 })
        recipe.etapes.forEach((etape, i) => {
          bodyText(`${i + 1}. ${etape.texte}`, { size: 9, gap: 4 })
        })
      }
      y += 10
    }
  }

  if (shoppingList.length) {
    sectionTitle('Liste de courses')
    ensureSpace(24)
    shoppingList.forEach((item, i) => {
      ensureSpace(22)
      if (i % 2 === 0) {
        doc.setFillColor(...COLORS.soft)
        drawRoundedRect(doc, margin, y - 11, contentWidth, 18, 5, 'F')
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...COLORS.navy)
      doc.text(item.nomIngr, margin + 10, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.muted)
      doc.text(
        `${formatQty(item.quantite)} ${item.unite || ''}`.trim(),
        pageWidth - margin - 10,
        y,
        { align: 'right' },
      )
      y += 20
    })
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
    shoppingList: recipe.ingredients || [],
    totalCost: recipe.cout || 0,
    allergies: recipe.allergie || '',
    collectedAllergies: recipe.allergie ? [recipe.allergie] : [],
  })
}
