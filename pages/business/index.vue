<template>
  <div class="business-settings-page">
    <!-- Compact Header -->
    <header class="page-header">
      <div class="header-business-info">
        <div class="business-logo-compact">
          <img
            v-if="settings?.logoUrl"
            :src="settings.logoUrl"
            alt=""
            class="logo-image"
          />
          <span v-else class="logo-initial">{{ business?.name?.charAt(0) || '' }}</span>
        </div>
        <div class="business-details-compact">
          <h1 class="business-name-compact">{{ business?.name || 'Business' }}</h1>
          <span class="role-badge" :class="roleClass">{{ authStore.businessRole }}</span>
        </div>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="isLoadingBusiness" class="loading-container" aria-live="polite">
      <div class="loading-spinner"></div>
      <span>Loading business details...</span>
    </div>

    <template v-else-if="business">
      <!-- Tab Navigation -->
      <nav class="tab-navigation" role="tablist" aria-label="Business settings sections">
        <div class="tab-list-container">
          <div class="tab-list" ref="tabListRef">
            <button
              v-for="tab in visibleTabs"
              :key="tab.id"
              :id="`tab-${tab.id}`"
              role="tab"
              :aria-selected="activeTab === tab.id"
              :aria-controls="`panel-${tab.id}`"
              :tabindex="activeTab === tab.id ? 0 : -1"
              :class="['tab-button', { active: activeTab === tab.id }]"
              @click="setActiveTab(tab.id)"
              @keydown="handleTabKeydown($event, tab.id)"
            >
              <component :is="tab.icon" class="tab-icon" aria-hidden="true" />
              <span class="tab-label">{{ tab.label }}</span>
              <span
                v-if="tab.count !== undefined"
                class="tab-badge"
                :aria-label="`${tab.count} items`"
              >
                {{ tab.count }}
              </span>
            </button>
          </div>
          <!-- Active tab indicator -->
          <div
            class="tab-indicator"
            :style="indicatorStyle"
            aria-hidden="true"
          ></div>
        </div>
      </nav>

      <!-- Tab Panels -->
      <main class="tab-panels">
        <TransitionGroup name="tab-content" tag="div" class="panel-wrapper">
          <!-- Team Panel -->
          <section
            v-show="activeTab === 'team'"
            key="team"
            id="panel-team"
            role="tabpanel"
            aria-labelledby="tab-team"
            :tabindex="activeTab === 'team' ? 0 : -1"
            class="tab-panel"
          >
            <div class="panel-header">
              <div class="panel-header-text">
                <h2 class="panel-title">Team Members</h2>
                <p class="panel-description">Manage who has access to your business</p>
              </div>
            </div>

            <!-- Members List -->
            <div class="members-container">
              <!-- Desktop Table -->
              <div class="members-table-wrapper hidden lg:block">
                <table class="members-table" role="table">
                  <thead>
                    <tr>
                      <th scope="col" class="th-member">Member</th>
                      <th scope="col" class="th-role">Role</th>
                      <th scope="col" class="th-joined">Joined</th>
                      <th scope="col" class="th-actions">
                        <span class="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="member in business.members"
                      :key="member.id"
                      class="member-row"
                    >
                      <td class="td-member">
                        <div class="member-info">
                          <div class="member-avatar" :style="{ background: getMemberAvatarColor(member.id) }">
                            {{ member.user?.name?.charAt(0)?.toUpperCase() || '' }}
                          </div>
                          <div class="member-details">
                            <span class="member-name">{{ member.user?.name }}</span>
                            <span class="member-email">{{ member.user?.email }}</span>
                          </div>
                        </div>
                      </td>
                      <td class="td-role">
                        <span class="role-badge small" :class="getRoleClass(member.role)">
                          {{ member.role }}
                        </span>
                      </td>
                      <td class="td-joined">{{ formatDate(member.createdAt) }}</td>
                      <td class="td-actions">
                        <div class="action-buttons">
                          <button
                            v-if="canEditMember(member)"
                            class="action-btn"
                            aria-label="Edit member role"
                            title="Edit role"
                            @click="openEditRoleModal(member)"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            v-if="canRemoveMember(member)"
                            class="action-btn action-btn-danger"
                            aria-label="Remove member"
                            title="Remove"
                            @click="confirmRemoveMember(member)"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <span v-if="!canEditMember(member) && !canRemoveMember(member)" class="no-actions">-</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Mobile Card List -->
              <ul class="members-list lg:hidden" role="list">
                <li
                  v-for="member in business.members"
                  :key="member.id"
                  class="member-card"
                >
                  <div class="member-card-top">
                    <div class="member-info">
                      <div class="member-avatar" :style="{ background: getMemberAvatarColor(member.id) }">
                        {{ member.user?.name?.charAt(0)?.toUpperCase() || '' }}
                      </div>
                      <div class="member-details">
                        <span class="member-name">{{ member.user?.name }}</span>
                        <span class="member-email">{{ member.user?.email }}</span>
                      </div>
                    </div>
                    <span class="role-badge small" :class="getRoleClass(member.role)">
                      {{ member.role }}
                    </span>
                  </div>
                  <div class="member-card-bottom">
                    <span class="member-joined">Joined {{ formatDate(member.createdAt) }}</span>
                    <div class="member-card-actions" v-if="canEditMember(member) || canRemoveMember(member)">
                      <button
                        v-if="canEditMember(member)"
                        class="mobile-action-btn"
                        @click="openEditRoleModal(member)"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        v-if="canRemoveMember(member)"
                        class="mobile-action-btn mobile-action-btn-danger"
                        @click="confirmRemoveMember(member)"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          <!-- Invites Panel -->
          <section
            v-show="activeTab === 'invites'"
            key="invites"
            id="panel-invites"
            role="tabpanel"
            aria-labelledby="tab-invites"
            :tabindex="activeTab === 'invites' ? 0 : -1"
            class="tab-panel"
          >
            <div class="panel-header">
              <div class="panel-header-text">
                <h2 class="panel-title">Invite Codes</h2>
                <p class="panel-description">Share codes to add new members to your team</p>
              </div>
              <UiButton @click="showCreateInviteModal = true">
                <template #icon-left>
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </template>
                Create Code
              </UiButton>
            </div>

            <!-- Empty State -->
            <div v-if="!business.inviteCodes?.length" class="empty-state">
              <div class="empty-state-icon">
                <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <h3 class="empty-state-title">No invite codes yet</h3>
              <p class="empty-state-text">Create your first invite code to start adding team members</p>
              <UiButton class="mt-4" @click="showCreateInviteModal = true">
                Create Your First Invite
              </UiButton>
            </div>

            <!-- Invite Cards Grid -->
            <div v-else class="invite-grid">
              <article
                v-for="invite in business.inviteCodes"
                :key="invite.id"
                class="invite-card"
              >
                <div class="invite-card-header">
                  <span class="role-badge small" :class="getRoleClass(invite.role)">
                    {{ invite.role }}
                  </span>
                  <div class="invite-actions">
                    <button
                      class="invite-action-btn"
                      :class="{ copied: copiedCode === invite.code }"
                      :aria-label="copiedCode === invite.code ? 'Copied!' : 'Copy code'"
                      :title="copiedCode === invite.code ? 'Copied!' : 'Copy code'"
                      @click="copyCode(invite.code)"
                    >
                      <svg v-if="copiedCode !== invite.code" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      class="invite-action-btn"
                      :class="{ copied: copiedLink === invite.code }"
                      :aria-label="copiedLink === invite.code ? 'Link copied!' : 'Copy invite link'"
                      :title="copiedLink === invite.code ? 'Link copied!' : 'Share link'"
                      @click="copyLink(invite.code)"
                    >
                      <svg v-if="copiedLink !== invite.code" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      class="invite-action-btn invite-action-btn-danger"
                      aria-label="Delete invite code"
                      title="Delete"
                      @click="confirmDeleteInvite(invite)"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <code class="invite-code-display">{{ invite.code }}</code>

                <div class="invite-meta">
                  <div class="invite-meta-item">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span v-if="invite.expiresAt">Expires {{ formatDate(invite.expiresAt) }}</span>
                    <span v-else>No expiry</span>
                  </div>
                </div>

                <!-- Usage Progress -->
                <div v-if="invite.maxUses" class="invite-usage">
                  <div class="invite-usage-header">
                    <span>{{ invite.usedCount }} / {{ invite.maxUses }} uses</span>
                    <span class="invite-usage-percent">{{ Math.round((invite.usedCount / invite.maxUses) * 100) }}%</span>
                  </div>
                  <div class="progress-bar" role="progressbar" :aria-valuenow="invite.usedCount" :aria-valuemax="invite.maxUses">
                    <div
                      class="progress-bar-fill"
                      :style="{ width: `${(invite.usedCount / invite.maxUses) * 100}%` }"
                    ></div>
                  </div>
                </div>
                <div v-else class="invite-unlimited">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Unlimited uses</span>
                </div>
              </article>
            </div>
          </section>

          <!-- Settings Panel (OWNER only) -->
          <section
            v-show="activeTab === 'settings'"
            key="settings"
            id="panel-settings"
            role="tabpanel"
            aria-labelledby="tab-settings"
            :tabindex="activeTab === 'settings' ? 0 : -1"
            class="tab-panel"
          >
            <div v-if="isLoadingSettings" class="settings-loading">
              <div class="loading-spinner"></div>
              <span>Loading settings...</span>
            </div>
            <div v-else class="settings-sections">
              <!-- Logo Upload Section -->
              <div class="settings-section">
                <div class="settings-section-header">
                  <h2 class="settings-section-title">Business Logo</h2>
                  <p class="settings-section-description">Upload your logo. It appears in navigation and on receipts.</p>
                </div>
                <div class="logo-upload-area">
                  <BusinessLogoUpload
                    ref="logoUploadRef"
                    :model-value="settings?.logoUrl"
                    :loading="isUploadingLogo"
                    @upload="handleLogoUpload"
                    @delete="handleLogoDelete"
                    @error="handleLogoError"
                  />
                </div>
              </div>

              <!-- Tax Settings Section -->
              <div class="settings-section">
                <div class="settings-section-header">
                  <h2 class="settings-section-title">Tax Settings</h2>
                  <p class="settings-section-description">Configure tax rates for sales transactions</p>
                </div>
                <div class="settings-form">
                  <div class="settings-form-grid">
                    <UiFormGroup label="Tax Rate" for="tax-rate">
                      <UiNumberInput
                        id="tax-rate"
                        v-model="settingsForm.taxRate"
                        :min="0"
                        :max="100"
                        :step="1"
                        suffix="%"
                      />
                      <template #hint>Applied to sales (e.g., 8.25 for 8.25%)</template>
                    </UiFormGroup>
                    <UiFormGroup label="Tax Name" for="tax-name">
                      <UiInput
                        id="tax-name"
                        v-model="settingsForm.taxName"
                        placeholder="Sales Tax"
                        :maxlength="50"
                      />
                      <template #hint>Label shown on receipts</template>
                    </UiFormGroup>
                  </div>
                </div>
              </div>

              <!-- Receipt Settings Section -->
              <div class="settings-section">
                <div class="settings-section-header">
                  <h2 class="settings-section-title">Receipt Customization</h2>
                  <p class="settings-section-description">Customize what appears on customer receipts</p>
                </div>
                <div class="settings-form">
                  <div class="settings-form-stack">
                    <UiFormGroup label="Receipt Header" for="receipt-header">
                      <UiTextarea
                        id="receipt-header"
                        v-model="settingsForm.receiptHeader"
                        placeholder="Your business name, address, phone..."
                        :rows="3"
                        :maxlength="500"
                      />
                      <template #hint>Displayed at the top of receipts</template>
                    </UiFormGroup>
                    <UiFormGroup label="Receipt Footer" for="receipt-footer">
                      <UiTextarea
                        id="receipt-footer"
                        v-model="settingsForm.receiptFooter"
                        placeholder="Thank you for your business!"
                        :rows="3"
                        :maxlength="500"
                      />
                      <template #hint>Displayed at the bottom of receipts</template>
                    </UiFormGroup>
                  </div>
                </div>
              </div>

              <!-- Thermal Printer Section -->
              <div class="settings-section">
                <div class="settings-section-header">
                  <h2 class="settings-section-title">Thermal Printer</h2>
                  <p class="settings-section-description">Configure a network thermal printer for receipt printing</p>
                </div>
                <div class="settings-form">
                  <div class="settings-form-stack">
                    <!-- Enable Toggle -->
                    <div class="printer-toggle-row">
                      <UiToggle
                        v-model="settingsForm.thermalPrinterEnabled"
                        label="Enable Thermal Printer"
                        description="Use a network thermal printer instead of browser print"
                        label-position="right"
                      />
                    </div>

                    <!-- Printer Settings (shown when enabled) -->
                    <Transition name="slide-fade">
                      <div v-if="settingsForm.thermalPrinterEnabled" class="printer-settings">
                        <div class="settings-form-grid">
                          <UiFormGroup label="Printer Type" for="printer-type">
                            <UiSelect
                              id="printer-type"
                              v-model="settingsForm.thermalPrinterType"
                              :options="printerTypeOptions"
                              placeholder="Select printer type"
                            />
                            <template #hint>Most thermal printers use ESC/POS</template>
                          </UiFormGroup>

                          <UiFormGroup label="Paper Width" for="paper-width">
                            <UiSelect
                              id="paper-width"
                              v-model="settingsForm.thermalPrinterWidth"
                              :options="paperWidthOptions"
                            />
                            <template #hint>Characters per line (most use 48)</template>
                          </UiFormGroup>
                        </div>

                        <div class="settings-form-grid">
                          <UiFormGroup label="IP Address" for="printer-ip">
                            <UiInput
                              id="printer-ip"
                              v-model="settingsForm.thermalPrinterAddress"
                              placeholder="192.168.1.100"
                              :pattern="ipAddressPattern"
                            />
                            <template #hint>Network IP address of the printer</template>
                          </UiFormGroup>

                          <UiFormGroup label="Port" for="printer-port">
                            <UiNumberInput
                              id="printer-port"
                              v-model="settingsForm.thermalPrinterPort"
                              :min="1"
                              :max="65535"
                              placeholder="9100"
                            />
                            <template #hint>Default is 9100 for most printers</template>
                          </UiFormGroup>
                        </div>

                        <!-- Test Printer Button -->
                        <div class="printer-test-section">
                          <UiButton
                            variant="secondary"
                            :loading="isTestingPrinter"
                            loading-text="Testing..."
                            :disabled="!canTestPrinter"
                            @click="testPrinter"
                          >
                            <template #icon-left>
                              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </template>
                            Test Printer Connection
                          </UiButton>
                          <Transition name="fade">
                            <span v-if="printerTestResult" :class="['printer-test-result', printerTestResult.success ? 'success' : 'error']">
                              {{ printerTestResult.message }}
                            </span>
                          </Transition>
                        </div>
                      </div>
                    </Transition>
                  </div>
                </div>
              </div>

              <!-- Save Button -->
              <div class="settings-save">
                <UiButton :loading="isSavingSettings" loading-text="Saving..." @click="saveSettings">
                  Save All Settings
                </UiButton>
              </div>
            </div>
          </section>

          <!-- Danger Zone Panel (OWNER only) -->
          <section
            v-show="activeTab === 'danger'"
            key="danger"
            id="panel-danger"
            role="tabpanel"
            aria-labelledby="tab-danger"
            :tabindex="activeTab === 'danger' ? 0 : -1"
            class="tab-panel"
          >
            <div class="danger-zone-panel">
              <div class="danger-warning-box">
                <div class="danger-warning-icon">
                  <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 class="danger-warning-title">Danger Zone</h2>
                <p class="danger-warning-text">
                  Actions in this section are irreversible. Please proceed with caution.
                </p>
              </div>

              <div class="danger-action-card">
                <div class="danger-action-info">
                  <h3 class="danger-action-title">Delete Business</h3>
                  <p class="danger-action-description">
                    Permanently delete <strong>{{ business.name }}</strong> and all associated data including inventory items, team members, and invite codes.
                  </p>
                </div>
                <UiButton variant="danger" @click="showDeleteModal = true">
                  Delete Business
                </UiButton>
              </div>
            </div>
          </section>
        </TransitionGroup>
      </main>
    </template>

    <!-- Toast Notification -->
    <Transition name="toast">
      <div
        v-if="toastMessage"
        class="toast-notification"
        :class="toastType"
        role="alert"
        aria-live="polite"
      >
        <svg v-if="toastType === 'success'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- Create Invite Modal -->
    <UiModal
      v-model="showCreateInviteModal"
      title="Create Invite Code"
      size="md"
    >
      <div class="space-y-6">
        <!-- Role Selection -->
        <div>
          <label class="form-label-text mb-3 block">Select Role</label>
          <div class="role-selection-grid">
            <button
              type="button"
              :class="['role-selection-card', { selected: inviteForm.role === 'EMPLOYEE' }]"
              @click="inviteForm.role = 'EMPLOYEE'"
            >
              <div class="role-card-icon">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div class="role-card-content">
                <span class="role-card-title">Employee</span>
                <span class="role-card-description">Can view and edit inventory</span>
              </div>
            </button>
            <button
              v-if="authStore.isOwner"
              type="button"
              :class="['role-selection-card', { selected: inviteForm.role === 'BOSS' }]"
              @click="inviteForm.role = 'BOSS'"
            >
              <div class="role-card-icon">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div class="role-card-content">
                <span class="role-card-title">Boss</span>
                <span class="role-card-description">Full access to manage team</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Optional Settings -->
        <div class="invite-options">
          <div class="invite-options-header">
            <span class="invite-options-title">Optional Settings</span>
          </div>
          <div class="invite-options-content">
            <div class="invite-option-item">
              <UiToggle
                v-model="inviteForm.hasExpiry"
                label="Set expiration"
                description="Code expires after specified hours"
                label-position="right"
              />
              <div v-if="inviteForm.hasExpiry" class="invite-option-input">
                <UiFormGroup label="Hours until expiry" for="invite-expiry">
                  <UiNumberInput
                    id="invite-expiry"
                    v-model="inviteForm.expiryHours"
                    :min="1"
                    :max="720"
                    placeholder="24"
                  />
                </UiFormGroup>
              </div>
            </div>
            <div class="invite-option-item">
              <UiToggle
                v-model="inviteForm.hasMaxUses"
                label="Limit uses"
                description="Set maximum number of uses"
                label-position="right"
              />
              <div v-if="inviteForm.hasMaxUses" class="invite-option-input">
                <UiFormGroup label="Maximum uses" for="invite-max-uses">
                  <UiNumberInput
                    id="invite-max-uses"
                    v-model="inviteForm.maxUses"
                    :min="1"
                    :max="1000"
                    placeholder="10"
                  />
                </UiFormGroup>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="showCreateInviteModal = false">
          Cancel
        </UiButton>
        <UiButton :loading="isCreatingInvite" loading-text="Creating..." @click="handleCreateInvite">
          Create Invite
        </UiButton>
      </template>
    </UiModal>

    <!-- Edit Role Modal -->
    <UiModal
      v-model="showEditRoleModal"
      title="Change Member Role"
      size="md"
    >
      <div v-if="selectedMember" class="space-y-6">
        <!-- Member Preview -->
        <div class="member-preview">
          <div class="member-avatar large" :style="{ background: getMemberAvatarColor(selectedMember.id) }">
            {{ selectedMember.user?.name?.charAt(0)?.toUpperCase() || '' }}
          </div>
          <div class="member-preview-info">
            <span class="member-preview-name">{{ selectedMember.user?.name }}</span>
            <span class="member-preview-email">{{ selectedMember.user?.email }}</span>
          </div>
        </div>

        <!-- Role Selection -->
        <div class="role-radio-group">
          <label
            :class="['role-radio-option', { selected: editRoleForm.newRole === 'BOSS' }]"
          >
            <input
              type="radio"
              v-model="editRoleForm.newRole"
              value="BOSS"
              class="radio"
            />
            <div class="role-radio-content">
              <div class="role-radio-header">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span class="role-radio-title">Boss</span>
              </div>
              <p class="role-radio-description">Full access to manage team and inventory</p>
            </div>
          </label>
          <label
            :class="['role-radio-option', { selected: editRoleForm.newRole === 'EMPLOYEE' }]"
          >
            <input
              type="radio"
              v-model="editRoleForm.newRole"
              value="EMPLOYEE"
              class="radio"
            />
            <div class="role-radio-content">
              <div class="role-radio-header">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span class="role-radio-title">Employee</span>
              </div>
              <p class="role-radio-description">Can view and edit inventory items</p>
            </div>
          </label>
        </div>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="showEditRoleModal = false">
          Cancel
        </UiButton>
        <UiButton
          :loading="isChangingRole"
          loading-text="Saving..."
          :disabled="editRoleForm.newRole === selectedMember?.role"
          @click="saveRoleChange"
        >
          Save Changes
        </UiButton>
      </template>
    </UiModal>

    <!-- Delete Business Modal (Two-Step) -->
    <UiModal
      v-model="showDeleteModal"
      title="Delete Business"
      variant="danger"
      size="lg"
      :close-on-backdrop="!isDeletingBusiness"
    >
      <!-- Step 1: Warning -->
      <div v-if="deleteStep === 1" class="space-y-4">
        <div class="delete-warning-illustration">
          <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <p class="delete-warning-message">
          You are about to delete <strong>{{ business?.name }}</strong>
        </p>

        <div class="delete-consequences">
          <p class="delete-consequences-title">This will permanently delete:</p>
          <ul class="delete-consequences-list">
            <li>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span><strong>{{ inventoryItemCount }}</strong> inventory items</span>
            </li>
            <li>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span><strong>{{ business?.members?.length || 0 }}</strong> team members</span>
            </li>
            <li>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              <span><strong>{{ business?.inviteCodes?.length || 0 }}</strong> invite codes</span>
            </li>
            <li>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <span>All schema configuration</span>
            </li>
          </ul>
        </div>

        <div class="delete-final-warning">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>This action cannot be undone.</span>
        </div>
      </div>

      <!-- Step 2: Confirmation -->
      <div v-else class="space-y-4">
        <div class="delete-confirm-header">
          <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p class="delete-confirm-title">Final Confirmation</p>
        </div>

        <UiFormGroup for="delete-confirm-input">
          <template #label>
            <span>
              Type <strong class="delete-confirm-name">{{ business?.name }}</strong> to confirm
            </span>
          </template>
          <UiInput
            id="delete-confirm-input"
            v-model="deleteConfirmText"
            :placeholder="business?.name"
            autocomplete="off"
          />
        </UiFormGroup>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="handleDeleteBack">
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
          :disabled="deleteConfirmText.trim() !== business?.name"
          @click="handleDeleteBusiness"
        >
          Delete Business
        </UiButton>
      </template>
    </UiModal>

    <!-- Delete Member Confirmation Modal -->
    <UiModal
      v-model="showDeleteMemberModal"
      title="Remove Team Member"
      variant="danger"
      size="sm"
    >
      <p>Are you sure you want to remove <strong>{{ memberToDelete?.user?.name }}</strong> from the team?</p>
      <p class="text-sm text-surface-500 mt-2">This action cannot be undone.</p>

      <template #footer>
        <UiButton variant="secondary" @click="showDeleteMemberModal = false">Cancel</UiButton>
        <UiButton variant="danger" :loading="isDeletingMember" loading-text="Removing..." @click="executeRemoveMember">Remove Member</UiButton>
      </template>
    </UiModal>

    <!-- Delete Invite Code Confirmation Modal -->
    <UiModal
      v-model="showDeleteInviteModal"
      title="Delete Invite Code"
      variant="danger"
      size="sm"
    >
      <p>Are you sure you want to delete the invite code <strong class="font-mono">{{ inviteToDelete?.code }}</strong>?</p>
      <p class="text-sm text-surface-500 mt-2">This action cannot be undone. Anyone with this code will no longer be able to join.</p>

      <template #footer>
        <UiButton variant="secondary" @click="showDeleteInviteModal = false">Cancel</UiButton>
        <UiButton variant="danger" :loading="isDeletingInvite" loading-text="Deleting..." @click="executeDeleteInvite">Delete Code</UiButton>
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, nextTick, h, type VNode } from 'vue'
import type { Business, BusinessMember, InviteCode, BusinessSettings, BusinessSettingsUpdate } from '~/types/business'
import type { BusinessRole } from '~/types/user'

