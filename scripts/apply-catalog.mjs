/**
 * Réapplique catalogue Mercurial (macros + catégories) sur la feuille ingredients.
 * Usage: node scripts/apply-catalog.mjs
 */
import 'dotenv/config'
import {
  getSheetsClient,
  readSheetObjects,
  rewriteSheet,
  ensureHeaders,
  SHEETS,
} from '../server/sheetsCore.js'

const RAW = `
idIngr	nomIngr	unite	prixUnitaire	saison	idAllergie	kcal100	proteines100	glucides100	lipides100	nutritionSource	categorie
ing-mrtfiizm-e132a	Feuilles de brick	pièce	1	toute		280	8	55	2.5	reference (corrigé)	Féculents & Céréales
ing-mrtfiizm-f5lxc	beurre	kg	9.16	toute		750	0.7	0.7	82	reference (corrigé)	Produits laitiers
ing-mrtfiizm-9ondo	lait 1/2 écremé	l	1.26	toute		46	3.3	4.8	1.6	estimation	Produits laitiers
ing-mrtfiizn-ihnry	Lait entier	l	1.28	toute		64	3.2	4.8	3.6	reference (corrigé)	Produits laitiers
ing-mrtfiizn-e83jh	crème légère	l		toute		165	2.9	4	15	reference	Produits laitiers
ing-mrtfiizn-3ymnv	crème entiere	l	5.25	toute		290	2.4	3	30	reference	Produits laitiers
ing-mrtfiizn-adb9x	œufs	pièce	4.37	toute		140	12.7	0.7	9.8	reference	Œuf
ing-mrtfiizo-y0u5i	ST MORET	kg	11.63	toute		205	7	3	19	reference (corrigé)	Fromage
ing-mrtfiizo-1ylj4	bûche Chevre	kg	10	toute		290	18	2	24	reference	Fromage
ing-mrtfiizo-4wnb6	Chedar	kg	18.8	toute		402	25	1.3	33	reference	Fromage
ing-mrtfiizo-wpw0i	mascarpone	kg	8.2	toute		355	4.5	4	37	reference	Fromage
ing-mrtfiizo-6luun	Fromage blanc	kg	3	toute		75	7.5	4	3.5	reference (corrigé)	Fromage
ing-mrtfiizo-1v4j2	Gruyère rapé	kg	7.89	toute		380	27	0.4	30	reference	Fromage
ing-mrtfiizo-ezx52	compté	kg	24	toute		410	27	0.5	34	reference	Fromage
ing-mrtfiizo-2hui8	mozzarella	kg	7.92	toute		280	18	2.2	22	reference (corrigé)	Fromage
ing-mrtfiizo-inx2r	Ricotta	kg	4.76	toute		150	8	3	11	reference	Fromage
ing-mrtfiizp-5i9pk	Parmesan	kg	21.9	toute		400	36	0	29	reference	Fromage
ing-mrtfiizp-bbhkm	Feta	kg	12.25	toute		260	14	4	21	reference	Fromage
ing-mrtfiizp-b4yc4	burrata	kg	22.45	toute		330	12	2	30	reference	Fromage
ing-mrtfiizp-r67ln	Pâte complète	kg	2	toute		340	13	64	2.5	reference	Féculents & Céréales
ing-mrtfiizp-vcmcs	Pâte	kg	1.2	toute		350	12	71	1.5	reference	Féculents & Céréales
ing-mrtfiizp-hd7dk	Riz balsmati	kg	2.6	toute		350	7	78	0.6	estimation	Féculents & Céréales
ing-mrtfiizp-uie7u	Riz rond	kg	2.4	toute		350	7	78	0.6	estimation	Féculents & Céréales
ing-mrtfiizp-7rrbu	Riz complet	kg	2.6	toute		355	7.5	73	2.8	reference (corrigé)	Féculents & Céréales
ing-mrtfiizp-ez5bz	semoule	kg	1.7	toute		350	12	72	1	reference	Féculents & Céréales
ing-mrtfiizq-a6ewm	polenta	kg	2.4	toute		355	8	73	3.5	reference	Féculents & Céréales
ing-mrtfiizq-sw3cb	Poudre d'amandes	kg	11	toute		600	21	9	53	reference	Fruits secs & Oléagineux
ing-mrtfiizq-p8lo6	Poudre de noisettes	kg	23.95	toute		660	15	7	61	reference (corrigé)	Fruits secs & Oléagineux
ing-mrtfiizq-lnhqs	Amandes	kg	9.99	toute		620	21	9	53	reference	Fruits secs & Oléagineux
ing-mrtfiizq-y9rce	Noisettes	kg	12.98	toute		660	15	7	61	reference	Fruits secs & Oléagineux
ing-mrtfiizq-4y4s1	Pistache	kg	63.4	toute		580	20	28	45	reference	Fruits secs & Oléagineux
ing-mrtfiizq-c89e1	noix	kg	12.9	toute		690	15	14	65	reference	Fruits secs & Oléagineux
ing-mrtfiizq-vuv3p	Noix pécan	kg	22.95	toute		690	9	14	72	reference	Fruits secs & Oléagineux
ing-mrtfiizq-514c2	Bicarbonate de soude	kg	2.2	toute		0	0	0	0	reference (corrigé)	Épicerie sucrée & Pâtisserie
ing-mrtfiizq-r6u4l	Chocolat lait	kg	18.76	toute		535	7.5	59	30	reference (corrigé)	Épicerie sucrée & Pâtisserie
ing-mrtfiizr-o2vw0	Chocolat noir	kg	11.45	toute		550	7	46	38	reference (corrigé)	Épicerie sucrée & Pâtisserie
ing-mrtfiizr-gjvcf	Chocolat blanc	kg	10.38	toute		539	6	59	32	reference (corrigé)	Épicerie sucrée & Pâtisserie
ing-mrtfiizr-qiiwb	Levure boulangère	kg	45.45	toute		325	40	38	6	reference	Épicerie sucrée & Pâtisserie
ing-mrtfiizr-xm0dq	Levure chimique	kg	11.81	toute		85	1	22	0.7	reference	Épicerie sucrée & Pâtisserie
ing-mrtfiizr-v17y6	Huile olive	l	15.96	toute		884	0	0	100	estimation	Matières grasses
ing-mrtfiizr-1xg4d	Huile tournesol	l	5.19	toute		884	0	0	100	estimation	Matières grasses
ing-mrtfiizr-kl1r9	Noix de cajou	kg	12.99	toute		580	18	30	44	reference	Fruits secs & Oléagineux
ing-mrtfiizr-z4wom	cacahuètes	kg	5	toute		570	26	16	49	reference	Fruits secs & Oléagineux
ing-mrtfiizr-0q4zh	Beurre de cacahuète	kg	7.8	toute		600	25	14	50	reference (corrigé)	Fruits secs & Oléagineux
ing-mrtfiizr-xfzux	Purée de tomates	kg	1.5	toute		35	1.5	6	0.3	reference (corrigé)	Condiments & Sauces
ing-mrtfiizr-woxby	Chapelure	kg	3.96	toute		380	13	72	5	reference	Féculents & Céréales
ing-mrtfiizr-dz0uy	Cacao non sucré	kg	13.8	toute		350	20	14	21	reference (corrigé)	Épicerie sucrée & Pâtisserie
ing-mrtfiizs-d0q0i	Farine	kg	0.85	toute		364	10	76	1	estimation	Féculents & Céréales
ing-mrtfiizs-0rw97	Sucre cristal	kg	1.89	toute		400	0	100	0	estimation	Épicerie sucrée & Pâtisserie
ing-mrtfiizs-oped9	sucre glace	kg	3	toute		400	0	100	0	estimation	Épicerie sucrée & Pâtisserie
ing-mrtfiizs-ycz6e	maizena	kg	3.67	toute		350	0.3	85	0.1	reference	Épicerie sucrée & Pâtisserie
ing-mrtfiizs-8wf58	Flocon d'avoines	kg	1.8	toute		370	13	60	7	reference	Féculents & Céréales
ing-mrtfiizs-l4yy7	Quinoa	kg	7.22	toute		368	14	64	6	reference	Féculents & Céréales
ing-mrtfiizs-3d5in	Compote de pommes	kg	1.57	toute		50	0.2	12	0.1	reference	Fruits
ing-mrtfiizs-pk0a1	Tomates séchées	kg	15.47	toute		230	5	13	18	reference (corrigé)	Légumes
ing-mrtfiizs-cpvfh	Cornflakes non sucrés	kg	3.8	toute		378	7	84	0.9	reference (corrigé)	Féculents & Céréales
ing-mrtfiizs-59n6r	wraps	pièce	2.65	toute		300	8	49	7	reference	Féculents & Céréales
ing-mrtfiizs-7h5io	Feuilles de lasagnes	kg	2.9	toute		350	12	70	1.5	reference (corrigé)	Féculents & Céréales
ing-mrtfiizs-xw3lf	Haricots rouges	kg	2.5	toute		333	22	60	1.5	reference	Légumineuses
ing-mrtfiizt-fisgq	Feuilles de riz	pièce	2.5	toute		333	5	82	0.5	reference (corrigé)	Féculents & Céréales
ing-mrtfiizt-6ubkl	Haricots mungo	kg	03.08	toute		347	24	63	1.2	reference	Légumineuses
ing-mrtfiizt-1nhm0	pâte farcie	kg	6.33	toute		280	12	40	8	reference	Féculents & Céréales
ing-mrtfiizt-pohfu	vermiselles de riz	kg	9.4	toute		360	6	84	0.5	reference (corrigé)	Féculents & Céréales
ing-mrtfiizt-vye3u	Tomates	kg	3.99	été		18	0.9	3.9	0.2	estimation	Légumes
ing-mrtfiizt-sorzq	carottes	kg	1.79	toute		41	0.9	10	0.2	estimation	Légumes
ing-mrtfiizt-6t72r	salade	pièce	0.99	printemps-été		15	1.4	2.9	0.2	reference	Légumes
ing-mrtfiizt-ea09u	oignons	kg	1.97	toute		40	1.1	9	0.1	estimation	Légumes
ing-mrtfiizt-5w2ya	ail	kg	2.99	toute		149	6.4	33	0.5	estimation	Légumes
ing-mrtfiizu-jjm81	aubergine	kg	3.4	été		25	1	6	0.2	reference	Légumes
ing-mrtfiizu-wx7ui	concombre	pièce	1.99	été		15	0.7	3.6	0.1	reference	Légumes
ing-mrtfiizu-pdtfp	avocat	pièce	1.7	toute		160	2	9	15	reference	Légumes
ing-mrtfiizu-fq96j	Brocolis	kg	4.99	automne-hiver		34	2.8	7	0.4	reference	Légumes
ing-mrtfiizu-ac6xy	Poivrons	kg	3.9	été		26	1	6	0.3	reference	Légumes
ing-mrtfiizu-rwq8m	betteraves	kg	3.99	automne-hiver		43	1.6	10	0.2	reference	Légumes
ing-mrtfiizu-qu542	Gingembre	kg	4.99	toute		80	1.8	18	0.8	reference	Légumes
ing-mrtfiizu-6u7h5	Patate douce	kg	2.79	automne-hiver		77	2	17	0.1	estimation	Légumes
ing-mrtfiizv-pactq	choux rouge	pièce	2.88	automne-hiver		31	1.4	7	0.2	reference	Légumes
ing-mrtfiizv-da093	Courgette	pièce	1.66	été		17	1.2	3.1	0.3	estimation	Légumes
ing-mrtfiizv-e7hhk	échalotte	pièce	1.59	toute		72	2.5	17	0.1	reference	Légumes
ing-mrtfiizv-l9ax7	Lentilles corails	pièce	6.4	toute		350	24	60	1.5	reference (corrigé)	Légumineuses
ing-mrtfiizv-aavko	bettenut	pièce	3.95	automne-hiver		45	1	12	0.1	reference	Légumes
ing-mrtfiizv-yzcn9	potimaron	pièce	2.99	automne-hiver		50	1.4	10	0.4	reference	Légumes
ing-mrtfiizv-ag4os	potiron	pièce	4.39	automne-hiver		26	1	5	0.1	reference	Légumes
ing-mrtfiizv-9bt3n	Oignons rouges	pièce	3.39	toute		40	1.1	9	0.1	estimation	Légumes
ing-mrtfiizw-5z3ug	haricots verts	pièce	3	été		31	1.8	7	0.2	reference	Légumes
ing-mrtfiizw-ehhn3	Pois chiche	pièce	2.25	toute		364	19	61	6	reference	Légumineuses
ing-mrtfiizw-uygwd	Miel	kg	9.95	toute		320	0.3	80	0	reference	Épicerie sucrée & Pâtisserie
ing-mrtfiizw-ss4m1	petits pois	kg	2.1	printemps		81	5.4	14	0.4	reference	Légumes
ing-mrtfiizw-1vogc	Banane	kg	1.79	toute		89	1.1	23	0.3	estimation	Fruits
ing-mrtfiizw-zuue4	Fraises	kg	12.91	printemps-été		33	0.7	8	0.3	reference	Fruits
ing-mrtfiizw-d5o03	Framboises	kg	18	été		52	1.2	12	0.7	reference	Fruits
ing-mrtfiizw-y9snj	Mures	kg	19.92	été		43	1.4	10	0.5	reference	Fruits
ing-mrtfiizw-elen5	Groseille	kg	27.92	été		56	1.4	14	0.2	reference	Fruits
ing-mrtfiizx-ax6l3	Myrtilles	kg	18.6	été		57	0.7	14	0.3	reference	Fruits
ing-mrtfiizx-x7zyk	Kiwi	pièce	0.7	hiver		61	1.1	15	0.5	reference	Fruits
ing-mrtfiizx-h0i5o	nectarines	kg	3.99	été		44	1.1	11	0.3	reference	Fruits
ing-mrtfiizx-lr3kh	abricots	kg	8.7	été		48	1.4	11	0.4	reference	Fruits
ing-mrtfiizx-z898v	Pommes	kg	2.25	automne-hiver		52	0.3	14	0.2	reference	Fruits
ing-mrtfiizx-pf0j9	Poires	kg	03.06	automne		57	0.4	15	0.1	reference	Fruits
ing-mrtfiizx-mf8xq	Raisins	kg	3.99	automne		69	0.7	18	0.2	reference	Fruits
ing-mrtfiizx-4jik8	Prunes	kg	3.99	été		46	0.7	11	0.3	reference	Fruits
ing-mrtfij01-pq4vy	Cerises	kg	7.99	été		63	1	16	0.2	reference	Fruits
ing-mrtfij01-utm2m	Mangue	pièce	2.99	toute		60	0.8	15	0.4	reference	Fruits
ing-mrtfij01-enwx9	Citron jaunes	kg	3.32	hiver		29	1.1	9	0.3	estimation	Fruits
ing-mrtfij01-nfmkd	oranges	kg	2.99	hiver		47	0.9	12	0.1	reference	Fruits
ing-mrtfij01-t1e1h	Citron verts	kg	9.9	toute		29	1.1	9	0.3	estimation	Fruits
ing-mrtfij01-32kpb	lait noisettes	l	1.75	toute		30	0.5	3	1.6	reference (corrigé)	Boissons végétales
ing-mrtfij01-8knnj	Lait amandes	l	1.55	toute		24	0.5	3	1.1	reference (corrigé)	Boissons végétales
ing-mrtfij01-hnodu	crème amandes	kg	5.98	toute		38	0.6	5.4	1.4	wger	Boissons végétales
ing-mrtfij01-5mbem	crème soja	kg	4.2	toute		130	3	3	12	reference (corrigé)	Boissons végétales
ing-mrtfij01-wpmvb	margarine	kg	2.6	toute		720	0.2	0.7	80	reference	Matières grasses
ing-mrtfij01-6nduh	alpro	kg	3.7	toute		50	4	4	2	reference	Boissons végétales
ing-mrtfij01-wke7c	Lait coco	l	10	toute		190	2	3	20	reference (corrigé)	Boissons végétales
ing-mrtfij01-8twpa	Crème coco	l	5.5	toute		230	2	6	24	reference	Boissons végétales
ing-mrtfij01-418w2	Lardons fumés	kg	23	toute		330	15	0.5	30	reference	Viande
ing-mrtfij01-4wfwp	lardon natures	kg	16.6	toute		330	15	0.5	30	reference	Viande
ing-mrtfij02-n9pae	Jambon cuit	kg	12.2	toute		145	21	1	6	estimation	Viande
ing-mrtfij02-ub93k	Jambon sec	kg	33.3	toute		240	27	0.5	14	reference (corrigé)	Viande
ing-mrtfij02-8dr5q	bacon	kg	20.8	toute		250	17	0.5	20	reference	Viande
ing-mrtfij02-brbqc	viandes hachées 5% MG	kg	14.7	toute		130	21	0	5	reference	Viande
ing-mrtfij02-dg1s6	Steak	kg	20.15	toute		250	26	0	17	estimation	Viande
ing-mrtfij02-ra4br	Blanc de poulet	kg	18.8	toute		120	23	0	2.6	reference (corrigé)	Viande
ing-mrtfij02-rcfxg	Cuisse de poulet	kg	6.25	toute		180	18	0	11	reference (corrigé)	Viande
ing-mrtfij02-svl9c	Saumon fumé	kg	57.8	toute		180	20	0	11	estimation	Poisson & Fruits de mer
ing-mrtfij02-9htrx	pavé saumon	kg	49.9	toute		200	20	0	13	reference (corrigé)	Poisson & Fruits de mer
ing-mrtfij02-zikc7	pavé truites	kg	34.9	toute		140	20	0	6	reference	Poisson & Fruits de mer
ing-mrtfij02-hfzup	cabillaud	kg	44.5	toute		82	18	0	0.7	reference	Poisson & Fruits de mer
ing-mrtfij02-3sr6m	crevettes	kg	12.5	toute		90	20	0.5	1	reference	Poisson & Fruits de mer
ing-mrtfij03-d4u6v	Thon	kg	13.03	toute		110	25	0	1	reference	Poisson & Fruits de mer
ing-mrtfij03-4vfyn	Tofu	kg	8.9	toute		120	12	2	7	reference	Légumineuses
ing-mrtfij03-bhoab	Viandes divers	kg		toute							Viande
ing-mrtfij03-fuibb	Poivre	kg	43.33	toute		0	0	0	0	estimation	Épices & Aromates
ing-mrtfij03-ilhwy	Sel	kg	0.97	toute		0	0	0	0	estimation	Épices & Aromates
ing-mrtfij03-9ljf7	paprika	kg	24.25	toute		0	0	0	0	estimation	Épices & Aromates
ing-mrtfij03-cv6jw	Curcuma	kg	22	toute		0	0	0	0	reference	Épices & Aromates
ing-mrtfij03-an74l	Coriandre poudre	kg	19.1	toute		0	0	0	0	reference	Épices & Aromates
ing-mrtfij03-402vm	menthe	pièce	0.99	été		0	0	0	0	reference	Épices & Aromates
ing-mrtfij04-40u76	Ciboulette	pièce	0.99	printemps-été		0	0	0	0	reference	Épices & Aromates
ing-mrtfij04-2kxl2	Sauce soja	l	5.99	toute		60	6	6	0	reference	Condiments & Sauces
ing-mrtfij04-7n2wq	Huile sésame	l	18.76	toute		884	0	0	100	estimation	Matières grasses
ing-mrtfij04-hd19b	Curry poudre	kg	14	toute		0	0	0	0	reference	Épices & Aromates
ing-mrtfij04-no41c	Pâte de curry rouge	kg	21.45	toute		120	3	15	5	reference	Condiments & Sauces
ing-mrtfij04-wweib	Bouillons de légumes	kg	23	toute		230	9	22	12	reference	Condiments & Sauces
ing-mrtfij04-wbpkr	Vin blanc	l	4	toute		82	0.1	2.6	0	reference	Vins & Alcools
ing-mrtfij04-ocgw3	Vin rouge	l	9	toute		85	0.1	2.6	0	reference	Vins & Alcools
ing-mrtfij04-ubxa0	épices mexicaines	kg	59.75	toute		0	0	0	0	reference	Épices & Aromates
ing-mrtfij04-etval	Thym	kg	38	toute		0	0	0	0	estimation	Épices & Aromates
ing-mrtfij04-w6rnv	Herbes de provences	kg	32	toute		0	0	0	0	estimation	Épices & Aromates
ing-mrtfij04-tgsxv	Muscade	kg	66.45	toute		0	0	0	0	reference	Épices & Aromates
ing-mrtfij04-ka5jm	canelle	kg	49.9	toute		0	0	0	0	reference	Épices & Aromates
ing-mrtfij04-4suzc	Vanille	kg	125	toute		0	0	0	0	reference	Épicerie sucrée & Pâtisserie
ing-mrtfij04-k5r8w	Sauce BBQ Fumée	kg	4.4	toute		170	1	40	0.5	reference	Condiments & Sauces
ing-mrtfij04-hr5x8	Sauce teriyaki	l	40	toute		90	3	16	0	reference	Condiments & Sauces
ing-mrtfij04-27x9t	Moutarde	kg	2.67	toute		110	6	5	7	reference	Condiments & Sauces
ing-mrtfij04-pma9h	basilic	pièce	0.99	été		0	0	0	0	estimation	Épices & Aromates
`.trim()

function parseTsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const headers = lines[0].split('\t')
  return lines.slice(1).map((line) => {
    const cols = line.split('\t')
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = cols[i] ?? ''
    })
    return obj
  })
}

async function main() {
  const catalog = parseTsv(RAW)
  console.log(`Catalogue parsé: ${catalog.length} lignes`)

  const sheets = getSheetsClient()
  await ensureHeaders(sheets, SHEETS.ingredients)
  const { rows: existing } = await readSheetObjects(sheets, 'ingredients')
  const byId = new Map(catalog.map((r) => [r.idIngr, r]))
  const byName = new Map(
    catalog.map((r) => [String(r.nomIngr || '').trim().toLowerCase(), r]),
  )

  const merged = existing.map((row) => {
    const patch = byId.get(row.idIngr) || byName.get(String(row.nomIngr || '').trim().toLowerCase())
    if (!patch) return { ...row, categorie: row.categorie || '' }
    return {
      ...row,
      ...patch,
      idIngr: row.idIngr || patch.idIngr,
    }
  })

  // Ajoute les entrées catalogue absentes
  const existingIds = new Set(merged.map((r) => r.idIngr))
  const existingNames = new Set(
    merged.map((r) => String(r.nomIngr || '').trim().toLowerCase()),
  )
  for (const item of catalog) {
    const key = String(item.nomIngr || '').trim().toLowerCase()
    if (existingIds.has(item.idIngr) || existingNames.has(key)) continue
    merged.push(item)
  }

  await rewriteSheet(sheets, 'ingredients', merged)
  const cats = new Set(merged.map((r) => r.categorie).filter(Boolean))
  console.log(`OK — ${merged.length} ingrédients, ${cats.size} catégories`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
