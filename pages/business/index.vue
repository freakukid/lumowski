<template>
  <div class="business-page">
    <!-- Page Header with Back Navigation -->
    <div class="page-header">
      <div class="header-content">
        <NuxtLink to="/" class="back-link">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Inventory</span>
        </NuxtLink>
        <h1 class="page-title">Business Settings</h1>
        <p class="page-subtitle">Manage your team and invite codes</p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoadingBusiness" class="loading-container" aria-live="polite">
      <div class="loading-spinner"></div>
      <span>Loading business details...</span>
    </div>

    <template v-else-if="business">
      <!-- Mobile: Sidebar content above tabs -->
      <div class="mobile-business-info lg:hidden">
        <div class="mobile-business-card">
          <div class="business-avatar-small">
            {{ business.name?.charAt(0)?.toUpperCase() || '' }}
          </div>
          <div class="mobile-business-details">
            <h2 class="mobile-business-name">{{ business.name }}</h2>
            <span class="role-badge" :class="roleClass">{{ authStore.businessRole }}</span>
          </div>
        </div>

        <!-- Quick Actions (Mobile) -->
        <div v-if="authStore.canManageMembers" class="mobile-quick-actions">
          <button @click="showInviteModal = true" class="mobile-create-invite-btn">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Invite Code
          </button>
        </div>
      </div>

      <!-- Main Content Area (Sidebar + Content on Desktop) -->
      <div class="main-layout">
        <!-- Sidebar (Desktop only) -->
        <aside class="sidebar">
          <div class="sidebar-card">
            <!-- Business Avatar -->
            <div class="business-avatar">
              {{ business.name?.charAt(0)?.toUpperCase() || '' }}
            </div>

            <!-- Business Name -->
            <h2 class="business-name">{{ business.name }}</h2>

            <!-- Role Badge -->
            <span class="role-badge" :class="roleClass">{{ authStore.businessRole }}</span>

            <!-- Quick Stats -->
            <div class="sidebar-stats">
              <div class="sidebar-stat">
                <span class="sidebar-stat-value">{{ business.members?.length || 0 }}</span>
                <span class="sidebar-stat-label">Members</span>
              </div>
              <div v-if="authStore.canManageMembers" class="sidebar-stat">
                <span class="sidebar-stat-value">{{ business.inviteCodes?.length || 0 }}</span>
                <span class="sidebar-stat-label">Invites</span>
              </div>
            </div>

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
              <button @click="openDeleteModal" class="delete-business-btn">
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
          <!-- Members Section -->
          <section class="content-section">
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
                              {{ member.user?.name?.charAt(0)?.toUpperCase() || '' }}
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
                              <button @click="openRoleModal(member)" class="action-btn action-btn-change-role" aria-label="Change member role" title="Change role">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button @click="handleRemoveMember(member.id)" class="action-btn action-btn-danger" aria-label="Remove member" title="Remove member">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </template>
                            <template v-else-if="authStore.canManageMembers && member.role === 'EMPLOYEE' && member.userId !== authStore.user?.id">
                              <button @click="handleRemoveMember(member.id)" class="action-btn action-btn-danger" aria-label="Remove member" title="Remove member">
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
                  <li v-for="member in business.members" :key="member.id" class="member-card-mobile">
                    <div class="member-card-header">
                      <div class="member-avatar">
                        {{ member.user?.name?.charAt(0)?.toUpperCase() || '' }}
                      </div>
                      <div class="member-card-info">
                        <span class="member-name">{{ member.user?.name }}</span>
                        <span class="member-email">{{ member.user?.email }}</span>
                      </div>
                    </div>
                    <div class="member-card-meta">
                      <span class="role-badge small" :class="getRoleClass(member.role)">{{ member.role }}</span>
                      <span class="member-joined">Joined {{ formatDate(member.createdAt) }}</span>
                    </div>
                    <div class="member-card-actions" v-if="(authStore.canChangeRoles && member.role !== 'OWNER' && member.userId !== authStore.user?.id) || (authStore.canManageMembers && member.role === 'EMPLOYEE' && member.userId !== authStore.user?.id)">
                      <button
                        v-if="authStore.canChangeRoles && member.role !== 'OWNER'"
                        @click="openRoleModal(member)"
                        class="member-action-btn"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Change Role
                      </button>
                      <button
                        @click="handleRemoveMember(member.id)"
                        class="member-action-btn member-action-btn-danger"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove
                      </button>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <!-- Invites Section -->
          <section v-if="authStore.canManageMembers" class="content-section">
            <div class="card invite-card">
              <div class="card-header">
                <h2 class="card-title">Invite Codes</h2>
                <button @click="showInviteModal = true" class="create-invite-btn-header">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  New Code
                </button>
              </div>
              <div class="card-body">
                <div v-if="!business.inviteCodes?.length" class="empty-state">
                  <svg class="w-16 h-16 mx-auto mb-4" style="color: rgb(var(--color-surface-300));" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                  <p class="empty-state-text">No active invite codes</p>
                  <p class="empty-state-subtext">Create an invite code to add members to your team</p>
                  <button @click="showInviteModal = true" class="btn btn-primary mt-4">
                    Create Your First Invite
                  </button>
                </div>

                <!-- Invite Cards Grid -->
                <div v-else class="invite-grid">
                  <div v-for="invite in business.inviteCodes" :key="invite.id" class="invite-card-item">
                    <div class="invite-card-top">
                      <span class="role-badge small" :class="getRoleClass(invite.role)">{{ invite.role }}</span>
                      <div class="invite-card-actions">
                        <button @click="copyInviteCode(invite.code)" class="invite-action-btn" :aria-label="copiedCode === invite.code ? 'Copied!' : 'Copy invite code'" :title="copiedCode === invite.code ? 'Copied!' : 'Copy code'">
                          <svg v-if="copiedCode !== invite.code" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <svg v-else class="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button @click="copyInviteLink(invite.code)" class="invite-action-btn" :aria-label="copiedLink === invite.code ? 'Copied!' : 'Share invite link'" :title="copiedLink === invite.code ? 'Copied!' : 'Copy invite link'">
                          <svg v-if="copiedLink !== invite.code" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          <svg v-else class="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button @click="handleDeleteInvite(invite.id)" class="invite-action-btn invite-action-btn-danger" aria-label="Delete invite code" title="Delete code">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <code class="invite-code-display">{{ invite.code }}</code>

                    <div class="invite-meta">
                      <div v-if="invite.expiresAt" class="invite-meta-item">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Expires {{ formatDate(invite.expiresAt) }}</span>
                      </div>
                      <div v-else class="invite-meta-item">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>No expiry</span>
                      </div>
                    </div>

                    <!-- Usage Progress -->
                    <div v-if="invite.maxUses" class="invite-usage">
                      <div class="invite-usage-header">
                        <span>{{ invite.usedCount }} / {{ invite.maxUses }} uses</span>
                        <span class="invite-usage-percent">{{ Math.round((invite.usedCount / invite.maxUses) * 100) }}%</span>
                      </div>
                      <div class="progress-bar">
                        <div
                          class="progress-bar-fill"
                          :style="{ width: `${(invite.usedCount / invite.maxUses) * 100}%` }"
                        ></div>
                      </div>
                    </div>
                    <div v-else class="invite-usage-unlimited">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Unlimited uses</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Danger Zone (Mobile Only - OWNER) -->
          <div v-if="authStore.isOwner" class="mobile-danger-zone lg:hidden">
            <p class="danger-zone-label">Danger Zone</p>
            <button @click="openDeleteModal" class="delete-business-btn">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Business
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Toast Notification -->
    <Transition name="toast">
      <div v-if="toastMessage" class="toast-notification" :class="toastType">
        <svg v-if="toastType === 'success'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- Create Invite Modal (Redesigned) -->
    <UiModal
      v-model="showInviteModal"
      title="Create Invite Code"
      variant="default"
      size="md"
    >
      <div class="space-y-6">
        <!-- Role Selection Cards -->
        <div>
          <label class="form-label-text mb-3 block">Select Role</label>
          <div class="role-cards">
            <button
              :class="['role-card', { selected: inviteForm.role === 'EMPLOYEE' }]"
              @click="inviteForm.role = 'EMPLOYEE'"
            >
              <div class="role-card-icon">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div class="role-card-title">Employee</div>
              <div class="role-card-desc">Can view and edit inventory</div>
            </button>
            <button
              v-if="authStore.isOwner"
              :class="['role-card', { selected: inviteForm.role === 'BOSS' }]"
              @click="inviteForm.role = 'BOSS'"
            >
              <div class="role-card-icon">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div class="role-card-title">Boss</div>
              <div class="role-card-desc">Full access to manage team</div>
            </button>
          </div>
        </div>

        <!-- Optional Settings -->
        <div class="optional-settings">
          <div class="optional-settings-header">
            <span class="optional-settings-title">Optional Settings</span>
          </div>

          <div class="optional-settings-content">
            <!-- Expiry Toggle -->
            <div class="setting-item">
              <UiToggle
                v-model="inviteHasExpiry"
                label="Set expiration"
                description="Code will expire after specified hours"
                label-position="right"
              />
              <div v-if="inviteHasExpiry" class="setting-input-wrapper">
                <UiFormGroup label="Expires after (hours)" for="invite-expires">
                  <UiNumberInput
                    id="invite-expires"
                    v-model="inviteForm.expiresInHours"
                    :min="1"
                    placeholder="24"
                  />
                </UiFormGroup>
              </div>
            </div>

            <!-- Max Uses Toggle -->
            <div class="setting-item">
              <UiToggle
                v-model="inviteHasMaxUses"
                label="Limit uses"
                description="Set maximum number of times this code can be used"
                label-position="right"
              />
              <div v-if="inviteHasMaxUses" class="setting-input-wrapper">
                <UiFormGroup label="Maximum uses" for="invite-max-uses">
                  <UiNumberInput
                    id="invite-max-uses"
                    v-model="inviteForm.maxUses"
                    :min="1"
                    placeholder="10"
                  />
                </UiFormGroup>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="showInviteModal = false">Cancel</UiButton>
        <UiButton :loading="isLoading" loading-text="Creating..." @click="handleCreateInvite">
          Create Invite
        </UiButton>
      </template>
    </UiModal>

    <!-- Change Role Modal -->
    <UiModal
      v-model="showRoleModal"
      title="Change Member Role"
      variant="default"
      size="md"
    >
      <div v-if="selectedMemberForRole" class="space-y-6">
        <!-- Member Info -->
        <div class="role-modal-member">
          <div class="member-avatar-large">
            {{ selectedMemberForRole.user?.name?.charAt(0)?.toUpperCase() || '' }}
          </div>
          <div class="role-modal-member-info">
            <span class="role-modal-member-name">{{ selectedMemberForRole.user?.name }}</span>
            <span class="role-modal-member-email">{{ selectedMemberForRole.user?.email }}</span>
          </div>
        </div>

        <!-- Role Selection -->
        <div class="role-selection">
          <label class="role-option" :class="{ selected: newRole === 'BOSS' }">
            <input
              type="radio"
              v-model="newRole"
              value="BOSS"
              name="member-role"
              class="radio"
            />
            <div class="role-option-content">
              <div class="role-option-header">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span class="role-option-title">Boss</span>
              </div>
              <p class="role-option-desc">Full access to manage team and inventory, create invites</p>
            </div>
          </label>
          <label class="role-option" :class="{ selected: newRole === 'EMPLOYEE' }">
            <input
              type="radio"
              v-model="newRole"
              value="EMPLOYEE"
              name="member-role"
              class="radio"
            />
            <div class="role-option-content">
              <div class="role-option-header">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span class="role-option-title">Employee</span>
              </div>
              <p class="role-option-desc">Can view and edit inventory items</p>
            </div>
          </label>
        </div>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="showRoleModal = false">Cancel</UiButton>
        <UiButton
          :loading="isChangingRole"
          loading-text="Saving..."
          :disabled="newRole === selectedMemberForRole?.role"
          @click="confirmRoleChange"
        >
          Save Changes
        </UiButton>
      </template>
    </UiModal>

    <!-- Delete Business Confirmation Modal (Two-Step) -->
    <UiModal
      v-model="showDeleteModal"
      title="Delete Business"
      variant="danger"
      size="lg"
      :close-on-backdrop="!isDeletingBusiness"
    >
      <!-- Step 1: Warning -->
      <div v-if="deleteStep === 1" class="space-y-4">
        <div class="delete-warning-icon">
          <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <p class="delete-modal-text text-center">
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
              <span><strong>{{ inventoryItemCount }}</strong> inventory items</span>
            </li>
            <li>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span><strong>{{ business?.members?.length || 0 }}</strong> team members</span>
            </li>
            <li>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              <span><strong>{{ business?.inviteCodes?.length || 0 }}</strong> invite codes</span>
            </li>
            <li>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <span>Column schema configuration</span>
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
      </div>

      <!-- Step 2: Type to Confirm -->
      <div v-else class="space-y-4">
        <div class="delete-confirm-header">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: rgb(var(--color-error-500));">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p class="delete-confirm-text">Final Confirmation</p>
        </div>

        <UiFormGroup for="delete-confirmation">
          <template #label>
            <UiFormLabel for="delete-confirmation">
              Type <strong class="delete-confirm-name">{{ business?.name }}</strong> to confirm
            </UiFormLabel>
          </template>
          <UiInput
            id="delete-confirmation"
            v-model="deleteConfirmName"
            type="text"
            :placeholder="business?.name"
            autocomplete="off"
          />
        </UiFormGroup>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="closeDeleteModal">
          {{ deleteStep === 1 ? 'Cancel' : 'Go Back' }}
        </UiButton>
        <UiButton
          v-if="deleteStep === 1"
          variant="danger"
          @click="deleteStep = 2"
        >
          Continue
        </UiButton>
        <UiButton
          v-else
          variant="danger"
          :loading="isDeletingBusiness"
          loading-text="Deleting..."
          :disabled="!canDelete"
          @click="handleDeleteBusiness"
        >
          Delete Business
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import type { Business, BusinessRole, BusinessMember } from '~/types/schema'

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