definePageMeta({
  middleware: 'auth',
})

// ============================================
// TYPES
// ============================================

interface Tab {
  id: string
  label: string
  icon: VNode
  count?: number
  roles: BusinessRole[]
}

// ============================================
// ICON COMPONENTS (using h() for inline SVGs)
// ============================================

const TeamIcon = h('svg', {
  class: 'w-5 h-5',
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  'aria-hidden': 'true'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
  })
])

const InviteIcon = h('svg', {
  class: 'w-5 h-5',
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  'aria-hidden': 'true'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z'
  })
])

const SettingsIcon = h('svg', {
  class: 'w-5 h-5',
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  'aria-hidden': 'true'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
  }),
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'
  })
])

const DangerIcon = h('svg', {
  class: 'w-5 h-5',
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  'aria-hidden': 'true'
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
  })
])

// ============================================
// COMPOSABLES & STORES
// ============================================

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
  getBusinessSettings,
  updateBusinessSettings,
  uploadBusinessLogo,
  deleteBusinessLogo,
} = useBusiness()

// ============================================
// PAGE STATE
// ============================================

const business = ref<Business | null>(null)
const isLoadingBusiness = ref(true)

// Settings state
const settings = ref<BusinessSettings | null>(null)
const isLoadingSettings = ref(false)
const isSavingSettings = ref(false)
const settingsForm = reactive({
  taxRate: 0,
  taxName: 'Tax',
  receiptHeader: '',
  receiptFooter: '',
  // Thermal printer settings
  thermalPrinterEnabled: false,
  thermalPrinterType: 'escpos-network' as string | undefined,
  thermalPrinterAddress: '' as string,
  thermalPrinterPort: 9100 as number | undefined,
  thermalPrinterWidth: 48 as number | undefined,
})

