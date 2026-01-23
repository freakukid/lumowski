import * as XLSX from 'xlsx'
import type { ColumnDefinition, DynamicInventoryItem } from '~/types/schema'
import type { ExportFormat, ExportOptions } from '~/types/import'

/**
 * Composable for exporting inventory data
 */
export const useExport = () => {
  const { authFetch } = useAuthFetch()

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Format a cell value based on column type
   */
  const formatCellValue = (
    value: unknown,
    column: ColumnDefinition
  ): string | number => {
    if (value === null || value === undefined || value === '') {
      return ''
    }

    switch (column.type) {
      case 'number':
      case 'currency':
        const num = Number(value)
        return isNaN(num) ? String(value) : num

      case 'date':
        if (value instanceof Date) {
          return value.toISOString().split('T')[0]
        }
        // Try to parse and format date string
        const dateVal = new Date(String(value))
        if (!isNaN(dateVal.getTime())) {
          return dateVal.toISOString().split('T')[0]
        }
        return String(value)

      case 'text':
      case 'select':
      default:
        return String(value)
    }
  }

  /**
   * Transform items into export-ready format
   */
  const transformItemsForExport = (
    items: DynamicInventoryItem[],
    columns: ColumnDefinition[]
  ): Record<string, string | number>[] => {
    return items.map((item) => {
      const row: Record<string, string | number> = {}

      for (const column of columns) {
        const value = item.data[column.id]
        row[column.name] = formatCellValue(value, column)
      }

      return row
    })
  }

  /**
   * Export items to Excel (.xlsx) format
   */
  const exportToExcel = (
    data: Record<string, string | number>[],
    filename: string
  ): void => {
    // Create a new workbook
    const workbook = XLSX.utils.book_new()

    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(data)

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory')

    // Generate file and trigger download
    XLSX.writeFile(workbook, `${filename}.xlsx`)
  }

  /**
   * Export items to CSV format
   */
  const exportToCSV = (
    data: Record<string, string | number>[],
    filename: string
  ): void => {
    // Create a new workbook
    const workbook = XLSX.utils.book_new()

    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(data)

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory')

    // Generate CSV and trigger download
    XLSX.writeFile(workbook, `${filename}.csv`, { bookType: 'csv' })
  }

  /**
   * Export items to JSON format
   */
  const exportToJSON = (
    data: Record<string, string | number>[],
    filename: string
  ): void => {
    try {
      const jsonString = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}.json`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()

      // Clean up - check if link is still in the DOM before removing
      // (prevents DOMException in test environments where the element may already be removed)
      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link)
        }
        URL.revokeObjectURL(url)
      }, 100)
    } catch (err) {
      throw new Error(`Failed to export JSON: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  /**
   * Fetch all items for export (when exportAll is true)
   */
  const fetchAllItems = async (): Promise<DynamicInventoryItem[]> => {
    const allItems: DynamicInventoryItem[] = []
    let page = 1
    const limit = 100
    let hasMore = true

    while (hasMore) {
      const response = await authFetch<{
        items: DynamicInventoryItem[]
        pagination: { totalPages: number }
      }>('/api/inventory', {
        query: { page, limit },
      })

      allItems.push(...response.items)

      if (page >= response.pagination.totalPages) {
        hasMore = false
      } else {
        page++
      }
    }

    return allItems
  }

  /**
   * Main export function
   */
  const exportItems = async (
    items: DynamicInventoryItem[],
    columns: ColumnDefinition[],
    options: ExportOptions
  ): Promise<boolean> => {
    isLoading.value = true
    error.value = null

    try {
      // If exporting all items, fetch them first
      let itemsToExport = items
      if (options.exportAll) {
        itemsToExport = await fetchAllItems()
      }

      // Filter columns based on options
      const columnsToExport = columns.filter((col) =>
        options.columnIds.includes(col.id)
      )

      if (columnsToExport.length === 0) {
        error.value = 'Please select at least one column to export.'
        return false
      }

      // Transform data
      const data = transformItemsForExport(itemsToExport, columnsToExport)

      if (data.length === 0) {
        error.value = 'No items to export.'
        return false
      }

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = options.filename || `inventory-export-${timestamp}`

      // Export based on format
      switch (options.format) {
        case 'xlsx':
          exportToExcel(data, filename)
          break
        case 'csv':
          exportToCSV(data, filename)
          break
        case 'json':
          exportToJSON(data, filename)
          break
        default:
          error.value = 'Unsupported export format.'
          return false
      }

      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Export failed'
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get the file extension for a given format
   */
  const getFileExtension = (format: ExportFormat): string => {
    return format
  }

  /**
   * Get the MIME type for a given format
   */
  const getMimeType = (format: ExportFormat): string => {
    switch (format) {
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      case 'csv':
        return 'text/csv'
      case 'json':
        return 'application/json'
      default:
        throw new Error(`Unknown export format: ${format}`)
    }
  }

  return {
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    exportItems,
    getFileExtension,
    getMimeType,
  }
}
