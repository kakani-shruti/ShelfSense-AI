export const EXPIRING_SOON_DAYS = 3

const shelfLifeField = {
  room_temperature: 'room_temperature_shelf_life_days',
  refrigerator: 'refrigerated_shelf_life_days',
  freezer: 'frozen_shelf_life_days',
}

export function toLocalDate(value) {
  if (!value) return null
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toDateInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

export function calculateEstimatedExpiry(item) {
  if (item.custom_expiry_date) return item.custom_expiry_date
  const shelfLife = item.food?.[shelfLifeField[item.storage_type]]
  const purchaseDate = toLocalDate(item.purchase_date)
  if (shelfLife == null || !purchaseDate) return null
  purchaseDate.setDate(purchaseDate.getDate() + Number(shelfLife))
  return toDateInputValue(purchaseDate)
}

export function daysUntil(dateValue, today = new Date()) {
  const date = toLocalDate(dateValue)
  if (!date) return null
  const referenceDate = today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date()
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
  return Math.ceil((date - start) / 86_400_000)
}

export function getFreshnessStatus(item, today = new Date()) {
  if (item.status === 'consumed') return { key: 'consumed', label: 'Consumed', tone: 'neutral' }
  if (item.status === 'wasted') return { key: 'wasted', label: 'Wasted', tone: 'danger' }
  const remaining = daysUntil(calculateEstimatedExpiry(item), today)
  if (remaining == null) return { key: 'fresh', label: 'Fresh', tone: 'success' }
  if (remaining < 0) return { key: 'expired', label: 'Expired', tone: 'danger' }
  if (remaining <= EXPIRING_SOON_DAYS) return { key: 'expiring', label: 'Expiring soon', tone: 'warning' }
  return { key: 'fresh', label: 'Fresh', tone: 'success' }
}

export function formatDate(value) {
  const date = toLocalDate(value)
  return date ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : 'Not available'
}

export function formatStorage(value) {
  return { room_temperature: 'Room temperature', refrigerator: 'Refrigerator', freezer: 'Freezer' }[value] || value
}

export function formatMoney(value) {
  return value == null ? 'Not provided' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)
}

export function validateInventory(values) {
  const errors = {}
  if (!values.food_id) errors.food_id = 'Choose a food.'
  if (!(Number(values.quantity_purchased) > 0)) errors.quantity_purchased = 'Quantity must be greater than zero.'
  if (!values.unit) errors.unit = 'Choose a unit.'
  if (!values.purchase_date) errors.purchase_date = 'Purchase date is required.'
  if (!values.storage_type) errors.storage_type = 'Choose a storage type.'
  if (values.purchase_price !== '' && Number(values.purchase_price) < 0) errors.purchase_price = 'Price cannot be negative.'
  return errors
}