// Thermal printer state
const isTestingPrinter = ref(false)
const printerTestResult = ref<{ success: boolean; message: string } | null>(null)

// Printer configuration options
const printerTypeOptions = [
  { label: 'ESC/POS Network', value: 'escpos-network' },
  { label: 'Star Printer', value: 'star' },
  { label: 'Epson', value: 'epson' },
]

const paperWidthOptions = [
  { label: '32 characters (58mm)', value: 32 },
  { label: '42 characters (76mm)', value: 42 },
  { label: '48 characters (80mm)', value: 48 },
]

// IP address validation pattern
const ipAddressPattern = '^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'

/**
 * Determines if the test printer button should be enabled.
 */
const canTestPrinter = computed(() => {
  return (
    settingsForm.thermalPrinterEnabled &&
    settingsForm.thermalPrinterAddress &&
    settingsForm.thermalPrinterAddress.trim() !== '' &&
    settingsForm.thermalPrinterPort &&
    settingsForm.thermalPrinterPort > 0
  )
})

// Logo upload state
const logoUploadRef = ref<InstanceType<typeof import('~/components/business/LogoUpload.vue').default> | null>(null)
const isUploadingLogo = ref(false)

// ============================================
// TABS CONFIGURATION
// ============================================

const allTabs: Tab[] = [
  {
    id: 'team',
    label: 'Team',
    icon: TeamIcon,
    roles: ['OWNER', 'BOSS', 'EMPLOYEE'],
  },
  {
    id: 'invites',
    label: 'Invites',
    icon: InviteIcon,
    roles: ['OWNER', 'BOSS'],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    roles: ['OWNER'],
  },
  {
    id: 'danger',
    label: 'Danger Zone',
    icon: DangerIcon,
    roles: ['OWNER'],
  },
]

