<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import Dialog from 'primevue/dialog'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { useSheetsStore } from '@/stores/sheets'
import { useRecipesStore } from '@/stores/recipes'
import { useMenuStore } from '@/stores/menu'
import {
  RECIPE_TYPES,
  LUNCH_COURSE_TYPES,
  SLOT_META,
  SPICE_LEVELS,
  typeLabel,
  dietLabels,
  spiceLevel,
} from '@/utils/recipe'
import { copyShoppingList } from '@/composables/useShoppingList'
import { downloadMenuPdf } from '@/composables/useRecipePdf'
import { useScrollReveal } from '@/composables/useScrollReveal'
import SpicePeppers from '@/components/SpicePeppers.vue'

const sheets = useSheetsStore()
const recipes = useRecipesStore()
const menu = useMenuStore()
const toast = useToast()

const addOpen = ref(false)
const pickType = ref(null)
const pickRecipe = ref(null)
const replaceType = ref(null)
const generating = ref(false)
const genPhraseIndex = ref(0)
const rerolling = ref(null)
const wizardStep = ref(0)
const stepAnimKey = ref(0)
const phrasePick = ref(0)
const wordsReady = ref(0)
const mealRowEls = ref([])

const WIZARD_STEPS = [
  {
    id: 'personnes',
    titles: ['Pour combien ?', 'Combien autour de la table ?', 'On accueille qui ?'],
    hints: [
      'Le nombre de convives pour calibrer quantités et coûts.',
      'On ajuste portions et budget d’un coup d’œil.',
      'Plus on est de fous… plus on dose juste.',
    ],
  },
  {
    id: 'jours',
    titles: ['Sur combien de jours ?', 'On prévoit jusqu’à quand ?', 'Quelle fenêtre de menus ?'],
    hints: [
      'On prépare un menu jour par jour.',
      'Du week-end express à la semaine complète.',
      'Chaque jour aura ses repas, sans te répéter trop.',
    ],
  },
  {
    id: 'repas',
    titles: ['Quels repas ?', 'On compose quels moments ?', 'Petit-déj, midi, soir ?'],
    hints: [
      'Choisis ce qu’on doit composer chaque jour.',
      'Coche seulement ce qui compte vraiment.',
      'Moins de cases = un planning plus léger.',
    ],
  },
  {
    id: 'ambiance',
    titles: ['Quelle ambiance ?', 'Quel vibe pour la table ?', 'Une humeur culinaire ?'],
    hints: [
      'Optionnel — pour orienter le style des plats.',
      'Cosy, été, comfort food… à toi de voir.',
      'Laisse vide si tu veux rester ouvert.',
    ],
  },
  {
    id: 'epice',
    titles: ['Jusqu’à quel niveau d’épice ?', 'On ose le piment ?', 'Ta zone de confort pimentée ?'],
    hints: [
      'On restera dans ta zone de confort pimentée.',
      'Du tout doux au feu contrôlé — tu choisis le plafond.',
      'Pas de surprise brûlante si tu ne le veux pas.',
    ],
  },
  {
    id: 'regime',
    titles: ['Un régime particulier ?', 'Végé, vegan, ou libre ?', 'Des filtres assiette ?'],
    hints: [
      'Végétarien, vegan, ou aucun filtre.',
      'On ne proposera que ce qui colle à ton assiette.',
      'Sans contrainte ? Passe tout droit.',
    ],
  },
  {
    id: 'allergies',
    titles: ['Des allergies à éviter ?', 'Des non-négociables santé ?', 'Ingrédients à écarter ?'],
    hints: [
      'On écartera les recettes concernées.',
      'Mieux vaut prévenir que soigner — on filtre pour toi.',
      'Rien à signaler ? Continue sans rien cocher.',
    ],
  },
  {
    id: 'budget',
    titles: ['Un budget par jour ?', 'On garde l’œil sur la note ?', 'Plafond wallet du jour ?'],
    hints: [
      'Laisse vide si tu préfères sans limite.',
      'Un montant pour guider les choix, sans stress.',
      'On privilégiera les assiettes dans ton enveloppe.',
    ],
  },
]

const GEN_PHRASES = [
  'On ouvre le carnet…',
  'On dose les portions…',
  'On croise ambiances & assiettes…',
  'On évite les doublons…',
  'On vérifie le piment…',
  'Presque prêt — dernière touche…',
]

const currentWizard = computed(() => WIZARD_STEPS[wizardStep.value])
const wizardProgress = computed(() => ((wizardStep.value + 1) / WIZARD_STEPS.length) * 100)

const liveTitle = computed(() => {
  const titles = currentWizard.value?.titles || ['']
  return titles[phrasePick.value % titles.length]
})
const liveHint = computed(() => {
  const hints = currentWizard.value?.hints || ['']
  return hints[phrasePick.value % hints.length]
})
const titleWords = computed(() =>
  String(liveTitle.value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean),
)
const hintWords = computed(() =>
  String(liveHint.value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean),
)
const liveGenPhrase = computed(() => GEN_PHRASES[genPhraseIndex.value % GEN_PHRASES.length])

let wordTimer = null
let genPhraseTimer = null

function stopWordReveal() {
  if (wordTimer) {
    clearInterval(wordTimer)
    wordTimer = null
  }
}

function startWordReveal() {
  stopWordReveal()
  wordsReady.value = 0
  const total = titleWords.value.length + hintWords.value.length
  if (!total) return
  wordTimer = window.setInterval(() => {
    if (wordsReady.value >= total) {
      stopWordReveal()
      return
    }
    wordsReady.value += 1
  }, 48)
}

/** Tire une formulation au hasard pour l’étape courante (pas de rotation). */
function pickStepPhrase() {
  stopWordReveal()
  const titles = currentWizard.value?.titles || ['']
  phrasePick.value = Math.floor(Math.random() * Math.max(1, titles.length))
  wordsReady.value = 0
  // Laisse le DOM peindre la carte, puis révèle mot à mot
  window.setTimeout(startWordReveal, 40)
}

