<template>
  <div class="ui-kit-page">
    <!-- Header -->
    <header class="kit-header">
      <div class="header-container">
        <div>
          <h1 class="header-title">UI Kit</h1>
          <p class="header-subtitle">Reusable component library for Lumowski</p>
        </div>
        <ClientOnly>
          <ThemeSwitcher />
        </ClientOnly>
      </div>
    </header>

    <!-- Mobile Tab Navigation -->
    <nav class="mobile-nav lg:hidden">
      <a
        v-for="section in sections"
        :key="section.id"
        :href="`#${section.id}`"
        class="mobile-nav-link"
      >
        {{ section.name }}
      </a>
    </nav>

    <div class="kit-layout">
      <!-- Sidebar Navigation (Desktop only) -->
      <aside class="kit-sidebar hidden lg:block">
        <nav class="sidebar-nav">
          <a
            v-for="section in sections"
            :key="section.id"
            :href="`#${section.id}`"
            class="nav-link"
          >
            {{ section.name }}
          </a>
        </nav>
      </aside>

      <!-- Main Content -->
      <main class="kit-main">
        <!-- UiButton Section -->
        <section id="buttons" class="section-card">
          <h2 class="section-title">UiButton</h2>
          <p class="section-description">Button component with variants, sizes, loading states, and icon slots</p>

          <!-- Button Variants -->
          <div class="subsection">
            <h3 class="subsection-title">Variants</h3>
            <div class="showcase-grid">
              <div class="showcase-item">
                <span class="showcase-label">Primary</span>
                <UiButton variant="primary">Save Changes</UiButton>
              </div>
              <div class="showcase-item">
                <span class="showcase-label">Secondary</span>
                <UiButton variant="secondary">Cancel</UiButton>
              </div>
              <div class="showcase-item">
                <span class="showcase-label">Danger</span>
                <UiButton variant="danger">Delete</UiButton>
              </div>
              <div class="showcase-item">
                <span class="showcase-label">Ghost</span>
                <UiButton variant="ghost">Learn More</UiButton>
              </div>
            </div>
          </div>

          <!-- Button Sizes -->
          <div class="subsection">
            <h3 class="subsection-title">Sizes</h3>
            <div class="showcase-grid">
              <div class="showcase-item">
                <span class="showcase-label">Small (sm)</span>
                <UiButton size="sm">Small Button</UiButton>
              </div>
              <div class="showcase-item">
                <span class="showcase-label">Medium (md) - Default</span>
                <UiButton size="md">Default Button</UiButton>
              </div>
              <div class="showcase-item">
                <span class="showcase-label">Large (lg)</span>
                <UiButton size="lg">Large Button</UiButton>
              </div>
            </div>
          </div>

          <!-- Button States -->
          <div class="subsection">
            <h3 class="subsection-title">States</h3>
            <div class="showcase-grid">
              <div class="showcase-item">
                <span class="showcase-label">Disabled</span>
                <UiButton disabled>Disabled</UiButton>
              </div>
              <div class="showcase-item">
                <span class="showcase-label">Loading</span>
                <UiButton :loading="true" loading-text="Saving...">Save</UiButton>
              </div>
              <div class="showcase-item">
                <span class="showcase-label">Block (Full Width)</span>
                <UiButton block>Full Width Button</UiButton>
              </div>
            </div>
          </div>

          <!-- Button with Icons -->
          <div class="subsection">
            <h3 class="subsection-title">With Icons</h3>
            <div class="showcase-grid">
              <div class="showcase-item">
                <span class="showcase-label">Icon Left</span>
                <UiButton>
                  <template #icon-left>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </template>
                  Add Item
                </UiButton>
              </div>
              <div class="showcase-item">
                <span class="showcase-label">Icon Right</span>
                <UiButton>
                  Next
                  <template #icon-right>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </template>
                </UiButton>
              </div>
              <div class="showcase-item">
                <span class="showcase-label">Icon Only</span>
                <UiButton icon-only>
                  <template #icon-left>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </template>
                </UiButton>
              </div>
            </div>
          </div>
        </section>

        <!-- UiInput Section -->
        <section id="inputs" class="section-card">
          <h2 class="section-title">UiInput</h2>
          <p class="section-description">Text input with various types, states, and prefix/suffix slots</p>

          <div class="showcase-grid">
            <div class="showcase-item">
              <span class="showcase-label">Default</span>
              <UiInput v-model="inputDemo.default" placeholder="Enter text..." />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">With Value</span>
              <UiInput v-model="inputDemo.withValue" />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">Disabled</span>
              <UiInput v-model="inputDemo.disabled" disabled />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">Error State</span>
              <UiInput v-model="inputDemo.error" :error="true" />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">Success State</span>
              <UiInput v-model="inputDemo.success" :success="true" />
            </div>
          </div>

          <!-- Input Types -->
          <div class="subsection">
            <h3 class="subsection-title">Input Types</h3>
            <div class="showcase-grid">
              <div class="showcase-item">
                <span class="showcase-label">Email</span>
                <UiInput v-model="inputDemo.email" type="email" placeholder="email@example.com" />
              </div>
              <div class="showcase-item">
                <span class="showcase-label">Password</span>
                <UiInput v-model="inputDemo.password" type="password" placeholder="Enter password" />
              </div>
              <div class="showcase-item">
                <span class="showcase-label">Number</span>
                <UiInput v-model="inputDemo.number" type="number" placeholder="0" />
              </div>
              <div class="showcase-item">
                <span class="showcase-label">Date</span>
                <UiInput v-model="inputDemo.date" type="date" />
              </div>
            </div>
          </div>

          <!-- Input with Prefix/Suffix -->
          <div class="subsection">
            <h3 class="subsection-title">With Prefix/Suffix</h3>
            <div class="showcase-grid-2">
              <div class="showcase-item">
                <span class="showcase-label">Prefix Icon</span>
                <UiInput v-model="inputDemo.prefixIcon" placeholder="Search...">
                  <template #prefix>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </template>
                </UiInput>
              </div>
              <div class="showcase-item">
                <span class="showcase-label">Suffix Icon</span>
                <UiInput v-model="inputDemo.suffixIcon" placeholder="Enter amount">
                  <template #suffix>
                    <span class="text-sm font-medium">USD</span>
                  </template>
                </UiInput>
              </div>
            </div>
          </div>
        </section>

        <!-- UiSelect Section -->
        <section id="select" class="section-card">
          <h2 class="section-title">UiSelect</h2>
          <p class="section-description">Select dropdown with options array and placeholder support</p>

          <div class="showcase-grid">
            <div class="showcase-item">
              <span class="showcase-label">Default</span>
              <UiSelect
                v-model="selectDemo.category"
                :options="categoryOptions"
                placeholder="Select a category"
              />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">With Selection</span>
              <UiSelect
                v-model="selectDemo.preselected"
                :options="categoryOptions"
              />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">Disabled</span>
              <UiSelect
                v-model="selectDemo.disabled"
                :options="categoryOptions"
                disabled
              />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">Error State</span>
              <UiSelect
                v-model="selectDemo.error"
                :options="categoryOptions"
                placeholder="Select..."
                :error="true"
              />
            </div>
          </div>
        </section>

        <!-- UiCheckbox Section -->
        <section id="checkbox" class="section-card">
          <h2 class="section-title">UiCheckbox</h2>
          <p class="section-description">Checkbox component with label support via prop or slot</p>

          <div class="showcase-grid">
            <div class="showcase-item">
              <span class="showcase-label">Unchecked</span>
              <UiCheckbox v-model="checkboxDemo.unchecked" label="Unchecked option" />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">Checked</span>
              <UiCheckbox v-model="checkboxDemo.checked" label="Checked option" />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">Disabled</span>
              <UiCheckbox v-model="checkboxDemo.disabled" label="Disabled option" disabled />
            </div>
          </div>

          <!-- Checkbox Group -->
          <div class="subsection">
            <h3 class="subsection-title">Checkbox Group</h3>
            <div class="showcase-item showcase-item-wide">
              <span class="showcase-label">Notification Preferences</span>
              <div class="checkbox-group">
                <UiCheckbox v-model="checkboxDemo.email" label="Email notifications" />
                <UiCheckbox v-model="checkboxDemo.sms" label="SMS notifications" />
                <UiCheckbox v-model="checkboxDemo.push" label="Push notifications" />
              </div>
            </div>
          </div>
        </section>

        <!-- UiRadio Section -->
        <section id="radio" class="section-card">
          <h2 class="section-title">UiRadio</h2>
          <p class="section-description">Radio button component for single selection within a group</p>

          <div class="showcase-grid">
            <div class="showcase-item">
              <span class="showcase-label">Unselected</span>
              <UiRadio
                v-model="radioDemo.single"
                value="option1"
                name="demo-single"
                label="Unselected option"
              />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">Selected</span>
              <UiRadio
                v-model="radioDemo.selected"
                value="selected"
                name="demo-selected"
                label="Selected option"
              />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">Disabled</span>
              <UiRadio
                v-model="radioDemo.disabled"
                value="disabled"
                name="demo-disabled"
                label="Disabled option"
                disabled
              />
            </div>
          </div>

          <!-- Radio Group -->
          <div class="subsection">
            <h3 class="subsection-title">Radio Group</h3>
            <div class="showcase-item showcase-item-wide">
              <span class="showcase-label">Shipping Method</span>
              <div class="radio-group">
                <UiRadio
                  v-model="radioDemo.shipping"
                  value="standard"
                  name="shipping"
                  label="Standard Shipping (5-7 days)"
                />
                <UiRadio
                  v-model="radioDemo.shipping"
                  value="express"
                  name="shipping"
                  label="Express Shipping (2-3 days)"
                />
                <UiRadio
                  v-model="radioDemo.shipping"
                  value="overnight"
                  name="shipping"
                  label="Overnight Shipping (1 day)"
                />
              </div>
            </div>
          </div>
        </section>

        <!-- UiToggle Section -->
        <section id="toggle" class="section-card">
          <h2 class="section-title">UiToggle</h2>
          <p class="section-description">Toggle switch with label and description support</p>

          <div class="showcase-grid">
            <div class="showcase-item">
              <span class="showcase-label">Off</span>
              <UiToggle v-model="toggleDemo.off" />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">On</span>
              <UiToggle v-model="toggleDemo.on" />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">Disabled</span>
              <UiToggle v-model="toggleDemo.disabled" disabled />
            </div>
          </div>

          <!-- Toggle with Labels -->
          <div class="subsection">
            <h3 class="subsection-title">With Labels and Descriptions</h3>
            <div class="showcase-item showcase-item-wide">
              <span class="showcase-label">Settings Panel</span>
              <div class="toggle-settings">
                <div class="toggle-setting-row">
                  <UiToggle
                    v-model="toggleDemo.darkMode"
                    label="Dark Mode"
                    description="Use dark theme for the interface"
                  />
                </div>
                <div class="toggle-setting-row">
                  <UiToggle
                    v-model="toggleDemo.emailAlerts"
                    label="Email Alerts"
                    description="Receive inventory alerts via email"
                  />
                </div>
                <div class="toggle-setting-row">
                  <UiToggle
                    v-model="toggleDemo.autoSave"
                    label="Auto-save"
                    description="Automatically save changes"
                    label-position="right"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- UiTextarea Section -->
        <section id="textarea" class="section-card">
          <h2 class="section-title">UiTextarea</h2>
          <p class="section-description">Multi-line text input with configurable rows and resize behavior</p>

          <div class="showcase-grid-2">
            <div class="showcase-item">
              <span class="showcase-label">Default</span>
              <UiTextarea
                v-model="textareaDemo.default"
                placeholder="Enter a detailed description..."
              />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">Disabled</span>
              <UiTextarea
                v-model="textareaDemo.disabled"
                disabled
              />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">Custom Rows (6)</span>
              <UiTextarea
                v-model="textareaDemo.rows"
                :rows="6"
                placeholder="More lines..."
              />
            </div>
            <div class="showcase-item">
              <span class="showcase-label">No Resize</span>
              <UiTextarea
                v-model="textareaDemo.noResize"
                resize="none"
                placeholder="Cannot resize..."
              />
            </div>
          </div>
        </section>

        <!-- UiFormGroup Section -->
        <section id="form-group" class="section-card">
          <h2 class="section-title">UiFormGroup</h2>
          <p class="section-description">Form field wrapper with label, hint, error, and success message support</p>

          <div class="showcase-grid-2">
            <div class="showcase-item">
              <span class="showcase-label">Standard Field</span>
              <UiFormGroup
                label="Email Address"
                for="demo-email"
                hint="We'll never share your email."
              >
                <UiInput
                  id="demo-email"
                  v-model="formGroupDemo.email"
                  type="email"
                  placeholder="you@example.com"
                />
              </UiFormGroup>
            </div>
            <div class="showcase-item">
              <span class="showcase-label">Required Field</span>
              <UiFormGroup
                label="Full Name"
                for="demo-name"
                required
              >
                <UiInput
                  id="demo-name"
                  v-model="formGroupDemo.name"
                  placeholder="Enter your name"
                  required
                />
              </UiFormGroup>
            </div>
            <div class="showcase-item">
              <span class="showcase-label">Field with Error</span>
              <UiFormGroup
                label="Password"
                for="demo-password"
                required
                error="Password must be at least 8 characters."
              >
                <UiInput
                  id="demo-password"
                  v-model="formGroupDemo.password"
                  type="password"
                  :error="true"
                />
              </UiFormGroup>
            </div>
            <div class="showcase-item">
              <span class="showcase-label">Field with Success</span>
              <UiFormGroup
                label="Username"
                for="demo-username"
                required
                success="Username is available!"
              >
                <UiInput
                  id="demo-username"
                  v-model="formGroupDemo.username"
                  :success="true"
                />
              </UiFormGroup>
            </div>
          </div>
        </section>

        <!-- Color Palette Section -->
        <section id="colors" class="section-card">
          <h2 class="section-title">Color Palette</h2>
          <p class="section-description">Theme color system with primary, accent, and surface scales</p>

          <!-- Primary Colors -->
          <div class="subsection">
            <h3 class="subsection-title">Primary</h3>
            <p class="color-description">Main brand color for buttons, links, and highlights</p>
            <div class="color-palette">
              <div v-for="shade in colorShades" :key="`primary-${shade}`" class="color-row">
                <div class="color-swatch" :style="{ background: `rgb(var(--color-primary-${shade}))` }"></div>
                <span class="color-label">{{ shade }}</span>
              </div>
            </div>
          </div>

          <!-- Accent Colors -->
          <div class="subsection">
            <h3 class="subsection-title">Accent</h3>
            <p class="color-description">Secondary color for contrast and visual interest</p>
            <div class="color-palette">
              <div v-for="shade in colorShades" :key="`accent-${shade}`" class="color-row">
                <div class="color-swatch" :style="{ background: `rgb(var(--color-accent-${shade}))` }"></div>
                <span class="color-label">{{ shade }}</span>
              </div>
            </div>
          </div>

          <!-- Surface Colors -->
          <div class="subsection">
            <h3 class="subsection-title">Surface</h3>
            <p class="color-description">Background and text colors (inverted in dark theme)</p>
            <div class="color-palette">
              <div v-for="shade in colorShades" :key="`surface-${shade}`" class="color-row">
                <div class="color-swatch" :style="{ background: `rgb(var(--color-surface-${shade}))` }"></div>
                <span class="color-label">{{ shade }}</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
