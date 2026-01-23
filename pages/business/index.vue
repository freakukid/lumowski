<template>
  <div class="business-page">
    <!-- Page Header -->
    <div class="page-header">
      <h1 class="page-title">Business Settings</h1>
      <p class="page-subtitle">Manage your team and invite codes</p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoadingBusiness" class="loading-container">
      <div class="loading-spinner"></div>
      <span>Loading business details...</span>
    </div>

    <template v-else-if="business">
      <!-- Stats Row -->
      <div class="stats-row">
        <!-- Total Members -->
        <div class="stat-card">
          <div class="stat-icon stat-icon-primary">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div class="stat-value">{{ business.members?.length || 0 }}</div>
          <div class="stat-label">Total Members</div>
        </div>

        <!-- Active Invites (OWNER/BOSS only) -->
        <div v-if="authStore.canManageMembers" class="stat-card">
          <div class="stat-icon stat-icon-accent">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <div class="stat-value">{{ business.inviteCodes?.length || 0 }}</div>
          <div class="stat-label">Active Invites</div>
        </div>

        <!-- Placeholder for EMPLOYEE (they don't see invites) -->
        <div v-else class="stat-card">
          <div class="stat-icon stat-icon-accent">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div class="stat-value">Active</div>
          <div class="stat-label">Status</div>
        </div>

        <!-- Your Role -->
        <div class="stat-card">
          <div class="stat-icon" :class="roleIconClass">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <div class="stat-value-badge">
            <span class="role-badge" :class="roleClass">{{ authStore.businessRole }}</span>
          </div>
          <div class="stat-label">Your Role</div>
        </div>

        <!-- Member Since -->
        <div class="stat-card">
          <div class="stat-icon stat-icon-primary">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="stat-value text-lg lg:text-xl">{{ memberSinceFormatted }}</div>
          <div class="stat-label">Member Since</div>
        </div>
      </div>

      <!-- Main Content Area (Sidebar + Content on Desktop) -->
      <div class="main-layout">
        <!-- Sidebar (Desktop only) -->
        <aside class="sidebar">
          <!-- Business Info Card -->
          <div class="sidebar-card">
            <!-- Business Avatar -->
            <div class="business-avatar">
              {{ business.name.charAt(0).toUpperCase() }}
            </div>

            <!-- Business Name -->
            <h2 class="business-name">{{ business.name }}</h2>

            <!-- Role Badge -->
            <span class="role-badge" :class="roleClass">{{ authStore.businessRole }}</span>

            <!-- Quick Actions -->
            <div v-if="authStore.canManageMembers" class="quick-actions">
              <button @click="showInviteModal = true" class="quick-action-btn">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Invite Code
              </button>
            </div>

            <!-- Danger Zone (OWNER only) -->
            <div v-if="authStore.isOwner" class="danger-zone">
              <p class="danger-zone-label">Danger Zone</p>
              <button @click="showDeleteModal = true" class="delete-business-btn">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Business
              </button>
            </div>
          </div>
        </aside>

        <!-- Main Content -->
        <div class="content-area">
          <!-- Team Members Card -->
          <div class="card members-card">
            <div class="card-header">
              <h2 class="card-title">Team Members</h2>
              <span class="member-count">{{ business.members?.length || 0 }} members</span>
            </div>
            <div class="card-body">
              <!-- Desktop Table View -->
              <div class="hidden lg:block">
                <table class="members-table">
                  <thead>
                    <tr>
                      <th class="th-member">Member</th>
                      <th class="th-email">Email</th>
                      <th class="th-role">Role</th>
                      <th class="th-joined">Joined</th>
                      <th class="th-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="member in business.members" :key="member.id" class="member-row">
                      <td class="td-member">
                        <div class="flex items-center gap-3">
                          <div class="member-avatar">
                            {{ member.user?.name?.charAt(0).toUpperCase() }}
                          </div>
                          <span class="member-name">{{ member.user?.name }}</span>
                        </div>
                      </td>
                      <td class="td-email">{{ member.user?.email }}</td>
                      <td class="td-role">
                        <span class="role-badge small" :class="getRoleClass(member.role)">{{ member.role }}</span>
                      </td>
                      <td class="td-joined">{{ formatDate(member.createdAt) }}</td>
                      <td class="td-actions">
                        <div class="flex items-center gap-2 justify-end">
                          <template v-if="authStore.canChangeRoles && member.role !== 'OWNER' && member.userId !== authStore.user?.id">
                            <select
                              v-model="member.role"
                              @change="handleRoleChange(member.id, $event)"
                              class="role-select"
                            >
                              <option value="BOSS">Boss</option>
                              <option value="EMPLOYEE">Employee</option>
                            </select>
                            <button @click="handleRemoveMember(member.id)" class="action-btn action-btn-danger" title="Remove member">
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </template>
                          <template v-else-if="authStore.canManageMembers && member.role === 'EMPLOYEE' && member.userId !== authStore.user?.id">
                            <button @click="handleRemoveMember(member.id)" class="action-btn action-btn-danger" title="Remove member">
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </template>
                          <span v-else class="text-sm text-surface-400">-</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Mobile Card View -->
              <ul class="members-list lg:hidden">
                <li v-for="member in business.members" :key="member.id" class="member-item">
                  <div class="member-info">
                    <div class="member-avatar">
                      {{ member.user?.name?.charAt(0).toUpperCase() }}
                    </div>
                    <div class="member-details">
                      <span class="member-name">{{ member.user?.name }}</span>
                      <span class="member-email">{{ member.user?.email }}</span>
                    </div>
                  </div>
                  <div class="member-actions">
                    <span class="role-badge small" :class="getRoleClass(member.role)">{{ member.role }}</span>
                    <template v-if="authStore.canChangeRoles && member.role !== 'OWNER' && member.userId !== authStore.user?.id">
                      <select
                        v-model="member.role"
                        @change="handleRoleChange(member.id, $event)"
                        class="role-select flex-1 md:flex-initial min-h-[44px]"
                      >
                        <option value="BOSS">Boss</option>
                        <option value="EMPLOYEE">Employee</option>
                      </select>
                      <button @click="handleRemoveMember(member.id)" class="remove-btn min-w-[44px] min-h-[44px]" title="Remove member">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </template>
                    <template v-else-if="authStore.canManageMembers && member.role === 'EMPLOYEE' && member.userId !== authStore.user?.id">
                      <button @click="handleRemoveMember(member.id)" class="remove-btn min-w-[44px] min-h-[44px]" title="Remove member">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </template>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <!-- Invite Codes Card (only for OWNER and BOSS) -->
          <div v-if="authStore.canManageMembers" class="card invite-card">
            <div class="card-header">
              <h2 class="card-title">Invite Codes</h2>
              <button @click="showInviteModal = true" class="create-invite-btn min-h-[44px] lg:hidden">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Code
              </button>
            </div>
            <div class="card-body">
              <div v-if="!business.inviteCodes?.length" class="empty-state">
                <svg class="w-12 h-12 mx-auto mb-3" style="color: rgb(var(--color-surface-300));" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
                <p>No active invite codes</p>
                <button @click="showInviteModal = true" class="btn btn-primary mt-4">
                  Create Your First Invite
                </button>
              </div>

              <!-- Desktop Grid / Mobile List -->
              <div v-else class="invite-grid">
                <div v-for="invite in business.inviteCodes" :key="invite.id" class="invite-card-item">
                  <div class="invite-card-header">
                    <code class="invite-code">{{ invite.code }}</code>
                    <div class="invite-actions-inline">
                      <button @click="copyInviteCode(invite.code)" class="action-btn" title="Copy code">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button @click="handleDeleteInvite(invite.id)" class="action-btn action-btn-danger" title="Delete code">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div class="invite-meta-row">
                    <span class="role-badge small" :class="getRoleClass(invite.role)">{{ invite.role }}</span>
                    <span v-if="invite.expiresAt" class="invite-expires">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {{ formatDate(invite.expiresAt) }}
                    </span>
                  </div>

                  <!-- Usage Progress -->
                  <div v-if="invite.maxUses" class="invite-usage">
                    <div class="invite-usage-text">
                      <span>{{ invite.usedCount }} / {{ invite.maxUses }} uses</span>
                      <span class="text-xs">{{ Math.round((invite.usedCount / invite.maxUses) * 100) }}%</span>
                    </div>
                    <div class="progress-bar">
                      <div
                        class="progress-bar-fill"
                        :style="{ width: `${(invite.usedCount / invite.maxUses) * 100}%` }"
                      ></div>
                    </div>
                  </div>
                  <div v-else class="invite-usage">
                    <span class="text-xs" style="color: rgb(var(--color-surface-500));">Unlimited uses</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Create Invite Modal -->
    <UiModal
      v-model="showInviteModal"
      title="Create Invite Code"
      variant="default"
      size="md"
    >
      <div class="space-y-4">
        <UiFormGroup label="Role" for="invite-role">
          <UiSelect
            id="invite-role"
            v-model="inviteForm.role"
            :options="roleSelectOptions"
            select-class="form-select"
          />
        </UiFormGroup>
        <UiFormGroup label="Expires After (hours)" for="invite-expires">
          <UiNumberInput
            id="invite-expires"
            v-model="inviteForm.expiresInHours"
            :min="0"
            placeholder="Leave empty for no expiry"
          />
          <p class="text-xs text-surface-500 mt-1">Leave at 0 for no expiration</p>
        </UiFormGroup>
        <UiFormGroup label="Max Uses" for="invite-max-uses">
          <UiNumberInput
            id="invite-max-uses"
            v-model="inviteForm.maxUses"
            :min="0"
            placeholder="Leave empty for unlimited"
          />
          <p class="text-xs text-surface-500 mt-1">Leave at 0 for unlimited uses</p>
        </UiFormGroup>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="showInviteModal = false">Cancel</UiButton>
        <UiButton :loading="isLoading" loading-text="Creating..." @click="handleCreateInvite">
          Create
        </UiButton>
      </template>
    </UiModal>

    <!-- Delete Business Confirmation Modal -->
    <UiModal
      v-model="showDeleteModal"
      title="Delete Business"
      variant="danger"
      size="lg"
      :close-on-backdrop="!isDeletingBusiness"
    >
      <div class="space-y-4">
        <!-- Business Name -->
        <p class="delete-modal-text">
          You are about to delete <strong>{{ business?.name }}</strong>
        </p>

        <!-- Consequences List -->
        <div class="delete-consequences">
          <p class="delete-consequences-title">This will permanently delete:</p>
          <ul class="delete-consequences-list">
            <li>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              All inventory items ({{ inventoryItemCount }} items)
            </li>
            <li>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              All team members ({{ business?.members?.length || 0 }} members)
            </li>
            <li>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              All invite codes
            </li>
            <li>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              Column schema configuration
            </li>
          </ul>
        </div>

        <!-- Warning Box -->
        <div class="delete-warning-box">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>This action cannot be undone.</span>
        </div>

        <!-- Confirmation Input -->
        <UiFormGroup for="delete-confirmation">
          <template #label>
            <UiFormLabel for="delete-confirmation">
              Type <strong>{{ business?.name }}</strong> to confirm
            </UiFormLabel>
          </template>
          <UiInput
            id="delete-confirmation"
            v-model="deleteConfirmation"
            type="text"
            :placeholder="business?.name"
            autocomplete="off"
          />
        </UiFormGroup>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="closeDeleteModal">Cancel</UiButton>
        <UiButton
          variant="danger"
          :loading="isDeletingBusiness"
          loading-text="Deleting..."
          :disabled="!canConfirmDelete"
          @click="handleDeleteBusiness"
        >
          Delete Business
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import type { Business, BusinessRole } from '~/types/schema'

definePageMeta({
  middleware: 'auth',
})

const router = useRouter()
const authStore = useAuthStore()
const { authFetch } = useAuthFetch()
const {
  getBusiness,
  createInviteCode,
  deleteInviteCode,
  updateMemberRole,
  removeMember,
  deleteBusiness,
  isLoading,
} = useBusiness()

const business = ref<Business | null>(null)
const isLoadingBusiness = ref(true)
const showInviteModal = ref(false)
const inviteForm = reactive({
  role: 'EMPLOYEE' as 'BOSS' | 'EMPLOYEE',
  expiresInHours: undefined as number | undefined,
  maxUses: undefined as number | undefined,
})

// Delete business modal state
const showDeleteModal = ref(false)
const deleteConfirmation = ref('')
const isDeletingBusiness = ref(false)
const inventoryItemCount = ref(0)

// Computed: can confirm delete (business name matches)
const canConfirmDelete = computed(() => {
  if (!business.value?.name) return false
  return deleteConfirmation.value === business.value.name
})

const roleClass = computed(() => getRoleClass(authStore.businessRole))

// Options for the invite role select
const roleSelectOptions = computed(() => {
  const options = [
    { value: 'EMPLOYEE', label: 'Employee' },
  ]
  if (authStore.isOwner) {
    options.push({ value: 'BOSS', label: 'Boss' })
  }
  return options
})

const roleIconClass = computed(() => {
  switch (authStore.businessRole) {
    case 'OWNER':
    case 'BOSS':
      return 'stat-icon-primary'
    default:
      return 'stat-icon-accent'
  }
})

// Compute member since date
const memberSinceFormatted = computed(() => {
  if (!business.value?.members || !authStore.user?.id) return '-'
  const member = business.value.members.find(m => m.userId === authStore.user?.id)
  if (!member) return '-'
  return formatDateShort(member.createdAt)
})

function getRoleClass(role: BusinessRole | null) {
  switch (role) {
    case 'OWNER':
      return 'role-owner'
    case 'BOSS':
      return 'role-boss'
    case 'EMPLOYEE':
      return 'role-employee'
    default:
      return ''
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString()
}

function formatDateShort(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

async function loadBusiness() {
  isLoadingBusiness.value = true
  try {
    business.value = await getBusiness()
  } catch {
    // Handle error
  } finally {
    isLoadingBusiness.value = false
  }
}

async function handleCreateInvite() {
  try {
    await createInviteCode({
      role: inviteForm.role,
      expiresInHours: inviteForm.expiresInHours,
      maxUses: inviteForm.maxUses,
    })
    showInviteModal.value = false
    inviteForm.role = 'EMPLOYEE'
    inviteForm.expiresInHours = undefined
    inviteForm.maxUses = undefined
    await loadBusiness()
  } catch {
    // Error is handled in composable
  }
}

async function handleDeleteInvite(id: string) {
  if (!confirm('Are you sure you want to delete this invite code?')) return
  try {
    await deleteInviteCode(id)
    await loadBusiness()
  } catch {
    // Error is handled in composable
  }
}

async function handleRoleChange(memberId: string, event: Event) {
  const target = event.target as HTMLSelectElement
  const newRole = target.value as 'BOSS' | 'EMPLOYEE'
  try {
    await updateMemberRole(memberId, newRole)
    await loadBusiness()
  } catch {
    // Error is handled in composable, reload to reset select
    await loadBusiness()
  }
}

async function handleRemoveMember(memberId: string) {
  if (!confirm('Are you sure you want to remove this member from the business?')) return
  try {
    await removeMember(memberId)
    await loadBusiness()
  } catch {
    // Error is handled in composable
  }
}

function copyInviteCode(code: string) {
  navigator.clipboard.writeText(code)
  // Could add a toast notification here
}

// Delete business modal functions
function closeDeleteModal() {
  showDeleteModal.value = false
  deleteConfirmation.value = ''
}

async function handleDeleteBusiness() {
  if (!canConfirmDelete.value) return

  isDeletingBusiness.value = true
  try {
    await deleteBusiness()
    closeDeleteModal()
    // Redirect to business selection page after deletion
    router.push('/business/select')
  } catch {
    // Error is handled in composable
  } finally {
    isDeletingBusiness.value = false
  }
}

// Fetch inventory item count for the delete modal
async function fetchInventoryCount() {
  try {
    const response = await authFetch<{ total: number }>('/api/inventory', {
      query: { limit: 0 }, // We just need the count
    })
    inventoryItemCount.value = response.total || 0
  } catch {
    inventoryItemCount.value = 0
  }
}

onMounted(async () => {
  await loadBusiness()
  // Fetch inventory count in the background for the delete modal
  fetchInventoryCount()
})
</script>

<style scoped>
.business-page {
  @apply max-w-7xl mx-auto py-6 px-4 lg:py-8 lg:px-8;
}

.page-header {
  @apply mb-6 lg:mb-8;
}

.page-title {
  @apply text-2xl md:text-3xl font-bold;
  color: rgb(var(--color-surface-900));
}

.page-subtitle {
  @apply text-sm mt-1;
  color: rgb(var(--color-surface-500));
}

.loading-container {
  @apply flex items-center gap-3 justify-center py-12;
  color: rgb(var(--color-surface-500));
}

.loading-spinner {
  @apply w-5 h-5 border-2 rounded-full animate-spin;
  border-color: rgb(var(--color-primary-500));
  border-top-color: transparent;
}

/* Stats Row */
.stats-row {
  @apply grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8;
}

.stat-value-badge {
  @apply flex items-center h-8 lg:h-10;
}

/* Main Layout */
.main-layout {
  @apply flex flex-col lg:flex-row gap-6 lg:gap-8;
}

/* Sidebar */
.sidebar {
  @apply hidden lg:block lg:w-80 flex-shrink-0;
}

.sidebar-card {
  @apply sticky top-24 rounded-xl p-6 text-center;
  background: rgba(var(--color-surface-100), 0.7);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.business-avatar {
  @apply w-20 h-20 mx-auto rounded-2xl flex items-center justify-center text-3xl font-bold text-white mb-4;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-accent-500)));
}

.business-name {
  @apply text-xl font-bold mb-3;
  color: rgb(var(--color-surface-900));
}

.quick-actions {
  @apply mt-6 pt-6;
  border-top: 1px solid rgba(var(--color-surface-200), 0.8);
}

.quick-action-btn {
  @apply w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  box-shadow: 0 4px 15px rgba(var(--color-primary-500), 0.3);
}

.quick-action-btn:hover {
  @apply -translate-y-0.5;
  box-shadow: 0 6px 20px rgba(var(--color-primary-500), 0.4);
}

/* Content Area */
.content-area {
  @apply flex-1 space-y-6;
}

/* Card Styles */
.card {
  @apply rounded-xl overflow-hidden;
  background: rgb(var(--color-surface-100));
  border: 1px solid rgb(var(--color-surface-200));
}

.card-header {
  @apply flex items-center justify-between p-4 md:px-6 md:py-4;
  background: rgb(var(--color-surface-50));
  border-bottom: 1px solid rgb(var(--color-surface-200));
}

.card-title {
  @apply text-lg md:text-xl font-semibold;
  color: rgb(var(--color-surface-900));
}

.card-body {
  @apply p-4 md:p-6;
}

.member-count {
  @apply text-sm font-medium px-3 py-1 rounded-full;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

/* Role Badge */
.role-badge {
  @apply px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide;
}

.role-badge.small {
  @apply px-2 py-0.5 text-[10px];
}

.role-owner {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.role-boss {
  background: rgba(var(--color-accent-500), 0.1);
  color: rgb(var(--color-accent-600));
}

.role-employee {
  background: rgb(var(--color-surface-200));
  color: rgb(var(--color-surface-600));
}

/* Members Table (Desktop) */
.members-table {
  @apply w-full;
}

.members-table th {
  @apply text-left text-xs font-semibold uppercase tracking-wider py-3 px-4;
  color: rgb(var(--color-surface-500));
  border-bottom: 1px solid rgb(var(--color-surface-200));
}

.members-table td {
  @apply py-4 px-4;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.5);
}

.member-row:last-child td {
  border-bottom: none;
}

.member-row:hover {
  background: rgba(var(--color-surface-50), 0.5);
}

.th-member { @apply w-1/4; }
.th-email { @apply w-1/4; }
.th-role { @apply w-1/6; }
.th-joined { @apply w-1/6; }
.th-actions { @apply w-1/6 text-right; }

.td-member .member-name {
  @apply font-medium;
  color: rgb(var(--color-surface-900));
}

.td-email {
  @apply text-sm;
  color: rgb(var(--color-surface-600));
}

.td-joined {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

/* Members List (Mobile) */
.members-list {
  @apply space-y-3;
}

.member-item {
  @apply flex flex-col gap-3 p-3 rounded-lg md:flex-row md:items-center md:justify-between;
  background: rgb(var(--color-surface-50));
}

.member-info {
  @apply flex items-center gap-3;
}

.member-avatar {
  @apply w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-accent-500)));
}