function titleWordVisible(index) {
  return wordsReady.value > index
}

function hintWordVisible(index) {
  return wordsReady.value > titleWords.value.length + index
}

const { refresh: refreshReveal } = useScrollReveal(mealRowEls, {
  resetOn: () => [menu.activeDay, menu.allSelectedIds.join('|'), menu.nbJours, menu.phase],
})

function onMealTimelineMounted(el) {
  if (!el) {
    mealRowEls.value = []
    return
  }
  mealRowEls.value = [...el.querySelectorAll('.meal-row')]
}

const moodOptions = computed(() =>
  [{ label: 'Toutes les ambiances', value: '' }].concat(
    recipes.moods.map((m) => ({ label: m, value: m })),
  ),
)

const allergyAvoidOptions = computed(() =>
  recipes.allergenOptions.map((a) => ({
    label: a.nomAllergie,
    value: a.nomAllergie,
  })),
)

const selectedAllergies = computed({
  get() {
    return String(menu.allergies || '')
      .split(/[,;/|]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  },
  set(values) {
    menu.allergies = (values || []).join(', ')
  },
})

const activeDay = computed(() => menu.currentDay)

const pickPool = computed(() => {
  let list = recipes.all
  if (pickType.value) list = list.filter((r) => r.type === pickType.value)
  const ids = [
    activeDay.value.petit_dejeuner,
    activeDay.value.entree,
    activeDay.value.plat,
    activeDay.value.dessert,
    activeDay.value.diner,
    ...(activeDay.value.extras || []),
  ]
  return list.filter((r) => !ids.includes(r.idRecette))
})

watch(
  () => menu.nbJours,
  (n) => {
    if (menu.days.length !== Number(n)) menu.setNbJours(n)
  },
)

function goWizard(delta) {
  const next = wizardStep.value + delta
  if (next < 0 || next >= WIZARD_STEPS.length) return
  wizardStep.value = next
  stepAnimKey.value += 1
  pickStepPhrase()
}

function openReplace(type) {
  replaceType.value = type
  pickType.value = type === 'petit_dejeuner' || type === 'diner' ? type : type
  pickRecipe.value = null
  addOpen.value = true
}

function openAddExtra() {
  replaceType.value = null
  pickType.value = null
  pickRecipe.value = null
  addOpen.value = true
}

function confirmPick() {
  if (!pickRecipe.value) return
  if (replaceType.value) {
    menu.setSlot(replaceType.value, pickRecipe.value.idRecette)
  } else {
    menu.addExtra(pickRecipe.value.idRecette)
  }
  addOpen.value = false
}

async function generate() {
  generating.value = true
  genPhraseIndex.value = 0
  stopWordReveal()
  if (genPhraseTimer) clearInterval(genPhraseTimer)
  genPhraseTimer = window.setInterval(() => {
    genPhraseIndex.value += 1
  }, 700)

  await new Promise((r) => setTimeout(r, 2800))
  const result = menu.generateProposals()

  if (genPhraseTimer) {
    clearInterval(genPhraseTimer)
    genPhraseTimer = null
  }
  await new Promise((r) => setTimeout(r, 450))
  generating.value = false
  if (menu.phase === 'wizard') pickStepPhrase()

  if (!result.count) {
    toast.add({
      severity: 'warn',
      summary: 'Pas assez de recettes',
      detail: 'Ajoute des recettes au carnet (petit-déj, plats, desserts…).',
      life: 4000,
    })
    return
  }

  toast.add({
    severity: 'success',
    summary: '3 propositions prêtes',
    detail: 'Choisis celle qui allège le mieux ton panier.',
    life: 3200,
  })
}

function chooseProposal(proposal) {
  if (!menu.selectProposal(proposal)) return
  toast.add({
    severity: 'success',
    summary: proposal.label,
    detail: `${proposal.ingredientCount} ingrédients · ${proposal.totalCost.toFixed(2)} €`,
    life: 2800,
  })
}

async function rollDice(type) {
  rerolling.value = type
  await new Promise((r) => setTimeout(r, 180))
  const picked = menu.rerollSlot(type)
  rerolling.value = null
  if (!picked) {
    toast.add({
      severity: 'warn',
      summary: 'Pas d’alternative',
      detail: `Aucune autre recette pour « ${typeLabel(type)} ».`,
      life: 2800,
    })
    return
  }
  toast.add({
    severity: 'success',
    summary: 'Nouveau tirage',
    detail: picked.nomRecette,
    life: 2200,
  })
}

async function copyList() {
  try {
    await copyShoppingList(menu.shoppingText)
    toast.add({
      severity: 'success',
      summary: 'Liste copiée',
      detail: 'Colle-la où tu veux (WhatsApp, Notes…)',
      life: 2500,
    })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Copie impossible', life: 3000 })
  }
}

async function exportPdf() {
  if (!menu.allSelectedIds.length) return
  await downloadMenuPdf({
    title: `Planning — ${menu.nbJours} jour(s)`,
    personnes: menu.nbPersonnes,
    days: menu.planSummary,
    shoppingList: menu.shoppingList,
    totalCost: menu.totalCost,
    allergies: menu.allergies,
    collectedAllergies: menu.collectedAllergies,
  })
}

function slotRecipe(type) {
  const id = activeDay.value?.[type]
  return id ? recipes.enriched(id, menu.nbPersonnes) : null
}

function backToWizard() {
  menu.setPhase('wizard')
  menu.proposals = []
  wizardStep.value = 0
  stepAnimKey.value += 1
  pickStepPhrase()
}

onMounted(() => {
  sheets.ensureLoaded().catch(() => {})
  menu.setNbJours(menu.nbJours)
  refreshReveal()
  if (menu.phase === 'wizard') pickStepPhrase()
})

onUnmounted(() => {
  stopWordReveal()
  if (genPhraseTimer) clearInterval(genPhraseTimer)
})
</script>

<template>
  <section class="cm-shell page">
    <header class="hero-band cm-rise">
      <div>
        <p class="eyebrow">Planning entre amis</p>
        <h1 class="cm-display">
          <span class="cm-grad-text">
            {{
              menu.phase === 'wizard'
                ? 'Compose ton menu'
                : menu.phase === 'proposals'
                  ? 'Choisis ton planning'
                  : `Menus sur ${menu.nbJours} jour${menu.nbJours > 1 ? 's' : ''}`
            }}
          </span>
        </h1>
        <p class="lede">
          {{
            menu.phase === 'wizard'
              ? 'Réponds aux questions, on s’occupe du reste.'
              : menu.phase === 'proposals'
                ? 'Trois options optimisées pour alléger la liste de courses.'
                : 'Relance un repas au hasard, remplace une idée, ou repars du questionnaire.'
          }}
        </p>
      </div>
      <Button
        v-if="menu.phase === 'plan' || menu.phase === 'proposals'"
        label="Nouveau questionnaire"
        icon="pi pi-replay"
        outlined
        rounded
        @click="backToWizard"
      />
    </header>

    <Message v-if="sheets.error" severity="error">
      Impossible de charger le planning. Réessaie dans un instant.
    </Message>

    <div v-if="sheets.loading && !sheets.lastFetchedAt" class="loading">
      <ProgressSpinner :strokeWidth="3" />
    </div>

    <template v-else-if="menu.phase === 'wizard'">
      <div class="wizard cm-rise">
        <div class="wizard-progress" aria-hidden="true">
          <div class="wizard-progress-bar" :style="{ width: wizardProgress + '%' }" />
        </div>
        <div class="wizard-steps-dots">
          <button
            v-for="(step, i) in WIZARD_STEPS"
            :key="step.id"
            type="button"
            class="wiz-dot"
            :class="{ active: i === wizardStep, done: i < wizardStep }"
            :aria-label="step.titles?.[0] || step.id"
            @click="wizardStep = i; stepAnimKey += 1; pickStepPhrase()"
          />
        </div>

        <Transition name="wiz-slide" mode="out-in">
          <div :key="stepAnimKey" class="wizard-card">
            <p class="wiz-kicker">Étape {{ wizardStep + 1 }} / {{ WIZARD_STEPS.length }}</p>
            <div class="wiz-copy">
              <h2 class="cm-display wiz-title" :aria-label="liveTitle">
                <span
                  v-for="(word, i) in titleWords"
                  :key="`${stepAnimKey}-t-${i}`"
                  class="wiz-word"
                  :class="{ on: titleWordVisible(i) }"
                >{{ word }}</span>
              </h2>
              <p class="wiz-hint" :aria-label="liveHint">
                <span
                  v-for="(word, i) in hintWords"
                  :key="`${stepAnimKey}-h-${i}`"
                  class="wiz-word wiz-word--hint"
                  :class="{ on: hintWordVisible(i) }"
                >{{ word }}</span>
              </p>
            </div>

            <div v-if="currentWizard.id === 'personnes'" class="wiz-answer big-number wiz-answer-anim">
              <InputNumber v-model="menu.nbPersonnes" :min="1" :max="30" showButtons />
              <span class="wiz-unit">personne{{ menu.nbPersonnes > 1 ? 's' : '' }}</span>
            </div>

            <div v-else-if="currentWizard.id === 'jours'" class="wiz-answer big-number wiz-answer-anim">
              <InputNumber v-model="menu.nbJours" :min="1" :max="14" showButtons />
              <span class="wiz-unit">jour{{ menu.nbJours > 1 ? 's' : '' }}</span>
            </div>

            <div v-else-if="currentWizard.id === 'repas'" class="wiz-answer meal-picks">
              <button
                type="button"
                class="meal-toggle wiz-pop"
                style="--pop-delay: 0.05s"
                :class="{ on: menu.includePetitDejeuner }"
                @click="menu.includePetitDejeuner = !menu.includePetitDejeuner"
              >
                <i class="pi pi-sun wiz-icon" />
                <span>Petit-déjeuner</span>
              </button>

              <div class="lunch-block wiz-pop" style="--pop-delay: 0.12s">
                <p class="lunch-label">Déjeuner</p>
                <div class="lunch-toggles">
                  <button
                    v-for="(course, ci) in LUNCH_COURSE_TYPES"
                    :key="course"
                    type="button"
                    class="meal-toggle wiz-pop"
                    :style="{ '--pop-delay': `${0.16 + ci * 0.06}s` }"
                    :class="{ on: menu.includeCourses[course] }"
                    @click="menu.toggleCourse(course)"
                  >
                    <i class="pi wiz-icon" :class="SLOT_META[course].icon" />
                    <span>{{ SLOT_META[course].label }}</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                class="meal-toggle wiz-pop"
                style="--pop-delay: 0.36s"
                :class="{ on: menu.includeDiner }"
                @click="menu.includeDiner = !menu.includeDiner"
              >
                <i class="pi pi-moon wiz-icon" />
                <span>Dîner</span>
              </button>
            </div>

            <div v-else-if="currentWizard.id === 'ambiance'" class="wiz-answer wiz-answer-anim">
              <Select
                v-model="menu.mood"
                :options="moodOptions"
                optionLabel="label"
                optionValue="value"
                fluid
                placeholder="Toutes les ambiances"
              />
            </div>

            <div v-else-if="currentWizard.id === 'epice'" class="wiz-answer">
              <div class="spice-wizard">
                <button
                  type="button"
                  class="spice-wiz-btn wiz-pop"
                  style="--pop-delay: 0.04s"
                  :class="{ on: menu.maxSpice === null }"
                  @click="menu.maxSpice = null"
                >
                  Pas de limite
                </button>
                <button
                  v-for="(opt, oi) in SPICE_LEVELS"
                  :key="opt.value"
                  type="button"
                  class="spice-wiz-btn wiz-pop"
                  :style="{ '--pop-delay': `${0.1 + oi * 0.05}s` }"
                  :class="{ on: menu.maxSpice === opt.value }"
                  @click="menu.maxSpice = opt.value"
                >
                  <SpicePeppers class="wiz-icon" :level="opt.value" />
                  <span>{{ opt.label }}</span>
                </button>
              </div>
            </div>

            <div v-else-if="currentWizard.id === 'regime'" class="wiz-answer">
              <div class="diet-wizard">
                <button
                  type="button"
                  class="diet-wiz-btn wiz-pop"
                  style="--pop-delay: 0.04s"
                  :class="{ on: menu.diet === '' }"
                  @click="menu.diet = ''"
                >
                  Aucun
                </button>
                <button
                  type="button"
                  class="diet-wiz-btn wiz-pop"
                  style="--pop-delay: 0.1s"
                  :class="{ on: menu.diet === 'vegetarien' }"
                  @click="menu.diet = 'vegetarien'"
                >
                  Végétarien
                </button>
                <button
                  type="button"
                  class="diet-wiz-btn wiz-pop"
                  style="--pop-delay: 0.16s"
                  :class="{ on: menu.diet === 'vegan' }"
                  @click="menu.diet = 'vegan'"
                >
                  Vegan
                </button>
              </div>
            </div>

            <div v-else-if="currentWizard.id === 'allergies'" class="wiz-answer wiz-answer-anim">
              <MultiSelect
                v-model="selectedAllergies"
                :options="allergyAvoidOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Aucune — ou choisis…"
                display="chip"
                filter
                fluid
              />
            </div>

            <div v-else-if="currentWizard.id === 'budget'" class="wiz-answer big-number wiz-answer-anim">

              <InputNumber
                v-model="menu.budgetParJour"
                :min="0"
                mode="decimal"
                :minFractionDigits="0"
                :maxFractionDigits="2"
                placeholder="Libre"
                showButtons
              />
              <span class="wiz-unit">€ / jour</span>
            </div>
          </div>
        </Transition>

        <div class="wizard-nav">
          <Button
            label="Retour"
            text
            severity="secondary"
            :disabled="wizardStep === 0"
            @click="goWizard(-1)"
          />
          <Button
            v-if="wizardStep < WIZARD_STEPS.length - 1"
            label="Continuer"
            icon="pi pi-arrow-right"
            iconPos="right"
            class="cm-btn-warm"
            rounded
            @click="goWizard(1)"
          />
          <Button
            v-else
            label="Générer le planning"
            icon="pi pi-bolt"
            class="cm-btn-cool"
            rounded
            size="large"
            :loading="generating"
            @click="generate"
          />
        </div>
      </div>
    </template>

    <template v-else-if="menu.phase === 'proposals'">
      <div class="proposals cm-rise">
        <header class="proposals-head">
          <div>
            <p class="eyebrow">Optimisé courses</p>
            <h2 class="cm-display">Trois plannings, un panier plus léger</h2>
            <p class="lede">
              On favorise le partage d’ingrédients entre les repas. Compare le nombre d’articles et le prix estimé.
            </p>
          </div>
          <Button
            label="Relancer"
            icon="pi pi-bolt"
            class="cm-btn-warm"
            rounded
            :loading="generating"
            @click="generate"
          />
        </header>

        <div class="proposal-grid">
          <article
            v-for="(proposal, i) in menu.proposals"
            :key="proposal.id"
            class="proposal-card cm-rise"
            :class="`cm-rise-delay-${(i % 3) + 1}`"
          >
            <div class="proposal-top">
              <span class="proposal-badge" :class="`tone-${proposal.id}`">{{ proposal.label }}</span>
              <span class="proposal-blurb">{{ proposal.blurb }}</span>
            </div>

            <div class="proposal-stats">
              <div class="proposal-stat">
                <span class="proposal-stat-label">Ingrédients</span>
                <strong>{{ proposal.ingredientCount }}</strong>
              </div>
              <div class="proposal-stat">
                <span class="proposal-stat-label">Prix estimé</span>
                <strong>{{ proposal.totalCost.toFixed(2) }} €</strong>
              </div>
              <div class="proposal-stat">
                <span class="proposal-stat-label">Repas</span>
                <strong>{{ proposal.recipeCount }}</strong>
              </div>
            </div>

            <div v-if="proposal.highlights?.length" class="proposal-highlights">
              <p class="proposal-highlights-label">Plats phares</p>
              <ul>
                <li v-for="name in proposal.highlights" :key="name">{{ name }}</li>
              </ul>
            </div>

            <Button
              label="Choisir ce planning"
              icon="pi pi-check"
              class="cm-btn-cool"
              rounded
              fluid
              @click="chooseProposal(proposal)"
            />
          </article>
        </div>
      </div>
    </template>

    <template v-else-if="menu.phase === 'plan'">
      <div class="day-rail cm-rise" role="tablist" aria-label="Jours du planning">
        <button
          v-for="(day, i) in menu.planSummary"
          :key="i"
          type="button"
          class="day-chip"
          :class="{ active: menu.activeDay === i, filled: day.filled > 0 }"
          role="tab"
          :aria-selected="menu.activeDay === i"
          @click="menu.setActiveDay(i)"
        >
          <span class="day-num">J{{ i + 1 }}</span>
          <span class="day-meta">
            <template v-if="day.filled">
              {{ day.cost.toFixed(0) }}€
              <template v-if="day.nutrition?.kcal"> · {{ Math.round(day.nutrition.kcal) }} kcal/pers</template>
            </template>
            <template v-else>—</template>
          </span>
        </button>
      </div>

      <article class="day-panel cm-rise">
        <div class="day-panel-head">
          <div>
            <h2 class="cm-display">Jour {{ menu.activeDay + 1 }}</h2>
            <p class="muted">
              {{ menu.dayCost(menu.activeDay).toFixed(2) }} € estimés
              <template v-if="menu.dayNutrition(menu.activeDay).kcal">
                · {{ Math.round(menu.dayNutrition(menu.activeDay).kcal) }} kcal/pers
              </template>
            </p>
          </div>
          <div class="day-panel-actions">
            <Button icon="pi pi-trash" rounded text severity="secondary" aria-label="Vider le jour" @click="menu.clearDay()" />
            <Button label="Ajouter" icon="pi pi-plus" rounded outlined @click="openAddExtra" />
            <Button label="Autres propositions" icon="pi pi-bolt" class="cm-btn-warm" rounded @click="generate" :loading="generating" />
          </div>
        </div>

        <div :key="menu.activeDay" :ref="onMealTimelineMounted" class="meal-timeline">
          <div
            v-for="(type, idx) in menu.activeSlots"
            :key="`${menu.activeDay}-${type}`"
            class="meal-row cm-reveal"
            :class="`cm-reveal-delay-${(idx % 5) + 1}`"
          >
            <div class="meal-marker" :class="`tone-${SLOT_META[type]?.tone ?? idx}`" />
            <div class="meal-body">
              <div class="meal-label">
                <i class="pi" :class="SLOT_META[type]?.icon || 'pi-circle'" />
                {{ typeLabel(type) }}
              </div>
              <template v-if="slotRecipe(type)">
                <RouterLink :to="`/recette/${slotRecipe(type).idRecette}`" class="meal-card filled">
                  <div>
                    <strong>{{ slotRecipe(type).nomRecette }}</strong>
                    <p>
                      <Tag v-if="slotRecipe(type).mood" :value="slotRecipe(type).mood" severity="secondary" rounded />
                      <Tag
                        v-for="d in dietLabels(slotRecipe(type))"
                        :key="d"
                        :value="d"
                        :severity="d === 'Vegan' ? 'success' : 'info'"
                        rounded
                      />
                      <SpicePeppers
                        v-if="spiceLevel(slotRecipe(type).spiceLevel) > 0"
                        :level="slotRecipe(type).spiceLevel"
                        size="sm"
                      />
                      <Tag v-if="slotRecipe(type).allergie" :value="slotRecipe(type).allergie" severity="warn" rounded />
                      <span>{{ slotRecipe(type).tps || '—' }}</span>
                      <span>{{ slotRecipe(type).cout.toFixed(2) }} €</span>
                    </p>
                  </div>
                </RouterLink>
                <div class="meal-actions">
                  <Button
                    class="dice-btn"
                    rounded
                    text
                    :loading="rerolling === type"
                    aria-label="Tirer au hasard"
                    title="Tirer une autre recette"
                    @click="rollDice(type)"
                  >
                    <svg v-if="rerolling !== type" class="dice-svg" viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" opacity="0.12" />
                      <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="3.25" fill="none" stroke="currentColor" stroke-width="1.5" />
                      <circle cx="8.5" cy="8.5" r="1.35" fill="currentColor" />
                      <circle cx="15.5" cy="8.5" r="1.35" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.35" fill="currentColor" />
                      <circle cx="8.5" cy="15.5" r="1.35" fill="currentColor" />
                      <circle cx="15.5" cy="15.5" r="1.35" fill="currentColor" />
                    </svg>
                  </Button>
                  <Button icon="pi pi-search" rounded text aria-label="Choisir" @click="openReplace(type)" />
                  <Button icon="pi pi-times" rounded text severity="danger" @click="menu.clearSlot(type)" />
                </div>
              </template>
              <div v-else class="meal-empty-row">
                <button type="button" class="meal-card empty" @click="openReplace(type)">
                  Choisir — {{ typeLabel(type).toLowerCase() }}
                </button>
                <Button
                  class="dice-btn"
                  rounded
                  text
                  :loading="rerolling === type"
                  aria-label="Tirer au hasard"
                  title="Tirer une autre recette"
                  @click="rollDice(type)"
                >
                  <svg v-if="rerolling !== type" class="dice-svg" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" opacity="0.12" />
                    <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="3.25" fill="none" stroke="currentColor" stroke-width="1.5" />
                    <circle cx="8.5" cy="8.5" r="1.35" fill="currentColor" />
                    <circle cx="15.5" cy="8.5" r="1.35" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.35" fill="currentColor" />
                    <circle cx="8.5" cy="15.5" r="1.35" fill="currentColor" />
                    <circle cx="15.5" cy="15.5" r="1.35" fill="currentColor" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeDay.extras?.length" class="extras">
          <h3>Extras</h3>
          <div v-for="id in activeDay.extras" :key="id" class="extra-row">
            <RouterLink :to="`/recette/${id}`">
              {{ recipes.byId(id)?.nomRecette }}
              <span class="muted">· {{ typeLabel(recipes.byId(id)?.type) }}</span>
            </RouterLink>
            <Button icon="pi pi-times" rounded text severity="danger" @click="menu.removeExtra(id)" />
          </div>
        </div>
      </article>

      <section class="shopping-dock cm-rise">
        <div v-if="menu.allergies || menu.collectedAllergies.length" class="allergy-banner">
          <strong>Allergies</strong>
          <span v-if="menu.allergies">À éviter : {{ menu.allergies }}</span>
          <span v-if="menu.collectedAllergies.length">
            Dans le menu : {{ menu.collectedAllergies.join(', ') }}
          </span>
        </div>
        <div class="dock-stats">
          <div>
            <span class="stat-label">Total</span>
            <strong class="stat-value">{{ menu.totalCost.toFixed(2) }} €</strong>
          </div>
          <div>
            <span class="stat-label">Courses</span>
            <strong class="stat-value">{{ menu.shoppingList.length }}</strong>
          </div>
        </div>
        <div class="dock-actions">
          <Button
            label="Copier la liste"
            icon="pi pi-copy"
            class="cm-btn-cool"
            rounded
            :disabled="!menu.shoppingList.length"
            @click="copyList"
          />
          <Button
            label="PDF"
            icon="pi pi-file-pdf"
            outlined
            rounded
            :disabled="!menu.allSelectedIds.length"
            @click="exportPdf"
          />
        </div>
        <ul v-if="menu.shoppingList.length" class="shop-preview">
          <li v-for="item in menu.shoppingList.slice(0, 8)" :key="item.idIngr">
            <span>{{ item.nomIngr }}</span>
            <span class="muted">
              {{ Number.isInteger(item.quantite) ? item.quantite : item.quantite.toFixed(1) }}
              {{ item.unite }}
            </span>
          </li>
          <li v-if="menu.shoppingList.length > 8" class="muted">
            + {{ menu.shoppingList.length - 8 }} autres (copie ou PDF)
          </li>
        </ul>
      </section>
    </template>

    <Dialog
      v-model:visible="addOpen"
      modal
      :header="replaceType ? `Remplacer — ${typeLabel(replaceType)}` : 'Ajouter au jour'"
      :style="{ width: 'min(460px, 94vw)' }"
    >
      <div class="dialog-form">
        <div class="field">
          <label>Type</label>
          <Select
            v-model="pickType"
            :options="[{ label: 'Tous', value: null }, ...RECIPE_TYPES]"
            optionLabel="label"
            optionValue="value"
            class="w-full"
            :disabled="Boolean(replaceType)"
          />
        </div>
        <div class="field">
          <label>Recette</label>
          <Select
            v-model="pickRecipe"
            :options="pickPool"
            optionLabel="nomRecette"
            placeholder="Choisir…"
            class="w-full"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Annuler" text severity="secondary" @click="addOpen = false" />
        <Button label="Valider" class="cm-btn-warm" :disabled="!pickRecipe" @click="confirmPick" />
      </template>
    </Dialog>

    <Teleport to="body">
      <Transition name="gen-fade">
        <div v-if="generating" class="gen-overlay" role="status" aria-live="polite">
          <div class="gen-stage">
            <div class="gen-orb gen-orb--a" aria-hidden="true" />
            <div class="gen-orb gen-orb--b" aria-hidden="true" />
            <div class="gen-orb gen-orb--c" aria-hidden="true" />
            <div class="gen-core breathe-strong" aria-hidden="true">
              <i class="pi pi-sparkles" />
            </div>
            <Transition name="phrase-fade" mode="out-in">
              <p :key="genPhraseIndex" class="gen-phrase">{{ liveGenPhrase }}</p>
            </Transition>
            <p class="gen-sub">Composition du planning…</p>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.page {
  padding-top: 1.25rem;
  padding-bottom: 3rem;
}

.hero-band {
  display: flex;
  justify-content: space-between;
  gap: 1.25rem;
  align-items: flex-end;
  margin-bottom: 1.25rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--cm-muted);
}