// Page does not require authentication - it's a public style guide
definePageMeta({
  layout: false,
})

// Navigation sections for both mobile tabs and desktop sidebar
const sections = [
  { id: 'buttons', name: 'Buttons' },
  { id: 'inputs', name: 'Inputs' },
  { id: 'select', name: 'Select' },
  { id: 'checkbox', name: 'Checkbox' },
  { id: 'radio', name: 'Radio' },
  { id: 'toggle', name: 'Toggle' },
  { id: 'textarea', name: 'Textarea' },
  { id: 'form-group', name: 'Form Group' },
  { id: 'colors', name: 'Colors' },
]

// Color shades for palette display
const colorShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

// Demo state for UiInput
const inputDemo = ref({
  default: '',
  withValue: 'john@example.com',
  disabled: 'Disabled input',
  error: 'invalid-email',
  success: 'valid@email.com',
  email: '',
  password: '',
  number: '',
  date: '',
  prefixIcon: '',
  suffixIcon: '',
})

// Demo state for UiSelect
const categoryOptions = [
  { value: 'electronics', label: 'Electronics' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'food', label: 'Food & Beverage' },
]

const selectDemo = ref({
  category: '',
  preselected: 'electronics',
  disabled: 'electronics',
  error: '',
})

// Demo state for UiCheckbox
const checkboxDemo = ref({
  unchecked: false,
  checked: true,
  disabled: false,
  email: true,
  sms: false,
  push: true,
})