const visibleTabs = computed(() => {
  const currentRole = authStore.businessRole
  if (!currentRole) return []

  return allTabs
    .filter(tab => tab.roles.includes(currentRole))
    .map(tab => ({
      ...tab,
      count: tab.id === 'team' ? business.value?.members?.length :
             tab.id === 'invites' ? business.value?.inviteCodes?.length :
             undefined,
    }))
})

// ============================================
// TAB STATE
// ============================================

const activeTab = ref('team')
const tabListRef = ref<HTMLElement | null>(null)
const indicatorStyle = ref({ left: '0px', width: '0px' })

function setActiveTab(tabId: string) {
  activeTab.value = tabId
  updateIndicator()
}

function updateIndicator() {
  nextTick(() => {
    if (!tabListRef.value) return
    const activeButton = tabListRef.value.querySelector(`[aria-selected="true"]`) as HTMLElement
    if (activeButton) {
      indicatorStyle.value = {
        left: `${activeButton.offsetLeft}px`,
        width: `${activeButton.offsetWidth}px`,
      }
    }
  })
}

function handleTabKeydown(event: KeyboardEvent, currentTabId: string) {
  const tabIds = visibleTabs.value.map(t => t.id)
  const currentIndex = tabIds.indexOf(currentTabId)
  let newIndex = currentIndex

  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      newIndex = currentIndex > 0 ? currentIndex - 1 : tabIds.length - 1
      break
    case 'ArrowRight':
      event.preventDefault()
      newIndex = currentIndex < tabIds.length - 1 ? currentIndex + 1 : 0
      break
    case 'Home':
      event.preventDefault()
      newIndex = 0
      break
    case 'End':
      event.preventDefault()
      newIndex = tabIds.length - 1
      break
    default:
      return
  }

  setActiveTab(tabIds[newIndex])
  nextTick(() => {
    const newTabButton = document.getElementById(`tab-${tabIds[newIndex]}`)
    newTabButton?.focus()
  })
}