h1 {
  margin: 0;
  font-size: clamp(1.85rem, 4vw, 2.8rem);
  line-height: 1.05;
}

.lede {
  margin: 0.55rem 0 0;
  max-width: 34rem;
  color: var(--cm-muted);
  line-height: 1.45;
}

/* —— Wizard —— */
.wizard {
  max-width: 40rem;
  margin: 0 auto;
  display: grid;
  gap: 1rem;
}

.wizard-progress {
  height: 0.35rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cm-border) 80%, transparent);
  overflow: hidden;
}

.wizard-progress-bar {
  height: 100%;
  border-radius: inherit;
  background: var(--cm-grad-warm);
  transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.wizard-steps-dots {
  display: flex;
  justify-content: center;
  gap: 0.45rem;
}

.wiz-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  border: 0;
  padding: 0;
  background: var(--cm-border);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, width 0.25s ease;
}

.wiz-dot.active {
  width: 1.4rem;
  background: var(--cm-grad-warm);
}

.wiz-dot.done {
  background: color-mix(in srgb, var(--cm-orange, #ff6b35) 70%, #fff);
}

.wizard-card {
  padding: 1.6rem 1.45rem 1.5rem;
  border-radius: 1.5rem;
  border: 1px solid var(--cm-border);
  background:
    linear-gradient(160deg, color-mix(in srgb, var(--cm-orange) 8%, transparent), transparent 42%),
    var(--cm-surface);
  backdrop-filter: blur(10px);
  min-height: 16rem;
  display: grid;
  align-content: start;
  gap: 0.55rem;
}

.wiz-copy {
  display: grid;
  gap: 0.45rem;
  min-height: 4.6rem;
}

.wiz-kicker {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--cm-muted);
}

.wiz-title {
  margin: 0;
  font-size: clamp(1.6rem, 3.5vw, 2.2rem);
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem 0.38rem;
}

.wiz-hint {
  margin: 0 0 0.75rem;
  color: var(--cm-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.3rem;
  min-height: 1.4em;
}

.wiz-word {
  display: inline-block;
  opacity: 0;
  transform: translateY(0.45em) scale(0.96);
  filter: blur(3px);
  transition:
    opacity 0.22s ease,
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.22s ease;
}

.wiz-word.on {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}

.wiz-word--hint {
  font-weight: 500;
}

.wiz-pop {
  animation: wiz-pop-in 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--pop-delay, 0.08s);
}

.wiz-answer-anim {
  animation: wiz-pop-in 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: 0.12s;
}

.wiz-icon {
  display: inline-flex;
  animation: wiz-icon-pop 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--pop-delay, 0.08s) + 0.04s);
}