.member-details {
  @apply flex flex-col;
}

.member-name {
  @apply text-sm font-semibold;
  color: rgb(var(--color-surface-900));
}

.member-email {
  @apply text-xs;
  color: rgb(var(--color-surface-500));
}

.member-actions {
  @apply flex items-center gap-2 w-full md:w-auto;
}

.role-select {
  @apply text-xs px-2 py-1 rounded border;
  background: rgb(var(--color-surface-50));
  border-color: rgb(var(--color-surface-300));
  color: rgb(var(--color-surface-700));
}

/* Action Buttons */
.action-btn {
  @apply p-2 rounded-lg transition-colors flex items-center justify-center;
  color: rgb(var(--color-surface-400));
}

.action-btn:hover {
  background: rgb(var(--color-surface-200));
  color: rgb(var(--color-primary-500));
}

.action-btn-danger:hover {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

/* Invite Card Styles */
.create-invite-btn {
  @apply flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors;
  background: rgb(var(--color-primary-500));
}

.create-invite-btn:hover {
  background: rgb(var(--color-primary-600));
}

.empty-state {
  @apply text-center py-8;
  color: rgb(var(--color-surface-400));
}

/* Invite Grid */
.invite-grid {
  @apply grid grid-cols-1 lg:grid-cols-2 gap-4;
}

.invite-card-item {
  @apply p-4 rounded-xl;
  background: rgb(var(--color-surface-50));
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.invite-card-header {
  @apply flex items-center justify-between mb-3;
}

.invite-code {
  @apply text-lg font-mono font-bold tracking-widest;
  color: rgb(var(--color-primary-600));
}

.invite-actions-inline {
  @apply flex items-center gap-1;
}

.invite-meta-row {
  @apply flex items-center gap-2 text-xs mb-3;
  color: rgb(var(--color-surface-500));
}

.invite-expires {
  @apply flex items-center gap-1;
}

.invite-usage {
  @apply space-y-1.5;
}

.invite-usage-text {
  @apply flex items-center justify-between text-xs;
  color: rgb(var(--color-surface-600));
}

/* Legacy mobile invite styles */
.copy-btn, .remove-btn {
  @apply p-2 rounded-lg transition-colors flex items-center justify-center;
  color: rgb(var(--color-surface-400));
}

.copy-btn:hover {
  background: rgb(var(--color-surface-200));
  color: rgb(var(--color-primary-500));
}

.remove-btn:hover {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

/* Form */
.form-group {
  @apply space-y-1;
}

.form-label {
  @apply block text-sm font-medium;
  color: rgb(var(--color-surface-700));
}

.form-input, .form-select {
  @apply w-full px-3 py-2 rounded-lg text-sm min-h-[44px];
  background: rgb(var(--color-surface-50));
  border: 1px solid rgb(var(--color-surface-300));
  color: rgb(var(--color-surface-900));
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: rgb(var(--color-primary-500));
  box-shadow: 0 0 0 3px rgba(var(--color-primary-500), 0.1);
}

/* Buttons */
.btn-primary {
  @apply px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors;
  background: rgb(var(--color-primary-500));
}

.btn-primary:hover:not(:disabled) {
  background: rgb(var(--color-primary-600));
}

.btn-primary:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.btn-secondary {
  @apply px-4 py-2 rounded-lg text-sm font-medium transition-colors;
  background: rgb(var(--color-surface-200));
  color: rgb(var(--color-surface-700));
}

.btn-secondary:hover {
  background: rgb(var(--color-surface-300));
}

/* Danger Zone Section */
.danger-zone {
  @apply mt-6 pt-6;
  border-top: 1px solid rgba(var(--color-surface-200), 0.8);
}

.danger-zone-label {
  @apply text-xs font-semibold uppercase tracking-wider mb-3;
  color: rgb(var(--color-surface-400));
}

/* Delete Business Button */
.delete-business-btn {
  @apply w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all min-h-[44px];
  background: rgba(var(--color-error-500), 0.08);
  border: 1px solid rgba(var(--color-error-500), 0.2);
  color: rgb(var(--color-error-600));
}

.delete-business-btn:hover {
  background: rgba(var(--color-error-500), 0.15);
  border-color: rgba(var(--color-error-500), 0.3);
}

/* Delete Modal Content */
.delete-modal-text {
  @apply text-sm;
  color: rgb(var(--color-surface-700));
}

.delete-modal-text strong {
  @apply font-semibold;
  color: rgb(var(--color-surface-900));
}

.delete-consequences {
  @apply p-4 rounded-lg;
  background: rgba(var(--color-surface-100), 0.8);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.delete-consequences-title {
  @apply text-xs font-semibold uppercase tracking-wider mb-3;
  color: rgb(var(--color-surface-500));
}

.delete-consequences-list {
  @apply space-y-2;
}

.delete-consequences-list li {
  @apply flex items-center gap-2 text-sm;
  color: rgb(var(--color-surface-600));
}

.delete-consequences-list svg {
  @apply flex-shrink-0;
  color: rgb(var(--color-surface-400));
}

.delete-warning-box {
  @apply flex items-center gap-3 p-4 rounded-lg text-sm font-medium;
  background: rgba(var(--color-error-500), 0.08);
  border: 1px solid rgba(var(--color-error-500), 0.15);
  color: rgb(var(--color-error-600));
}

/* Delete Button */
.btn-delete {
  @apply px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2;
  background: rgb(var(--color-error-600));
}

.btn-delete:hover:not(:disabled) {
  background: rgb(var(--color-error-700));
}

.btn-delete:disabled {
  @apply opacity-50 cursor-not-allowed;
}
</style>
