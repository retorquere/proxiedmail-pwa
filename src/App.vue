<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useThemeStore } from './stores/theme'

// Initialise on app start so the stored preference is applied immediately
useThemeStore()
</script>

<template>
  <RouterView />
</template>