@keyframes wiz-pop-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes wiz-icon-pop {
  0% {
    opacity: 0;
    transform: scale(0.4) rotate(-12deg);
  }
  70% {
    opacity: 1;
    transform: scale(1.12) rotate(4deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

.wiz-answer {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.35rem;
}

.spice-wizard,
.diet-wizard {
  display: grid;
  gap: 0.5rem;
}

.spice-wiz-btn,
.diet-wiz-btn {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.7rem 0.9rem;
  border-radius: 0.9rem;
  border: 1px solid var(--cm-border);
  background: var(--cm-surface);
  color: inherit;
  font: inherit;
  font-weight: 650;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}

.spice-wiz-btn:hover,
.diet-wiz-btn:hover {
  border-color: color-mix(in srgb, #c2410c 40%, var(--cm-border));
}

.spice-wiz-btn.on,
.diet-wiz-btn.on {
  border-color: #c2410c;
  box-shadow: 0 0 0 2px color-mix(in srgb, #c2410c 20%, transparent);
  background: color-mix(in srgb, #c2410c 8%, var(--cm-surface));
}

.big-number {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.85rem;
}

.big-number :deep(.p-inputnumber-input) {
  font-size: 1.6rem;
  font-weight: 700;
  width: 6rem;
  text-align: center;
}

.wiz-unit {
  font-size: 1.15rem;
  font-weight: 650;
  color: var(--cm-muted);
}

.meal-picks {
  gap: 0.85rem;
}

.lunch-block {
  display: grid;
  gap: 0.45rem;
  padding: 0.85rem;
  border-radius: 1rem;
  border: 1px dashed var(--cm-border);
  background: color-mix(in srgb, var(--cm-bg) 40%, transparent);
}

.lunch-label {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--cm-muted);
}

.lunch-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.meal-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid var(--cm-border);
  background: transparent;
  color: var(--cm-text);
  border-radius: 999px;
  padding: 0.55rem 0.95rem;
  font-weight: 650;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.meal-toggle:hover {
  transform: translateY(-1px);
}

.meal-toggle.on {
  border-color: transparent;
  background: var(--cm-grad-warm);
  color: #fff;
  box-shadow: 0 10px 22px var(--cm-glow);
}

.wizard-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.proposals {
  display: grid;
  gap: 1.25rem;
}

.proposals-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.proposals-head h2 {
  margin: 0.15rem 0 0.35rem;
  font-size: clamp(1.55rem, 3.2vw, 2.15rem);
}

.proposal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.9rem;
}

.proposal-card {
  display: grid;
  gap: 0.9rem;
  align-content: start;
  padding: 1.15rem 1.1rem 1.2rem;
  border-radius: 1.25rem;
  border: 1px solid var(--cm-border);
  background:
    linear-gradient(165deg, color-mix(in srgb, var(--cm-orange) 7%, transparent), transparent 40%),
    var(--cm-surface);
}

.proposal-top {
  display: grid;
  gap: 0.35rem;
}

.proposal-badge {
  display: inline-flex;
  width: fit-content;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 750;
  color: #fff;
  background: var(--cm-grad-warm);
}

.proposal-badge.tone-compact {
  background: linear-gradient(120deg, #0d9488, #14b8a6);
}

.proposal-badge.tone-balanced {
  background: var(--cm-grad-warm);
}

.proposal-badge.tone-varied {
  background: linear-gradient(120deg, #6366f1, #a78bfa);
}

.proposal-blurb {
  color: var(--cm-muted);
  font-size: 0.88rem;
  font-weight: 600;
}

.proposal-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
}

.proposal-stat {
  display: grid;
  gap: 0.15rem;
  padding: 0.55rem 0.45rem;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--cm-bg) 55%, transparent);
  text-align: center;
}

.proposal-stat-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--cm-muted);
}

.proposal-stat strong {
  font-size: 1.05rem;
  font-family: var(--font-display);
}

.proposal-highlights-label {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--cm-muted);
}