// Watch for tab changes to update indicator
watch(activeTab, updateIndicator, { immediate: true })

// Watch for role changes - reset to 'team' if current tab is no longer visible
watch(() => authStore.businessRole, () => {
  const visibleTabIds = visibleTabs.value.map(t => t.id)
  if (!visibleTabIds.includes(activeTab.value)) {
    activeTab.value = 'team'
  }
  nextTick(updateIndicator)
})

// ============================================
// ROLE HELPERS
// ============================================

const roleClass = computed(() => getRoleClass(authStore.businessRole))

function getRoleClass(role: BusinessRole | string | null): string {
  switch (role) {
    case 'OWNER': return 'role-owner'
    case 'BOSS': return 'role-boss'
    case 'EMPLOYEE': return 'role-employee'
    default: return ''
  }
}

function canEditMember(member: BusinessMember): boolean {
  // Only OWNER can edit member roles
  if (authStore.businessRole !== 'OWNER') return false
  // Cannot edit the owner or yourself
  if (member.role === 'OWNER') return false
  if (member.userId === authStore.user?.id) return false
  return true
}

function canRemoveMember(member: BusinessMember): boolean {
  // Cannot remove yourself
  if (member.userId === authStore.user?.id) return false
  // Cannot remove the owner
  if (member.role === 'OWNER') return false
  // OWNER can remove anyone except themselves and other owners
  if (authStore.businessRole === 'OWNER') return true
  // BOSS can remove employees
  if (authStore.businessRole === 'BOSS' && member.role === 'EMPLOYEE') return true
  return false
}

// Generate consistent avatar colors based on member ID
function getMemberAvatarColor(memberId: string): string {
  const colors = [
    'linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-accent-500)))',
    'linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-primary-400)))',
    'linear-gradient(135deg, rgb(var(--color-primary-400)), rgb(var(--color-accent-400)))',
    'linear-gradient(135deg, rgb(var(--color-accent-400)), rgb(var(--color-primary-500)))',
    'linear-gradient(135deg, rgb(var(--color-primary-600)), rgb(var(--color-accent-600)))',
  ]
  // Simple hash based on member ID
  let hash = 0
  for (let i = 0; i < memberId.length; i++) {
    hash = ((hash << 5) - hash) + memberId.charCodeAt(i)
    hash = hash & hash
  }
  return colors[Math.abs(hash) % colors.length]
}

// ============================================
// FORMATTERS
// ============================================

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ============================================
// TOAST
// ============================================

const toastMessage = ref('')
const toastType = ref<'success' | 'error'>('success')
let toastTimeout: ReturnType<typeof setTimeout> | null = null

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toastMessage.value = message
  toastType.value = type
  if (toastTimeout) clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => {
    toastMessage.value = ''
  }, 3000)
}

// ============================================
// DATA LOADING
// ============================================

async function loadBusiness() {
  isLoadingBusiness.value = true
  try {
    const result = await getBusiness()
    if (result.success) {
      business.value = result.business
    }
  } catch {
    showToast('Failed to load business', 'error')
  } finally {
    isLoadingBusiness.value = false
  }
}

// Fetch inventory item count for the delete modal
const inventoryItemCount = ref(0)

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

// Settings loading
async function loadSettings() {
  isLoadingSettings.value = true
  try {
    const result = await getBusinessSettings()
    if (result.success) {
      settings.value = result.settings
      settingsForm.taxRate = result.settings.taxRate
      settingsForm.taxName = result.settings.taxName
      settingsForm.receiptHeader = result.settings.receiptHeader || ''
      settingsForm.receiptFooter = result.settings.receiptFooter || ''
      // Thermal printer settings
      settingsForm.thermalPrinterEnabled = result.settings.thermalPrinterEnabled ?? false
      settingsForm.thermalPrinterType = result.settings.thermalPrinterType ?? 'escpos-network'
      settingsForm.thermalPrinterAddress = result.settings.thermalPrinterAddress ?? ''
      settingsForm.thermalPrinterPort = result.settings.thermalPrinterPort ?? 9100
      settingsForm.thermalPrinterWidth = result.settings.thermalPrinterWidth ?? 48
    }
  } catch {
    // Handle error silently
  } finally {
    isLoadingSettings.value = false
  }
}

// ============================================
// INVITE CODE ACTIONS
// ============================================

const copiedCode = ref<string | null>(null)
const copiedLink = ref<string | null>(null)
const showCreateInviteModal = ref(false)
const isCreatingInvite = ref(false)
const inviteForm = reactive({
  role: 'EMPLOYEE' as 'BOSS' | 'EMPLOYEE',
  hasExpiry: false,
  expiryHours: 24,
  hasMaxUses: false,
  maxUses: 10,
})

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    copiedCode.value = code
    showToast('Code copied to clipboard')
    setTimeout(() => { copiedCode.value = null }, 2000)
  } catch {
    showToast('Failed to copy code', 'error')
  }
}

async function copyLink(code: string) {
  try {
    const link = `${window.location.origin}/business/join?code=${code}`
    await navigator.clipboard.writeText(link)
    copiedLink.value = code
    showToast('Invite link copied')
    setTimeout(() => { copiedLink.value = null }, 2000)
  } catch {
    showToast('Failed to copy link', 'error')
  }
}

function confirmDeleteInvite(invite: InviteCode) {
  inviteToDelete.value = invite
  showDeleteInviteModal.value = true
}

async function executeDeleteInvite() {
  if (!inviteToDelete.value) return
  isDeletingInvite.value = true
  try {
    await deleteInviteCode(inviteToDelete.value.id)
    showDeleteInviteModal.value = false
    inviteToDelete.value = null
    await loadBusiness()
    showToast('Invite code deleted')
  } catch {
    showToast('Failed to delete invite code', 'error')
  } finally {
    isDeletingInvite.value = false
  }
}

async function handleCreateInvite() {
  isCreatingInvite.value = true
  try {
    await createInviteCode({
      role: inviteForm.role,
      expiresInHours: inviteForm.hasExpiry ? inviteForm.expiryHours : undefined,
      maxUses: inviteForm.hasMaxUses ? inviteForm.maxUses : undefined,
    })
    showCreateInviteModal.value = false
    // Reset form
    inviteForm.role = 'EMPLOYEE'
    inviteForm.hasExpiry = false
    inviteForm.hasMaxUses = false
    inviteForm.expiryHours = 24
    inviteForm.maxUses = 10
    await loadBusiness()
    showToast('Invite code created')
  } catch {
    showToast('Failed to create invite code', 'error')
  } finally {
    isCreatingInvite.value = false
  }
}

// ============================================
// EDIT ROLE MODAL
// ============================================

const showEditRoleModal = ref(false)
const selectedMember = ref<BusinessMember | null>(null)
const isChangingRole = ref(false)
const editRoleForm = reactive({
  newRole: 'EMPLOYEE' as 'BOSS' | 'EMPLOYEE',
})

