import type { ItemForm } from '~/services/shared/itemForm'

/** Exposes the shared item form (state + actions live in createItemForm) to the fields view. */
export function useDetailsForm(props: { form: ItemForm }) {
  const { form, errors, options, toggle, setCategory } = props.form
  return { values: form, errors, options, toggle, setCategory }
}