// Page state
const business = ref<Business | null>(null)
const isLoadingBusiness = ref(true)

// Invite modal state
const showInviteModal = ref(false)
const inviteHasExpiry = ref(false)
const inviteHasMaxUses = ref(false)
const inviteForm = reactive({
  role: 'EMPLOYEE' as 'BOSS' | 'EMPLOYEE',
  expiresInHours: undefined as number | undefined,
  maxUses: undefined as number | undefined,
})

// Role change modal state
const showRoleModal = ref(false)
const selectedMemberForRole = ref<BusinessMember | null>(null)
const newRole = ref<'BOSS' | 'EMPLOYEE'>('EMPLOYEE')
const isChangingRole = ref(false)

// Delete business modal state (two-step)
const showDeleteModal = ref(false)
const deleteStep = ref<1 | 2>(1)
const deleteConfirmName = ref('')
const isDeletingBusiness = ref(false)
const inventoryItemCount = ref(0)

// Toast notification state
const toastMessage = ref('')
const toastType = ref<'success' | 'error'>('success')
let toastTimeout: ReturnType<typeof setTimeout> | null = null

// Copy state for invite codes
const copiedCode = ref<string | null>(null)
const copiedLink = ref<string | null>(null)

// Computed properties
const canDelete = computed(() => deleteConfirmName.value === business.value?.name)
const roleClass = computed(() => getRoleClass(authStore.businessRole))

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