.proposal-highlights ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.3rem;
}

.proposal-highlights li {
  font-size: 0.92rem;
  font-weight: 650;
  padding-left: 0.7rem;
  position: relative;
}

.proposal-highlights li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.55em;
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 999px;
  background: var(--cm-orange, #ff6b35);
}

.wiz-slide-enter-active,
.wiz-slide-leave-active {
  transition: opacity 0.16s ease, transform 0.16s cubic-bezier(0.22, 1, 0.36, 1);
}

.wiz-slide-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.wiz-slide-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

/* —— Plan —— */
.day-rail {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.35rem;
  margin-bottom: 0.85rem;
  scrollbar-width: thin;
}

.day-chip {
  flex: 0 0 auto;
  min-width: 4.4rem;
  padding: 0.65rem 0.75rem;
  border-radius: 1rem;
  border: 1px solid var(--cm-border);
  background: var(--cm-surface);
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.day-chip:hover {
  transform: translateY(-2px);
}

.day-chip.active {
  border-color: transparent;
  background: var(--cm-grad-warm);
  color: #fff;
  box-shadow: 0 12px 28px var(--cm-glow);
}

.day-chip.active .day-meta {
  color: rgba(255, 255, 255, 0.85);
}

.day-num {
  display: block;
  font-weight: 800;
  font-size: 0.95rem;
}

.day-meta {
  font-size: 0.75rem;
  color: var(--cm-muted);
}

.day-panel {
  padding: 1.2rem 1.25rem 1.35rem;
  border-radius: 1.4rem;
  border: 1px solid var(--cm-border);
  background: var(--cm-surface);
  backdrop-filter: blur(10px);
  margin-bottom: 1rem;
}

.day-panel-head {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}

.day-panel-head h2 {
  margin: 0;
  font-size: 1.45rem;
}

.day-panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.muted {
  color: var(--cm-muted);
  margin: 0.2rem 0 0;
}

.meal-timeline {
  display: grid;
  gap: 1.1rem;
  padding-block: 0.35rem 0.75rem;
}

.meal-row {
  display: grid;
  grid-template-columns: 1rem 1fr;
  gap: 0.85rem;
  align-items: stretch;
  min-height: 6.5rem;
}

.meal-body {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  align-items: center;
}

.meal-empty-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.35rem;
  align-items: center;
  grid-column: 1 / -1;
}

