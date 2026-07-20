<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import ConfirmDialog from 'primevue/confirmdialog'
import { useSheetsStore } from '@/stores/sheets'
import { useRecipesStore } from '@/stores/recipes'
import { typeLabel } from '@/utils/recipe'

const sheets = useSheetsStore()
const recipes = useRecipesStore()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const deletingId = ref(null)

function editRecipe(id) {
  router.push(`/ajout/${id}`)
}

function askDelete(recipe) {
  confirm.require({
    message: `Supprimer « ${recipe.nomRecette} » ? Cette action est définitive.`,
    header: 'Supprimer la recette',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Annuler',
    acceptLabel: 'Supprimer',
    acceptClass: 'p-button-danger',
    accept: async () => {
      deletingId.value = recipe.idRecette
      try {
        await sheets.deleteRecipe(recipe.idRecette)
        toast.add({
          severity: 'success',
          summary: 'Recette supprimée',
          detail: recipe.nomRecette,
          life: 2800,
        })
      } catch {
        toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Impossible de supprimer. Réessaie.',
          life: 3500,
        })
      } finally {
        deletingId.value = null
      }
    },
  })
}

onMounted(() => {
  sheets.ensureLoaded().catch(() => {})
})
</script>

<template>
  <section class="cm-shell page">
    <ConfirmDialog />

    <header class="head cm-rise">
      <div>
        <p class="eyebrow">Carnet</p>
        <h1 class="cm-display cm-grad-text">Gérer les recettes</h1>
        <p class="lede">Modifie ou supprime les plats du groupe.</p>
      </div>
      <Button
        label="Nouvelle recette"
        icon="pi pi-plus"
        class="cm-btn-warm"
        rounded
        @click="router.push('/ajout')"
      />
    </header>

    <Message v-if="sheets.error" severity="error">
      Impossible de charger les recettes. Réessaie dans un instant.
    </Message>

    <div v-if="sheets.loading && !sheets.lastFetchedAt" class="loading">
      <ProgressSpinner :strokeWidth="3" />
    </div>

    <div v-else-if="!recipes.all.length" class="empty cm-rise">
      <p>Aucune recette pour l’instant.</p>
      <Button label="Ajouter la première" class="cm-btn-cool" rounded @click="router.push('/ajout')" />
    </div>

    <div v-else class="list">
      <article
        v-for="(recipe, i) in recipes.all"
        :key="recipe.idRecette"
        class="row cm-rise"
        :class="`cm-rise-delay-${(i % 3) + 1}`"
      >
        <button type="button" class="row-main" @click="router.push(`/recette/${recipe.idRecette}`)">
          <div class="tags">
            <Tag :value="typeLabel(recipe.type)" rounded />
            <Tag v-if="recipe.mood" :value="recipe.mood" severity="secondary" rounded />
          </div>
          <h2>{{ recipe.nomRecette }}</h2>
          <p>
            <span v-if="recipe.tps">{{ recipe.tps }}</span>
            <span v-if="recipe.difficulte">{{ recipe.difficulte }}</span>
            <span v-if="recipe.allergie">⚠ {{ recipe.allergie }}</span>
          </p>
        </button>
        <div class="actions">
          <Button
            icon="pi pi-pencil"
            rounded
            text
            aria-label="Modifier"
            @click="editRecipe(recipe.idRecette)"
          />
          <Button
            icon="pi pi-trash"
            rounded
            text
            severity="danger"
            aria-label="Supprimer"
            :loading="deletingId === recipe.idRecette"
            @click="askDelete(recipe)"
          />
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.page {
  padding-top: 1.4rem;
  padding-bottom: 2rem;
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-end;
  margin-bottom: 1.2rem;
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
  font-size: clamp(1.9rem, 4vw, 2.8rem);
}

.lede {
  margin: 0.45rem 0 0;
  color: var(--cm-muted);
}

.list {
  display: grid;
  gap: 0.7rem;
}

.row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.35rem;
  border-radius: 1.15rem;
  border: 1px solid var(--cm-border);
  background: var(--cm-surface);
}

.row-main {
  text-align: left;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0.85rem 1rem;
  min-width: 0;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.4rem;
}

h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
}

.row-main p {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin: 0.35rem 0 0;
  color: var(--cm-muted);
  font-size: 0.88rem;
}

.actions {
  display: flex;
  padding-right: 0.35rem;
}

.loading,
.empty {
  display: grid;
  place-items: center;
  gap: 0.85rem;
  padding: 2.5rem 1rem;
  color: var(--cm-muted);
}

@media (max-width: 640px) {
  .head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
