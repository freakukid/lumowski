<script setup lang="ts">
// Catch-all route to suppress Vue Router warnings for WebSocket paths
// This page is never rendered - WebSocket requests are handled by Socket.io server
definePageMeta({
  layout: false,
})

// Redirect away if someone actually navigates here
const router = useRouter()
if (import.meta.client) {
  router.replace('/')
}
</script>

<template>
  <div></div>
</template>