// Helper functions
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

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toastMessage.value = message
  toastType.value = type
  if (toastTimeout) clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => {
    toastMessage.value = ''
  }, 3000)
}

// Data loading
async function loadBusiness() {
  isLoadingBusiness.value = true
  try {
    const result = await getBusiness()
    if (result.success) {
      business.value = result.business
    }
  } catch {
    // Handle error
  } finally {
    isLoadingBusiness.value = false
  }
}

// Fetch inventory item count for the delete modal
async function fetchInventoryCount() {
  try {
    const response = await authFetch<{ total: number }>('/api/inventory', {
      query: { limit: 0 },
    })
    inventoryItemCount.value = response.total || 0
  } catch {
    inventoryItemCount.value = 0
  }
}

// Invite handlers
async function handleCreateInvite() {
  try {
    await createInviteCode({
      role: inviteForm.role,
      expiresInHours: inviteHasExpiry.value ? inviteForm.expiresInHours : undefined,
      maxUses: inviteHasMaxUses.value ? inviteForm.maxUses : undefined,
    })
    showInviteModal.value = false
    inviteForm.role = 'EMPLOYEE'
    inviteForm.expiresInHours = undefined
    inviteForm.maxUses = undefined
    inviteHasExpiry.value = false
    inviteHasMaxUses.value = false
    await loadBusiness()
    showToast('Invite code created successfully')
  } catch {
    showToast('Failed to create invite code', 'error')
  }
}