// Delete member modal state
const showDeleteMemberModal = ref(false)
const memberToDelete = ref<BusinessMember | null>(null)
const isDeletingMember = ref(false)

// Delete invite modal state
const showDeleteInviteModal = ref(false)
const inviteToDelete = ref<InviteCode | null>(null)
const isDeletingInvite = ref(false)

function openEditRoleModal(member: BusinessMember) {
  selectedMember.value = member
  editRoleForm.newRole = member.role === 'OWNER' ? 'BOSS' : member.role as 'BOSS' | 'EMPLOYEE'
  showEditRoleModal.value = true
}

async function saveRoleChange() {
  if (!selectedMember.value) return
  isChangingRole.value = true
  try {
    await updateMemberRole(selectedMember.value.id, editRoleForm.newRole)
    await loadBusiness()
    showEditRoleModal.value = false
    showToast(`Role changed to ${editRoleForm.newRole}`)
  } catch {
    showToast('Failed to change role', 'error')
  } finally {
    isChangingRole.value = false
  }
}

// ============================================
// REMOVE MEMBER
// ============================================

function confirmRemoveMember(member: BusinessMember) {
  memberToDelete.value = member
  showDeleteMemberModal.value = true
}

async function executeRemoveMember() {
  if (!memberToDelete.value) return
  isDeletingMember.value = true
  try {
    await removeMember(memberToDelete.value.id)
    showDeleteMemberModal.value = false
    memberToDelete.value = null
    await loadBusiness()
    showToast('Member removed')
  } catch {
    showToast('Failed to remove member', 'error')
  } finally {
    isDeletingMember.value = false
  }
}

// ============================================
// SETTINGS
// ============================================

async function saveSettings() {
  isSavingSettings.value = true
  // Clear any previous printer test result when saving
  printerTestResult.value = null

  try {
    const data: BusinessSettingsUpdate = {
      taxRate: settingsForm.taxRate,
      taxName: settingsForm.taxName,
      receiptHeader: settingsForm.receiptHeader || null,
      receiptFooter: settingsForm.receiptFooter || null,
      // Thermal printer settings
      thermalPrinterEnabled: settingsForm.thermalPrinterEnabled,
      thermalPrinterType: settingsForm.thermalPrinterType || null,
      thermalPrinterAddress: settingsForm.thermalPrinterAddress || null,
      thermalPrinterPort: settingsForm.thermalPrinterPort,
      thermalPrinterWidth: settingsForm.thermalPrinterWidth,
    }
    const result = await updateBusinessSettings(data)
    if (result.success) {
      settings.value = result.settings
      showToast('Settings saved')
    } else {
      showToast('Failed to save settings', 'error')
    }
  } catch {
    showToast('Failed to save settings', 'error')
  } finally {
    isSavingSettings.value = false
  }
}

/**
 * Tests the thermal printer connection by sending a test page.
 */
async function testPrinter() {
  if (!canTestPrinter.value) return

  isTestingPrinter.value = true
  printerTestResult.value = null

  try {
    // First, save the current settings to ensure the printer config is persisted
    await saveSettings()

    // Then test the printer
    const response = await authFetch<{ success: boolean; message?: string; error?: string }>('/api/receipt/test-print', {
      method: 'POST',
      body: {},
    })

    if (response.success) {
      printerTestResult.value = {
        success: true,
        message: 'Test page sent successfully!',
      }
    } else {
      printerTestResult.value = {
        success: false,
        message: response.error || 'Printer test failed',
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to test printer'
    printerTestResult.value = {
      success: false,
      message: errorMessage,
    }
  } finally {
    isTestingPrinter.value = false
  }
}

// Logo handlers
async function handleLogoUpload(imageBase64: string) {
  if (isUploadingLogo.value) return

  isUploadingLogo.value = true
  try {
    const result = await uploadBusinessLogo(imageBase64)
    if (result.success) {
      if (settings.value) {
        settings.value.logoUrl = result.logoUrl ?? null
      }
      logoUploadRef.value?.onUploadComplete()
      showToast('Logo uploaded successfully')
    } else {
      logoUploadRef.value?.onError(result.error)
      showToast(result.error, 'error')
    }
  } catch {
    const errorMsg = 'Failed to upload logo. Please try again.'
    logoUploadRef.value?.onError(errorMsg)
    showToast(errorMsg, 'error')
  } finally {
    isUploadingLogo.value = false
  }
}

async function handleLogoDelete() {
  try {
    const result = await deleteBusinessLogo()
    if (result.success) {
      if (settings.value) {
        settings.value.logoUrl = null
        settings.value.logoPublicId = null
      }
      logoUploadRef.value?.onDeleteComplete()
      showToast('Logo removed successfully')
    } else {
      logoUploadRef.value?.onError(result.error)
      showToast(result.error, 'error')
    }
  } catch {
    const errorMsg = 'Failed to delete logo. Please try again.'
    logoUploadRef.value?.onError(errorMsg)
    showToast(errorMsg, 'error')
  }
}

function handleLogoError(message: string) {
  showToast(message, 'error')
}

// ============================================
// DELETE BUSINESS
// ============================================

const showDeleteModal = ref(false)
const deleteStep = ref<1 | 2>(1)
const deleteConfirmText = ref('')
const isDeletingBusiness = ref(false)

function handleDeleteBack() {
  if (deleteStep.value === 2) {
    deleteStep.value = 1
    deleteConfirmText.value = ''
  } else {
    showDeleteModal.value = false
  }
}

async function handleDeleteBusiness() {
  if (deleteConfirmText.value.trim() !== business.value?.name) return

  isDeletingBusiness.value = true
  try {
    await deleteBusiness()
    showDeleteModal.value = false
    router.push('/business/select')
  } catch {
    showToast('Failed to delete business', 'error')
  } finally {
    isDeletingBusiness.value = false
  }
}

// Reset delete modal when closed
watch(showDeleteModal, (isOpen) => {
  if (!isOpen) {
    deleteStep.value = 1
    deleteConfirmText.value = ''
  }
})

// ============================================
// LIFECYCLE
// ============================================

onMounted(async () => {
  await loadBusiness()
  fetchInventoryCount()
  if (authStore.isOwner) {
    loadSettings()
  }

  // Check for tab query parameter and navigate to that tab if valid
  const route = useRoute()
  const tabParam = route.query.tab as string
  if (tabParam && visibleTabs.value.some(t => t.id === tabParam)) {
    activeTab.value = tabParam
  }

  updateIndicator()
  window.addEventListener('resize', updateIndicator)
})
</script>

<style scoped>
/* ============================================
   PAGE LAYOUT
   ============================================ */

.business-settings-page {
  @apply min-h-screen;
  background: rgb(var(--color-surface-50));
}

/* ============================================
   HEADER
   ============================================ */

.page-header {
  @apply sticky top-0 z-30 flex items-center justify-center gap-4 px-4 py-3 md:px-6 md:py-4;
  background: rgb(var(--color-surface-50));
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.header-business-info {
  @apply flex items-center gap-3;
}

.business-logo-compact {
  @apply w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0;
  background: rgba(var(--color-surface-100), 0.8);
}

.logo-image {
  @apply w-full h-full object-contain;
}

.logo-initial {
  @apply text-lg font-bold text-white;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-accent-500)));
  @apply w-full h-full flex items-center justify-center;
}

.business-details-compact {
  @apply flex flex-col gap-1;
}

.business-name-compact {
  @apply text-base md:text-lg font-semibold leading-tight;
  color: rgb(var(--color-surface-900));
}


