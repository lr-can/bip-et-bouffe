import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import SearchView from '@/views/SearchView.vue'
import MenuView from '@/views/MenuView.vue'
import AddRecipeView from '@/views/AddRecipeView.vue'
import ManageView from '@/views/ManageView.vue'
import RecipeDetailView from '@/views/RecipeDetailView.vue'
import SheetView from '@/views/SheetView.vue'

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/recherche', name: 'search', component: SearchView },
  { path: '/menu', name: 'menu', component: MenuView },
  { path: '/ajout', name: 'add', component: AddRecipeView },
  { path: '/ajout/:id', name: 'edit', component: AddRecipeView, props: true },
  { path: '/gerer', name: 'manage', component: ManageView },
  {
    path: '/recette/:id',
    name: 'recipe',
    component: RecipeDetailView,
    props: true,
  },
  {
    path: '/sheet/:sheetKey',
    name: 'sheet',
    component: SheetView,
    props: true,
  },
]

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