// Demo state for UiRadio
const radioDemo = ref({
  single: '',
  selected: 'selected',
  disabled: '',
  shipping: 'standard',
})

// Demo state for UiToggle
const toggleDemo = ref({
  off: false,
  on: true,
  disabled: false,
  darkMode: false,
  emailAlerts: true,
  autoSave: true,
})

// Demo state for UiTextarea
const textareaDemo = ref({
  default: '',
  disabled: 'This textarea is disabled and cannot be edited.',
  rows: '',
  noResize: '',
})

// Demo state for UiFormGroup
const formGroupDemo = ref({
  email: '',
  name: '',
  password: '123',
  username: 'johndoe',
})
</script>

<style scoped>
/* Page Layout */
.ui-kit-page {
  @apply min-h-screen;
  background: rgb(var(--color-surface-50));
  scroll-behavior: smooth;
}

/* Header */
.kit-header {
  @apply sticky top-0 z-40 py-3 md:py-4 px-4 md:px-6;
  background: rgba(var(--color-surface-50), 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.5);
}

.header-container {
  @apply max-w-7xl mx-auto flex items-center justify-between;
}

.header-title {
  @apply text-xl md:text-2xl font-bold;
  color: rgb(var(--color-surface-900));
}

.header-subtitle {
  @apply text-xs md:text-sm;
  color: rgb(var(--color-surface-500));
}