.meal-marker {
  width: 0.7rem;
  border-radius: 999px;
  background: var(--cm-grad-warm);
  min-height: 100%;
}

.meal-marker.tone-1 {
  background: var(--cm-grad-cool);
}

.meal-marker.tone-2 {
  background: linear-gradient(180deg, #ff4d8d, #06b6d4);
}

.meal-marker.tone-3 {
  background: linear-gradient(180deg, #fbbf24, #f97316);
}

.meal-marker.tone-4 {
  background: linear-gradient(180deg, #6366f1, #06b6d4);
}

.meal-label {
  grid-column: 1 / -1;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--cm-muted);
  margin-bottom: 0.15rem;
}

.meal-card {
  display: flex;
  align-items: center;
  width: 100%;
  text-align: left;
  padding: 1rem 1.1rem;
  border-radius: 1.15rem;
  border: 1px solid var(--cm-border);
  background: color-mix(in srgb, var(--cm-bg) 55%, transparent);
  min-height: 4.8rem;
  transition: box-shadow 0.35s ease, transform 0.35s ease;
  color: inherit;
  text-decoration: none;
}

.meal-card.filled:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px var(--cm-glow);
}

.meal-card.filled strong {
  font-size: 1.02rem;
}

.meal-card.filled p {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
  margin: 0.4rem 0 0;
  color: var(--cm-muted);
  font-size: 0.88rem;
}

.meal-card.empty {
  border-style: dashed;
  color: var(--cm-muted);
  cursor: pointer;
  min-height: 3.2rem;
}

.meal-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.dice-btn {
  width: 2.4rem;
  height: 2.4rem;
}

.dice-svg {
  width: 1.2rem;
  height: 1.2rem;
  display: block;
}

.dice-btn:active .dice-svg {
  animation: dice-shake 0.35s ease;
}

@keyframes dice-shake {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(-18deg) scale(1.08); }
  75% { transform: rotate(16deg) scale(1.08); }
}

