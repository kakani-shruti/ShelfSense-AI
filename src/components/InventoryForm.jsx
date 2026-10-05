import { useEffect, useMemo, useState } from 'react'
import { calculateEstimatedExpiry, formatDate, validateInventory } from '../utils/inventory'

const units = ['g', 'kg', 'ml', 'L', 'pcs', 'dozen', 'pack']
const storageOptions = [
  ['room_temperature', 'Room temperature'], ['refrigerator', 'Refrigerator'], ['freezer', 'Freezer'],
]

export default function InventoryForm({ foods, initialValues, onSubmit, submitLabel = 'Add to inventory', busy }) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [foodSearch, setFoodSearch] = useState('')
  useEffect(() => setValues(initialValues), [initialValues])
  const selectedFood = foods.find((food) => food.id === values.food_id)
  const matches = useMemo(() => foods.filter((food) => `${food.name} ${food.category}`.toLowerCase().includes(foodSearch.toLowerCase())), [foods, foodSearch])
  const estimate = calculateEstimatedExpiry({ ...values, food: selectedFood })
  const set = (field, value) => { setValues((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined })) }
  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = validateInventory(values)
    if (initialValues.quantity_remaining !== undefined && !(Number(values.quantity_remaining) >= 0)) nextErrors.quantity_remaining = 'Remaining quantity cannot be negative.'
    if (Object.keys(nextErrors).length) return setErrors(nextErrors)
    await onSubmit(values)
  }
  return <form className="inventory-form" onSubmit={submit} noValidate>
    <div className="field field--full"><label htmlFor="food-search">Food</label><input id="food-search" type="search" placeholder="Search foods or categories" value={foodSearch} onChange={(e) => setFoodSearch(e.target.value)} disabled={Boolean(initialValues.food_id)} /><select aria-label="Food selection" value={values.food_id} onChange={(e) => { const food = foods.find((entry) => entry.id === e.target.value); set('food_id', e.target.value); if (food) set('unit', food.default_unit) }} disabled={Boolean(initialValues.food_id)}><option value="">Select a food</option>{matches.map((food) => <option key={food.id} value={food.id}>{food.name} · {food.category}</option>)}</select>{errors.food_id && <span className="field-error">{errors.food_id}</span>}</div>
    <div className="field"><label htmlFor="quantity">{initialValues.quantity_remaining !== undefined ? 'Purchased quantity' : 'Quantity'}</label><input id="quantity" type="number" min="0.001" step="0.001" value={values.quantity_purchased} onChange={(e) => set('quantity_purchased', e.target.value)} />{errors.quantity_purchased && <span className="field-error">{errors.quantity_purchased}</span>}</div>
    {initialValues.quantity_remaining !== undefined && <div className="field"><label htmlFor="remaining">Remaining quantity</label><input id="remaining" type="number" min="0" step="0.001" value={values.quantity_remaining} onChange={(e) => set('quantity_remaining', e.target.value)} />{errors.quantity_remaining && <span className="field-error">{errors.quantity_remaining}</span>}</div>}
    <div className="field"><label htmlFor="unit">Unit</label><select id="unit" value={values.unit} onChange={(e) => set('unit', e.target.value)}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select>{errors.unit && <span className="field-error">{errors.unit}</span>}</div>
    <div className="field"><label htmlFor="purchase-date">Purchase date</label><input id="purchase-date" type="date" value={values.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} />{errors.purchase_date && <span className="field-error">{errors.purchase_date}</span>}</div>
    <div className="field"><label htmlFor="storage">Storage</label><select id="storage" value={values.storage_type} onChange={(e) => set('storage_type', e.target.value)}>{storageOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{errors.storage_type && <span className="field-error">{errors.storage_type}</span>}</div>
    <div className="field"><label htmlFor="price">Purchase price <span>Optional</span></label><input id="price" type="number" min="0" step="0.01" placeholder="0.00" value={values.purchase_price} onChange={(e) => set('purchase_price', e.target.value)} />{errors.purchase_price && <span className="field-error">{errors.purchase_price}</span>}</div>
    <div className="field field--full"><label htmlFor="expiry">Custom expiry date <span>Optional</span></label><input id="expiry" type="date" value={values.custom_expiry_date} onChange={(e) => set('custom_expiry_date', e.target.value)} /><small>Leave empty to estimate expiry from the food’s typical shelf life and storage type.</small>{estimate && <div className="estimate-note">Current estimated expiry: <strong>{formatDate(estimate)}</strong></div>}</div>
    <div className="field field--full"><label htmlFor="notes">Notes <span>Optional</span></label><textarea id="notes" rows="3" placeholder="Anything useful to remember" value={values.notes} onChange={(e) => set('notes', e.target.value)} /></div>
    <div className="form-actions field--full"><button className="button" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button></div>
  </form>
}