/* Mobile Tab Navigation */
.mobile-nav {
  @apply overflow-x-auto -mx-0 px-4 py-3 flex gap-2 sticky top-[52px] md:top-[56px] z-30;
  background: rgb(var(--color-surface-50));
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.5);
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.mobile-nav::-webkit-scrollbar {
  display: none;
}

.mobile-nav-link {
  @apply whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium min-h-[40px] inline-flex items-center transition-colors;
  background: rgba(var(--color-surface-100), 0.8);
  color: rgb(var(--color-surface-700));
}

.mobile-nav-link:hover {
  background: rgba(var(--color-primary-100), 1);
  color: rgb(var(--color-primary-700));
}

/* Layout */
.kit-layout {
  @apply max-w-7xl mx-auto flex gap-8 p-4 md:p-6;
}

/* Sidebar (Desktop only) */
.kit-sidebar {
  @apply w-56 flex-shrink-0;
}

.sidebar-nav {
  @apply sticky top-24 space-y-1;
}

.nav-link {
  @apply block px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200;
  color: rgb(var(--color-surface-600));
}

.nav-link:hover {
  color: rgb(var(--color-primary-600));
  background: rgba(var(--color-primary-500), 0.1);
}

/* Main Content */
.kit-main {
  @apply flex-1 min-w-0;
}

