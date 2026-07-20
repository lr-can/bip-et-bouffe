<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { useSheetsStore } from '@/stores/sheets'

const props = defineProps({
  sheetKey: { type: String, required: true },
})

const store = useSheetsStore()
const toast = useToast()

const labels = {
  recettes: 'Recettes',
  ingredients: 'Ingrédients',
  ingredientsRecette: 'Ingrédients ↔ Recettes',
  allergenes: 'Allergènes',
  etape: 'Étapes',
}

const title = computed(() => labels[props.sheetKey] || props.sheetKey)
const columns = computed(
  () => store.schema?.[props.sheetKey]?.columns || store.headers[props.sheetKey] || [],
)
const rows = computed(() => store.data[props.sheetKey] || [])

const dialogVisible = ref(false)
const mode = ref('create')
const editingRow = ref(null)
const form = reactive({})

function resetForm() {
  columns.value.forEach((col) => {
    form[col] = ''
  })
}

function openCreate() {
  mode.value = 'create'
  editingRow.value = null
  resetForm()
  dialogVisible.value = true
}

function openEdit(row) {
  mode.value = 'edit'
  editingRow.value = row._row
  resetForm()
  columns.value.forEach((col) => {
    form[col] = row[col] ?? ''
  })
  dialogVisible.value = true
}

async function submit() {
  const payload = Object.fromEntries(columns.value.map((c) => [c, form[c] ?? '']))
  try {
    if (mode.value === 'create') {
      await store.addRow(props.sheetKey, payload)
      toast.add({
        severity: 'success',
        summary: 'Ajouté',
        detail: 'Élément ajouté',
        life: 2800,
      })
    } else {
      await store.updateRow(props.sheetKey, editingRow.value, payload)
      toast.add({
        severity: 'success',
        summary: 'Modifié',
        detail: 'Modification enregistrée',
        life: 2800,
      })
    }
    dialogVisible.value = false
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: err.response?.data?.error || err.message,
      life: 4200,
    })
  }
}

async function load() {
  try {
    if (!store.schema) await store.fetchMeta()
    await store.fetchSheet(props.sheetKey)
  } catch {
    /* erreur exposée via store.error */
  }
}

watch(
  () => props.sheetKey,
  () => load(),
)

onMounted(load)
</script>

<template>
  <section class="cm-shell sheet-page">
    <header class="head cm-rise">
      <div>
        <p class="eyebrow">Données</p>
        <h1 class="cm-display cm-grad-text">{{ title }}</h1>
        <p class="meta">
          <Tag :value="`${rows.length} élément(s)`" rounded />
        </p>
      </div>
      <div class="actions">
        <Button
          icon="pi pi-refresh"
          label="Actualiser"
          outlined
          rounded
          :loading="store.loading"
          @click="load"
        />
        <Button
          icon="pi pi-plus"
          label="Ajouter"
          class="cm-btn-warm"
          rounded
          @click="openCreate"
        />
      </div>
    </header>

    <Message v-if="store.error" severity="error" class="cm-rise">{{ store.error }}</Message>

    <div v-if="store.loading && !rows.length" class="loading">
      <ProgressSpinner :strokeWidth="3" />
    </div>

    <div v-else class="table-wrap cm-rise cm-rise-delay-1">
      <DataTable
        :value="rows"
        paginator
        :rows="10"
        stripedRows
        size="small"
        emptyMessage="Rien ici pour le moment — ajoute un premier élément."
      >
        <Column field="_row" header="#" style="width: 4rem" />
        <Column v-for="col in columns" :key="col" :field="col" :header="col" />
        <Column header="" style="width: 7rem">
          <template #body="{ data }">
            <Button
              icon="pi pi-pencil"
              rounded
              text
              severity="secondary"
              aria-label="Modifier"
              @click="openEdit(data)"
            />
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog
      v-model:visible="dialogVisible"
      modal
      :header="mode === 'create' ? `Ajouter — ${title}` : `Modifier`"
      :style="{ width: 'min(520px, 94vw)' }"
    >
      <div class="form">
        <label v-for="col in columns" :key="col" class="field">
          <span>{{ col }}</span>
          <Textarea
            v-if="col === 'texte' || col === 'allergie'"
            v-model="form[col]"
            rows="3"
            autoResize
            class="w-full"
          />
          <InputText v-else v-model="form[col]" class="w-full" />
        </label>
      </div>
      <template #footer>
        <Button label="Annuler" text severity="secondary" @click="dialogVisible = false" />
        <Button
          :label="mode === 'create' ? 'Ajouter' : 'Enregistrer'"
          class="cm-btn-cool"
          :loading="store.saving"
          @click="submit"
        />
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
.sheet-page {
  padding-top: 1.75rem;
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-end;
  margin-bottom: 1.25rem;
}

.eyebrow {
  margin: 0 0 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--cm-muted);
}

h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.05;
}

.meta {
  margin: 0.55rem 0 0;
  color: var(--cm-muted);
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.actions {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.loading {
  display: grid;
  place-items: center;
  padding: 3rem;
}

.table-wrap {
  border: 1px solid var(--cm-border);
  border-radius: 1.1rem;
  overflow: hidden;
  background: var(--cm-surface);
  backdrop-filter: blur(8px);
}

.form {
  display: grid;
  gap: 0.9rem;
}

.field {
  display: grid;
  gap: 0.35rem;
  font-weight: 600;
  font-size: 0.9rem;
}

.w-full {
  width: 100%;
}

@media (max-width: 720px) {
  .head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
