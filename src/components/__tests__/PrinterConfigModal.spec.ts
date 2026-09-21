import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PrinterConfigModal from '@/components/PrinterConfigModal.vue'
import { createTestI18n } from '@/test/i18n'
import { DEFAULT_BADGE_CONFIG } from '@/types/badge'

function mountModal(
  props: Partial<{
    config: typeof DEFAULT_BADGE_CONFIG
    eventTitle: string
    availableFieldKeys: string[]
    groupCount: number
  }> = {},
) {
  return mount(PrinterConfigModal, {
    props: {
      config: { ...DEFAULT_BADGE_CONFIG },
      eventTitle: 'Gebetskonferenz 2026',
      availableFieldKeys: [],
      groupCount: 4,
      ...props,
    },
    global: { plugins: [createTestI18n()] },
  })
}

describe('PrinterConfigModal', () => {
  it('affiche les options de champs du badge', () => {
    const wrapper = mountModal({ availableFieldKeys: ['Ab wann willst du dabei sein?'] })

    expect(wrapper.text()).toContain('Configuration d’impression')
    expect(wrapper.text()).toContain('Billet')
    expect(wrapper.text()).toContain('À partir de quand serez-vous présent ?')
  })

  it('émet save avec le titre personnalisé et les champs cochés', async () => {
    const wrapper = mountModal({ availableFieldKeys: ['Kinder'] })

    await wrapper.find('#badge-title').setValue('Conférence spéciale')
    const fieldCheckbox = wrapper.findAll('input[type="checkbox"]').find((c) =>
      c.element.parentElement?.textContent?.includes('Enfants'),
    )
    await fieldCheckbox!.setValue(true)

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Enregistrer')!
      .trigger('click')

    const saved = wrapper.emitted('save')?.[0]?.[0] as typeof DEFAULT_BADGE_CONFIG
    expect(saved.customTitle).toBe('Conférence spéciale')
    expect(saved.fieldKeys).toContain('Kinder')
  })

  it('émet groupCountChange et autoAssign', async () => {
    const wrapper = mountModal()

    await wrapper.find('#group-count').setValue(6)
    expect(wrapper.emitted('groupCountChange')).toEqual([[6]])

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Répartir automatiquement')!
      .trigger('click')
    expect(wrapper.emitted('autoAssign')).toHaveLength(1)
  })

  it('émet close au clic sur ✕ et sur le fond', async () => {
    const wrapper = mountModal()

    await wrapper.find('button.close').trigger('click')
    await wrapper.find('.overlay').trigger('click.self')

    expect(wrapper.emitted('close')).toHaveLength(2)
  })
})