async function handleDeleteInvite(id: string) {
  if (!confirm('Are you sure you want to delete this invite code?')) return
  try {
    await deleteInviteCode(id)
    await loadBusiness()
    showToast('Invite code deleted')
  } catch {
    showToast('Failed to delete invite code', 'error')
  }
}

function copyInviteCode(code: string) {
  navigator.clipboard.writeText(code)
  copiedCode.value = code
  showToast('Code copied to clipboard')
  setTimeout(() => {
    copiedCode.value = null
  }, 2000)
}

function copyInviteLink(code: string) {
  const baseUrl = window.location.origin
  const link = `${baseUrl}/business/join?code=${code}`
  navigator.clipboard.writeText(link)
  copiedLink.value = code
  showToast('Invite link copied to clipboard')
  setTimeout(() => {
    copiedLink.value = null
  }, 2000)
}

// Role change handlers
function openRoleModal(member: BusinessMember) {
  selectedMemberForRole.value = member
  newRole.value = member.role as 'BOSS' | 'EMPLOYEE'
  showRoleModal.value = true
}

async function confirmRoleChange() {
  if (!selectedMemberForRole.value) return
  isChangingRole.value = true
  try {
    await updateMemberRole(selectedMemberForRole.value.id, newRole.value)
    await loadBusiness()
    showRoleModal.value = false
    showToast(`Role changed to ${newRole.value}`)
  } catch {
    showToast('Failed to change role', 'error')
  } finally {
    isChangingRole.value = false
  }
}

