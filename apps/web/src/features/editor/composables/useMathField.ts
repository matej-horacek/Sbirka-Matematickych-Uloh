import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import { MathfieldElement } from 'mathlive'

MathfieldElement.soundsDirectory = null 

export function useMathField(el: Ref<MathfieldElement | null>, latex: Ref<string>) {
  function onInput() {
    if (el.value) latex.value = el.value.getValue('latex')
  }

  onMounted(() => {
    const field = el.value
    if (!field) return
    field.value = latex.value 
    field.addEventListener('input', onInput)
  })

  onBeforeUnmount(() => el.value?.removeEventListener('input', onInput))

  watch(latex, (v) => {
    if (el.value && el.value.getValue('latex') !== v) el.value.value = v
  })
}