.extras {
  margin-top: 1.1rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--cm-border);
}

.extras h3 {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}

.extra-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.shopping-dock {
  padding: 1.15rem 1.2rem;
  border-radius: 1.35rem;
  border: 1px solid var(--cm-border);
  background:
    linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(6, 182, 212, 0.1)),
    var(--cm-surface);
}

.allergy-banner {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.9rem;
  padding: 0.75rem 0.9rem;
  border-radius: 0.9rem;
  background: rgba(255, 107, 53, 0.12);
  font-size: 0.9rem;
}

.dock-stats {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 0.85rem;
}

.stat-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--cm-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1.45rem;
  font-family: var(--font-display);
}

.dock-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-bottom: 0.85rem;
}

.shop-preview {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}

.shop-preview li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.92rem;
}

.dialog-form {
  display: grid;
  gap: 0.9rem;
}

.field {
  display: grid;
  gap: 0.28rem;
}

.field label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--cm-muted);
}

.w-full {
  width: 100%;
}

.loading {
  display: grid;
  place-items: center;
  padding: 3rem;
}

.gen-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 30% 40%, color-mix(in srgb, #ff6b35 28%, transparent), transparent 42%),
    radial-gradient(circle at 70% 55%, color-mix(in srgb, #2dd4bf 22%, transparent), transparent 45%),
    color-mix(in srgb, #0b1220 78%, transparent);
  backdrop-filter: blur(10px);
}

.gen-stage {
  position: relative;
  width: min(22rem, 86vw);
  min-height: 14rem;
  display: grid;
  place-items: center;
  gap: 0.85rem;
  text-align: center;
}

.gen-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(2px);
  opacity: 0.55;
  animation: gen-orbit 4.8s linear infinite;
}

.gen-orb--a {
  width: 7.5rem;
  height: 7.5rem;
  background: color-mix(in srgb, #ff6b35 55%, transparent);
  animation-duration: 5.4s;
}

.gen-orb--b {
  width: 5.2rem;
  height: 5.2rem;
  background: color-mix(in srgb, #ff4d8d 50%, transparent);
  animation-direction: reverse;
  animation-duration: 4.2s;
}

.gen-orb--c {
  width: 3.4rem;
  height: 3.4rem;
  background: color-mix(in srgb, #2dd4bf 55%, transparent);
  animation-duration: 3.6s;
}

.gen-core {
  position: relative;
  z-index: 1;
  width: 4.2rem;
  height: 4.2rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 1.35rem;
  background: var(--cm-grad-warm);
  box-shadow: 0 12px 36px color-mix(in srgb, #ff6b35 45%, transparent);
}

.breathe-strong {
  animation: wiz-breathe 2.4s ease-in-out infinite;
}

@keyframes wiz-breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}

.gen-phrase {
  position: relative;
  z-index: 1;
  margin: 0.6rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.25rem, 3vw, 1.65rem);
  font-weight: 700;
  color: #fff;
  min-height: 2.2em;
}

.gen-sub {
  position: relative;
  z-index: 1;
  margin: 0;
  color: color-mix(in srgb, #fff 70%, transparent);
  font-size: 0.9rem;
  font-weight: 600;
}

.gen-fade-enter-active,
.gen-fade-leave-active {
  transition: opacity 0.35s ease;
}

.gen-fade-enter-from,
.gen-fade-leave-to {
  opacity: 0;
}

@keyframes gen-orbit {
  0% {
    transform: rotate(0deg) translateX(3.2rem) rotate(0deg) scale(1);
  }
  50% {
    transform: rotate(180deg) translateX(3.2rem) rotate(-180deg) scale(1.12);
  }
  100% {
    transform: rotate(360deg) translateX(3.2rem) rotate(-360deg) scale(1);
  }
}

@media (max-width: 820px) {
  .hero-band {
    flex-direction: column;
    align-items: stretch;
  }

  .meal-body {
    grid-template-columns: 1fr;
  }

  .meal-actions {
    flex-direction: row;
    justify-content: flex-end;
  }

  .proposal-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wiz-slide-enter-active,
  .wiz-slide-leave-active,
  .phrase-fade-enter-active,
  .phrase-fade-leave-active,
  .gen-fade-enter-active,
  .gen-fade-leave-active,
  .dice-btn:active,
  .breathe-strong,
  .gen-orb,
  .wiz-pop,
  .wiz-answer-anim,
  .wiz-icon,
  .wiz-word {
    transition: none !important;
    animation: none !important;
  }

  .wiz-word {
    opacity: 1;
    transform: none;
    filter: none;
  }
}
</style>