// Member removal
async function handleRemoveMember(memberId: string) {
  if (!confirm('Are you sure you want to remove this member from the business?')) return
  try {
    await removeMember(memberId)
    await loadBusiness()
    showToast('Member removed successfully')
  } catch {
    showToast('Failed to remove member', 'error')
  }
}

// Delete business handlers
function openDeleteModal() {
  deleteStep.value = 1
  deleteConfirmName.value = ''
  showDeleteModal.value = true
}

function closeDeleteModal() {
  if (deleteStep.value === 2) {
    deleteStep.value = 1
  } else {
    showDeleteModal.value = false
    deleteConfirmName.value = ''
  }
}

async function handleDeleteBusiness() {
  if (!canDelete.value) return

  isDeletingBusiness.value = true
  try {
    await deleteBusiness()
    closeDeleteModal()
    router.push('/business/select')
  } catch {
    showToast('Failed to delete business', 'error')
  } finally {
    isDeletingBusiness.value = false
  }
}

// Lifecycle
onMounted(async () => {
  await loadBusiness()
  fetchInventoryCount()
})
</script>

<style scoped>
.business-page {
  @apply max-w-7xl mx-auto py-6 px-4 lg:py-8 lg:px-8;
}

/* Page Header */
.page-header {
  @apply mb-6 lg:mb-8;
}

.header-content {
  @apply space-y-2;
}

.back-link {
  @apply inline-flex items-center gap-2 text-sm font-medium mb-4 transition-colors;
  color: rgb(var(--color-surface-500));
}

.back-link:hover {
  color: rgb(var(--color-primary-600));
}

.page-title {
  @apply text-2xl md:text-3xl font-bold;
  color: rgb(var(--color-surface-900));
}

.page-subtitle {
  @apply text-sm mt-1;
  color: rgb(var(--color-surface-500));
}

/* Loading State */
.loading-container {
  @apply flex items-center gap-3 justify-center py-12;
  color: rgb(var(--color-surface-500));
}

.loading-spinner {
  @apply w-5 h-5 border-2 rounded-full animate-spin;
  border-color: rgb(var(--color-primary-500));
  border-top-color: transparent;
}

/* Mobile Business Info */
.mobile-business-info {
  @apply mb-6 space-y-4;
}

.mobile-business-card {
  @apply flex items-center gap-4 p-4 rounded-xl;
  background: rgba(var(--color-surface-100), 0.7);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.business-avatar-small {
  @apply w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-accent-500)));
}