/* Section Card - Responsive padding and border-radius */
.section-card {
  @apply p-4 md:p-6 rounded-xl md:rounded-2xl mb-6 md:mb-8;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.section-title {
  @apply text-lg md:text-xl font-semibold mb-1;
  color: rgb(var(--color-surface-900));
}

.section-description {
  @apply text-sm mb-4 md:mb-6;
  color: rgb(var(--color-surface-500));
}

/* Subsection */
.subsection {
  @apply mt-6 md:mt-8 pt-4 md:pt-6;
  border-top: 1px solid rgba(var(--color-surface-200), 0.5);
}

.subsection-title {
  @apply text-sm font-semibold uppercase tracking-wider mb-3 md:mb-4;
  color: rgb(var(--color-surface-500));
}

/* Showcase Grid - Responsive columns */
.showcase-grid {
  @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4;
}

.showcase-grid-2 {
  @apply grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4;
}

.showcase-item {
  @apply p-3 md:p-4 rounded-lg md:rounded-xl;
  background: rgb(var(--color-surface-50));
  border: 1px solid rgba(var(--color-surface-200), 0.5);
}

.showcase-item-wide {
  @apply col-span-full;
}

.showcase-label {
  @apply text-xs font-semibold uppercase tracking-wider mb-2 md:mb-3 block;
  color: rgb(var(--color-surface-400));
}

/* Checkbox & Radio Groups */
.checkbox-group,
.radio-group {
  @apply space-y-3;
}

/* Toggle Settings Panel */
.toggle-settings {
  @apply space-y-3 md:space-y-4;
}

.toggle-setting-row {
  @apply p-3 md:p-4 rounded-lg md:rounded-xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.5);
}

/* Color Palette - Responsive grid/flex layout */
.color-description {
  @apply text-sm mb-3 md:mb-4;
  color: rgb(var(--color-surface-500));
}

.color-palette {
  @apply grid grid-cols-6 sm:flex sm:flex-wrap gap-2;
}

.color-row {
  @apply flex flex-col items-center gap-1;
}

.color-swatch {
  @apply w-full aspect-square sm:w-14 sm:h-14 rounded-lg md:rounded-xl shadow-sm;
  border: 1px solid rgba(var(--color-surface-300), 0.3);
}

.color-label {
  @apply text-[10px] sm:text-xs font-mono font-medium;
  color: rgb(var(--color-surface-500));
}

/* Responsive: Layout adjustments for mobile */
@media (max-width: 1023px) {
  .kit-layout {
    @apply block;
  }
}
</style>