/* ============================================
   LOADING STATE
   ============================================ */

.loading-container {
  @apply flex items-center gap-3 justify-center py-12;
  color: rgb(var(--color-surface-500));
}

.loading-spinner {
  @apply w-5 h-5 border-2 rounded-full animate-spin;
  border-color: rgb(var(--color-primary-500));
  border-top-color: transparent;
}

.settings-loading {
  @apply flex items-center gap-3 justify-center py-12;
  color: rgb(var(--color-surface-500));
}

/* ============================================
   TAB NAVIGATION
   ============================================ */

.tab-navigation {
  @apply sticky top-[70px] md:top-[88px] z-20 px-4 md:px-6;
  background: rgb(var(--color-surface-50));
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.tab-list-container {
  @apply relative max-w-4xl mx-auto overflow-x-auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tab-list-container::-webkit-scrollbar {
  display: none;
}

.tab-list {
  @apply flex gap-1 md:gap-2;
}

.tab-button {
  @apply relative flex items-center gap-2 px-3 py-3 md:px-4 md:py-3.5 text-sm font-medium transition-colors whitespace-nowrap min-h-[48px];
  color: rgb(var(--color-surface-500));
}

.tab-button:hover {
  color: rgb(var(--color-surface-700));
}

.tab-button.active {
  color: rgb(var(--color-primary-600));
}

.tab-button:focus-visible {
  @apply outline-none;
  box-shadow: inset 0 0 0 2px rgb(var(--color-primary-500));
  border-radius: 0.5rem;
}

.tab-icon {
  @apply w-5 h-5 flex-shrink-0;
}

.tab-label {
  @apply hidden sm:inline;
}

.tab-badge {
  @apply px-1.5 py-0.5 rounded-full text-xs font-semibold;
  background: rgba(var(--color-surface-200), 0.8);
  color: rgb(var(--color-surface-600));
}

.tab-button.active .tab-badge {
  background: rgba(var(--color-primary-500), 0.15);
  color: rgb(var(--color-primary-600));
}

.tab-indicator {
  @apply absolute bottom-0 h-0.5 rounded-full transition-all duration-300 ease-out;
  background: rgb(var(--color-primary-500));
}

/* ============================================
   TAB PANELS
   ============================================ */

.tab-panels {
  @apply px-4 py-6 md:px-6 md:py-8;
}

.panel-wrapper {
  @apply max-w-4xl mx-auto;
}

.tab-panel {
  @apply space-y-6;
}

/* Tab content animation */
.tab-content-enter-active,
.tab-content-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.tab-content-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.tab-content-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ============================================
   PANEL HEADER
   ============================================ */

.panel-header {
  @apply flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4;
}

.panel-header-text {
  @apply space-y-1;
}

.panel-title {
  @apply text-xl md:text-2xl font-bold;
  color: rgb(var(--color-surface-900));
}

.panel-description {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

/* ============================================
   ROLE BADGES
   ============================================ */

.role-badge {
  @apply inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide;
  width: fit-content;
}

.role-badge.small {
  @apply px-2 py-0.5 text-[10px];
}

.role-owner {
  background: rgba(var(--color-primary-500), 0.12);
  color: rgb(var(--color-primary-600));
}

.role-boss {
  background: rgba(var(--color-accent-500), 0.12);
  color: rgb(var(--color-accent-600));
}

.role-employee {
  background: rgba(var(--color-surface-500), 0.12);
  color: rgb(var(--color-surface-600));
}

/* ============================================
   MEMBERS TABLE (Desktop)
   ============================================ */

.members-container {
  @apply mt-6;
}

.members-table-wrapper {
  @apply rounded-xl overflow-hidden;
  background: rgb(var(--color-surface-50));
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.members-table {
  @apply w-full;
}

.members-table th {
  @apply text-left text-xs font-semibold uppercase tracking-wider px-4 py-3;
  color: rgb(var(--color-surface-500));
  background: rgba(var(--color-surface-100), 0.6);
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.th-member { @apply w-2/5; }
.th-role { @apply w-1/5; }
.th-joined { @apply w-1/5; }
.th-actions { @apply w-1/5 text-right; }

.members-table td {
  @apply px-4 py-4;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.5);
}

.member-row:last-child td {
  border-bottom: none;
}

.member-row:hover {
  background: rgba(var(--color-primary-500), 0.03);
}

.member-info {
  @apply flex items-center gap-3;
}

.member-avatar {
  @apply w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0;
}

.member-avatar.large {
  @apply w-14 h-14 text-lg;
}

.member-details {
  @apply flex flex-col;
}

.member-name {
  @apply font-medium;
  color: rgb(var(--color-surface-900));
}

.member-email {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.td-joined {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.action-buttons {
  @apply flex items-center justify-end gap-1;
}

.action-btn {
  @apply p-2.5 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center;
  color: rgb(var(--color-surface-400));
}

.action-btn:hover {
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
}

.action-btn-danger:hover {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

.no-actions {
  @apply text-sm px-2;
  color: rgb(var(--color-surface-300));
}

/* ============================================
   MEMBERS LIST (Mobile)
   ============================================ */

.members-list {
  @apply space-y-3;
}

.member-card {
  @apply p-4 rounded-xl space-y-3;
  background: rgb(var(--color-surface-50));
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.member-card-top {
  @apply flex items-center justify-between gap-3;
}

.member-card-bottom {
  @apply flex items-center justify-between gap-3 pt-3;
  border-top: 1px solid rgba(var(--color-surface-200), 0.5);
}

.member-joined {
  @apply text-xs;
  color: rgb(var(--color-surface-500));
}

.member-card-actions {
  @apply flex gap-2;
}

.mobile-action-btn {
  @apply flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[40px];
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
}

.mobile-action-btn:hover {
  background: rgba(var(--color-surface-200), 0.8);
}

.mobile-action-btn-danger {
  background: rgba(var(--color-error-500), 0.08);
  color: rgb(var(--color-error-600));
}

.mobile-action-btn-danger:hover {
  background: rgba(var(--color-error-500), 0.15);
}

/* ============================================
   INVITE CODES
   ============================================ */

.empty-state {
  @apply text-center py-12 px-4;
}

.empty-state-icon {
  @apply flex justify-center mb-4;
  color: rgb(var(--color-surface-300));
}

.empty-state-title {
  @apply text-lg font-semibold mb-1;
  color: rgb(var(--color-surface-700));
}

.empty-state-text {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.invite-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4 mt-6;
}

.invite-card {
  @apply p-4 rounded-xl space-y-3;
  background: rgb(var(--color-surface-50));
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.invite-card-header {
  @apply flex items-center justify-between;
}

.invite-actions {
  @apply flex items-center gap-1;
}

.invite-action-btn {
  @apply p-2 rounded-lg transition-all min-w-[40px] min-h-[40px] flex items-center justify-center;
  color: rgb(var(--color-surface-400));
}

.invite-action-btn:hover {
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

.invite-action-btn.copied {
  color: rgb(var(--color-success-500));
}

.invite-action-btn-danger:hover {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

.invite-code-display {
  @apply block text-lg md:text-xl font-mono font-bold tracking-widest px-4 py-3 rounded-lg text-center;
  background: rgba(var(--color-primary-500), 0.06);
  color: rgb(var(--color-primary-600));
  border: 1px dashed rgba(var(--color-primary-500), 0.25);
}

.invite-meta {
  @apply flex flex-wrap gap-3 text-xs;
  color: rgb(var(--color-surface-500));
}

.invite-meta-item {
  @apply flex items-center gap-1.5;
}

.invite-usage {
  @apply space-y-2 pt-3;
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

.invite-unlimited {
  @apply flex items-center gap-2 text-xs pt-3;
  color: rgb(var(--color-surface-500));
  border-top: 1px solid rgba(var(--color-surface-200), 0.5);
}

.progress-bar {
  @apply h-2 rounded-full overflow-hidden;
  background: rgba(var(--color-surface-200), 0.5);
}

.progress-bar-fill {
  @apply h-full rounded-full transition-all;
  background: rgb(var(--color-primary-500));
}

/* ============================================
   SETTINGS PANEL
   ============================================ */

.settings-sections {
  @apply space-y-8;
}

.settings-section {
  @apply p-4 md:p-6 rounded-xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.settings-section-header {
  @apply mb-4;
}

.settings-section-title {
  @apply text-lg font-semibold;
  color: rgb(var(--color-surface-900));
}

.settings-section-description {
  @apply text-sm mt-1;
  color: rgb(var(--color-surface-500));
}

.settings-form {
  @apply space-y-4;
}

.settings-form-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

.settings-form-stack {
  @apply space-y-4;
}

.settings-save {
  @apply flex justify-end pt-4;
  border-top: 1px solid rgba(var(--color-surface-200), 0.5);
}

/* Logo Upload */
.logo-upload-area {
  @apply flex items-center gap-4;
}

/* ============================================
   DANGER ZONE PANEL
   ============================================ */

.danger-zone-panel {
  @apply space-y-6;
}

.danger-warning-box {
  @apply text-center py-8 px-4 rounded-xl;
  background: rgba(var(--color-error-500), 0.05);
  border: 1px solid rgba(var(--color-error-500), 0.15);
}

.danger-warning-icon {
  @apply flex justify-center mb-4;
  color: rgb(var(--color-error-500));
}

.danger-warning-title {
  @apply text-xl font-bold mb-2;
  color: rgb(var(--color-error-600));
}

.danger-warning-text {
  @apply text-sm;
  color: rgb(var(--color-surface-600));
}

.danger-action-card {
  @apply flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl;
  background: rgb(var(--color-surface-50));
  border: 1px solid rgba(var(--color-error-500), 0.2);
}

.danger-action-info {
  @apply space-y-1;
}

.danger-action-title {
  @apply font-semibold;
  color: rgb(var(--color-surface-900));
}

.danger-action-description {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.danger-action-description strong {
  color: rgb(var(--color-surface-700));
}

/* ============================================
   MODALS
   ============================================ */

/* Role Selection Cards (Create Invite) */
.role-selection-grid {
  @apply grid grid-cols-1 sm:grid-cols-2 gap-3;
}

.role-selection-card {
  @apply flex items-start gap-3 p-4 rounded-xl text-left transition-all;
  border: 2px solid rgba(var(--color-surface-200), 0.8);
  background: rgb(var(--color-surface-50));
}

.role-selection-card:hover {
  border-color: rgb(var(--color-surface-300));
}

.role-selection-card.selected {
  border-color: rgb(var(--color-primary-500));
  background: rgba(var(--color-primary-500), 0.04);
}

.role-card-icon {
  @apply w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-500));
}

.role-selection-card.selected .role-card-icon {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.role-card-content {
  @apply flex flex-col gap-0.5;
}

.role-card-title {
  @apply font-semibold;
  color: rgb(var(--color-surface-900));
}

.role-card-description {
  @apply text-xs;
  color: rgb(var(--color-surface-500));
}

/* Invite Options */
.invite-options {
  @apply rounded-xl overflow-hidden;
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.invite-options-header {
  @apply px-4 py-3;
  background: rgba(var(--color-surface-100), 0.5);
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.invite-options-title {
  @apply text-sm font-semibold;
  color: rgb(var(--color-surface-700));
}

.invite-options-content {
  @apply p-4 space-y-4;
}

.invite-option-item {
  @apply space-y-3;
}

.invite-option-input {
  @apply pl-14;
}

/* Member Preview (Edit Role) */
.member-preview {
  @apply flex items-center gap-4 p-4 rounded-xl;
  background: rgba(var(--color-surface-100), 0.5);
}

.member-preview-info {
  @apply flex flex-col;
}

.member-preview-name {
  @apply font-semibold;
  color: rgb(var(--color-surface-900));
}

.member-preview-email {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

/* Role Radio Options */
.role-radio-group {
  @apply space-y-3;
}

.role-radio-option {
  @apply flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all;
  border: 2px solid rgba(var(--color-surface-200), 0.8);
  background: rgb(var(--color-surface-50));
}

.role-radio-option:hover {
  border-color: rgb(var(--color-surface-300));
}

.role-radio-option.selected {
  border-color: rgb(var(--color-primary-500));
  background: rgba(var(--color-primary-500), 0.03);
}

.role-radio-content {
  @apply flex-1;
}

.role-radio-header {
  @apply flex items-center gap-2 mb-1;
  color: rgb(var(--color-surface-500));
}

.role-radio-option.selected .role-radio-header {
  color: rgb(var(--color-primary-600));
}

.role-radio-title {
  @apply font-semibold;
  color: rgb(var(--color-surface-900));
}

.role-radio-description {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

/* Delete Modal */
.delete-warning-illustration {
  @apply flex justify-center;
  color: rgb(var(--color-error-500));
}

.delete-warning-message {
  @apply text-center text-sm;
  color: rgb(var(--color-surface-700));
}

.delete-warning-message strong {
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

.delete-final-warning {
  @apply flex items-center gap-3 p-4 rounded-lg text-sm font-medium;
  background: rgba(var(--color-error-500), 0.08);
  border: 1px solid rgba(var(--color-error-500), 0.15);
  color: rgb(var(--color-error-600));
}

.delete-confirm-header {
  @apply flex flex-col items-center gap-2 text-center;
  color: rgb(var(--color-error-500));
}

.delete-confirm-title {
  @apply text-lg font-semibold;
  color: rgb(var(--color-surface-900));
}

.delete-confirm-name {
  color: rgb(var(--color-error-600));
}

/* ============================================
   TOAST NOTIFICATION
   ============================================ */

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

.toast-enter-active,
.toast-leave-active {
  transition: all 300ms ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}

/* ============================================
   UTILITIES
   ============================================ */

.sr-only {
  @apply absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0;
  clip: rect(0, 0, 0, 0);
}

.form-label-text {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-700));
}

.radio {
  @apply w-4 h-4 mt-1 flex-shrink-0;
  accent-color: rgb(var(--color-primary-500));
}

/* ============================================
   THERMAL PRINTER SETTINGS
   ============================================ */

.printer-toggle-row {
  @apply py-2;
}

.printer-settings {
  @apply mt-4 pt-4 space-y-4;
  border-top: 1px solid rgba(var(--color-surface-200), 0.8);
}

.printer-test-section {
  @apply flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-4;
  border-top: 1px solid rgba(var(--color-surface-200), 0.5);
}

.printer-test-result {
  @apply text-sm font-medium px-3 py-1.5 rounded-lg;
}

.printer-test-result.success {
  background: rgba(var(--color-success-500), 0.1);
  color: rgb(var(--color-success-600));
}

.printer-test-result.error {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

/* Slide-fade animation for printer settings */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 200ms ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Fade animation for test result */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