.mobile-business-details {
  @apply flex flex-col gap-2;
}

.mobile-business-name {
  @apply text-lg font-bold;
  color: rgb(var(--color-surface-900));
}

.mobile-quick-actions {
  @apply flex;
}

.mobile-create-invite-btn {
  @apply flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all min-h-[44px];
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  box-shadow: 0 4px 15px rgba(var(--color-primary-500), 0.3);
}

/* Main Layout */
.main-layout {
  @apply flex flex-col lg:flex-row gap-6 lg:gap-8;
}

/* Sidebar */
.sidebar {
  @apply hidden lg:block lg:w-72 flex-shrink-0;
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

.sidebar-stats {
  @apply flex justify-center gap-8 mt-4 pt-4;
  border-top: 1px solid rgba(var(--color-surface-200), 0.8);
}

.sidebar-stat {
  @apply flex flex-col items-center;
}

.sidebar-stat-value {
  @apply text-xl font-bold;
  color: rgb(var(--color-surface-900));
}

.sidebar-stat-label {
  @apply text-xs;
  color: rgb(var(--color-surface-500));
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
  @apply flex-1 space-y-8;
}

/* Content Sections */
.content-section {
  @apply space-y-4;
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

.member-card-mobile {
  @apply p-4 rounded-xl space-y-3;
  background: rgb(var(--color-surface-50));
}

.member-card-header {
  @apply flex items-center gap-3;
}

.member-avatar {
  @apply w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-accent-500)));
}

.member-avatar-large {
  @apply w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold text-white flex-shrink-0;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-accent-500)));
}

.member-card-info {
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

.member-card-meta {
  @apply flex items-center gap-3;
}

.member-joined {
  @apply text-xs;
  color: rgb(var(--color-surface-500));
}

.member-card-actions {
  @apply flex gap-2 pt-2;
  border-top: 1px solid rgba(var(--color-surface-200), 0.5);
}

.member-action-btn {
  @apply flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px];
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
}

.member-action-btn:hover {
  background: rgba(var(--color-surface-200), 0.8);
}

.member-action-btn-danger {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

.member-action-btn-danger:hover {
  background: rgba(var(--color-error-500), 0.15);
}

/* Action Buttons */
.action-btn {
  @apply p-2 rounded-lg transition-colors flex items-center justify-center min-w-[44px] min-h-[44px];
  color: rgb(var(--color-surface-400));
}

.action-btn:hover {
  background: rgb(var(--color-surface-200));
  color: rgb(var(--color-primary-500));
}

.action-btn-change-role {
  color: rgb(var(--color-surface-500));
}

.action-btn-change-role:hover {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.action-btn-danger:hover {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

/* Invite Card Styles */
.create-invite-btn-header {
  @apply flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors min-h-[44px];
  background: rgb(var(--color-primary-500));
}

.create-invite-btn-header:hover {
  background: rgb(var(--color-primary-600));
}

.empty-state {
  @apply text-center py-12;
}

.empty-state-text {
  @apply text-lg font-semibold;
  color: rgb(var(--color-surface-600));
}

.empty-state-subtext {
  @apply text-sm mt-1;
  color: rgb(var(--color-surface-400));
}

/* Invite Grid */
.invite-grid {
  @apply grid grid-cols-1 lg:grid-cols-2 gap-4;
}

.invite-card-item {
  @apply p-4 rounded-xl space-y-3;
  background: rgb(var(--color-surface-50));
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.invite-card-top {
  @apply flex items-center justify-between;
}

.invite-card-actions {
  @apply flex items-center gap-1;
}

.invite-action-btn {
  @apply p-2 rounded-lg transition-colors flex items-center justify-center min-w-[40px] min-h-[40px];
  color: rgb(var(--color-surface-400));
}

.invite-action-btn:hover {
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

.invite-action-btn-danger:hover {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

.invite-code-display {
  @apply block text-xl font-mono font-bold tracking-widest px-4 py-3 rounded-lg text-center;
  background: rgba(var(--color-primary-500), 0.05);
  color: rgb(var(--color-primary-600));
  border: 1px dashed rgba(var(--color-primary-500), 0.3);
}

.invite-meta {
  @apply flex flex-wrap gap-3 text-xs;
  color: rgb(var(--color-surface-500));
}

.invite-meta-item {
  @apply flex items-center gap-1;
}

.invite-usage {
  @apply space-y-2 pt-2;
  border-top: 1px solid rgba(var(--color-surface-200), 0.5);
}

.invite-usage-header {
  @apply flex items-center justify-between text-xs;
  color: rgb(var(--color-surface-600));
}

.invite-usage-percent {
  @apply font-semibold;
  color: rgb(var(--color-primary-600));
}

.invite-usage-unlimited {
  @apply flex items-center gap-2 text-xs pt-2;
  color: rgb(var(--color-surface-500));
  border-top: 1px solid rgba(var(--color-surface-200), 0.5);
}

/* Mobile Danger Zone */
.mobile-danger-zone {
  @apply mt-6 p-4 rounded-xl;
  background: rgba(var(--color-error-500), 0.05);
  border: 1px solid rgba(var(--color-error-500), 0.15);
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

/* Create Invite Modal - Role Cards */
.role-cards {
  @apply grid grid-cols-2 gap-3;
}

.role-card {
  @apply p-4 rounded-xl border-2 text-left transition-all;
  border-color: rgb(var(--color-surface-200));
  background: rgb(var(--color-surface-50));
}

.role-card:hover {
  border-color: rgb(var(--color-surface-300));
}

.role-card.selected {
  border-color: rgb(var(--color-primary-500));
  background: rgba(var(--color-primary-500), 0.05);
}

.role-card-icon {
  @apply w-10 h-10 rounded-lg flex items-center justify-center mb-3;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-500));
}

.role-card.selected .role-card-icon {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.role-card-title {
  @apply font-semibold text-base mb-1;
  color: rgb(var(--color-surface-900));
}

.role-card-desc {
  @apply text-xs;
  color: rgb(var(--color-surface-500));
}

/* Optional Settings */
.optional-settings {
  @apply rounded-xl overflow-hidden;
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.optional-settings-header {
  @apply px-4 py-3;
  background: rgba(var(--color-surface-100), 0.5);
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.optional-settings-title {
  @apply text-sm font-semibold;
  color: rgb(var(--color-surface-700));
}

.optional-settings-content {
  @apply p-4 space-y-4;
}

.setting-item {
  @apply space-y-3;
}

.setting-input-wrapper {
  @apply pl-14;
}

/* Role Change Modal */
.role-modal-member {
  @apply flex items-center gap-4 p-4 rounded-xl;
  background: rgba(var(--color-surface-100), 0.5);
}

.role-modal-member-info {
  @apply flex flex-col;
}

.role-modal-member-name {
  @apply font-semibold;
  color: rgb(var(--color-surface-900));
}

.role-modal-member-email {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.role-selection {
  @apply space-y-3;
}

.role-option {
  @apply flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all;
  border: 2px solid rgba(var(--color-surface-200), 0.8);
  background: rgb(var(--color-surface-50));
}

.role-option:hover {
  border-color: rgb(var(--color-surface-300));
}

.role-option.selected {
  border-color: rgb(var(--color-primary-500));
  background: rgba(var(--color-primary-500), 0.03);
}

.role-option-content {
  @apply flex-1;
}

.role-option-header {
  @apply flex items-center gap-2 mb-1;
}

.role-option-title {
  @apply font-semibold;
  color: rgb(var(--color-surface-900));
}

.role-option-desc {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

/* Delete Modal */
.delete-warning-icon {
  @apply flex justify-center;
  color: rgb(var(--color-error-500));
}

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

.delete-confirm-header {
  @apply flex flex-col items-center gap-2 text-center;
}

.delete-confirm-text {
  @apply text-lg font-semibold;
  color: rgb(var(--color-surface-900));
}

.delete-confirm-name {
  color: rgb(var(--color-error-600));
}

/* Toast Notification */
.toast-notification {
  @apply fixed bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium z-50;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.toast-notification.success {
  background: rgb(var(--color-success-500));
  color: white;
}

.toast-notification.error {
  background: rgb(var(--color-error-500));
  color: white;
}

.text-success {
  color: rgb(var(--color-success-500));
}

/* Toast Animation */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
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
</style>
