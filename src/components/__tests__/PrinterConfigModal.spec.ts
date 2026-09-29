import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PrinterConfigModal from '@/components/PrinterConfigModal.vue'
import { createTestI18n } from '@/test/i18n'
import { DEFAULT_BADGE_CONFIG } from '@/types/badge'
import { DEFAULT_QL800_CONFIG } from '@/types/ql800'

function mountModal(
  props: Partial<{
    config: typeof DEFAULT_BADGE_CONFIG
    ql800Config: typeof DEFAULT_QL800_CONFIG
    eventTitle: string
    availableFieldKeys: string[]
    groupCount: number
    excludedEmails: string[]
    attendeeEmails: string[]
  }> = {},
) {
  return mount(PrinterConfigModal, {
    props: {
      config: { ...DEFAULT_BADGE_CONFIG },
      ql800Config: { ...DEFAULT_QL800_CONFIG },
      eventTitle: 'Gebetskonferenz 2026',
      availableFieldKeys: [],
      groupCount: 4,
      excludedEmails: [],
      attendeeEmails: [],
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

  it('émet save avec le mode noir et blanc et le logo masqué', async () => {
    const wrapper = mountModal()

    await wrapper.find('input[type="radio"][value="bw"]').setValue(true)
    const logoCheckbox = wrapper.findAll('input[type="checkbox"]').find((c) =>
      c.element.parentElement?.textContent?.includes('Logo'),
    )
    await logoCheckbox!.setValue(false)

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Enregistrer')!
      .trigger('click')

    const saved = wrapper.emitted('save')?.[0]?.[0] as typeof DEFAULT_BADGE_CONFIG
    expect(saved.colorMode).toBe('bw')
    expect(saved.showLogo).toBe(false)
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

  it('gère la liste des emails exclus : ajout, affichage, retrait', async () => {
    const wrapper = mountModal({ excludedEmails: ['staff@wach-auf.com'] })

    // Email déjà listé affiché
    expect(wrapper.text()).toContain('staff@wach-auf.com')

    // Ajout via le champ + bouton
    await wrapper.find('#excluded-email').setValue('invite@wach-auf.com')
    await wrapper.findAll('button').find((b) => b.text() === 'Exclure')!.trigger('click')
    expect(wrapper.emitted('addExclusion')).toEqual([['invite@wach-auf.com']])

    // Entrée vide : aucun événement émis
    await wrapper.findAll('button').find((b) => b.text() === 'Exclure')!.trigger('click')
    expect(wrapper.emitted('addExclusion')).toHaveLength(1)

    // Retrait via ✕
    await wrapper.find('button.exclusion-remove').trigger('click')
    expect(wrapper.emitted('removeExclusion')).toEqual([['staff@wach-auf.com']])
  })

  it('propose les emails des participants en autocomplete', () => {
    const wrapper = mountModal({
      attendeeEmails: ['alice@example.com', 'bob@example.com'],
    })

    const options = wrapper.findAll('datalist#attendee-emails option')
    expect(options.map((o) => o.attributes('value'))).toEqual([
      'alice@example.com',
      'bob@example.com',
    ])
    expect(wrapper.find('#excluded-email').attributes('list')).toBe('attendee-emails')
  })

  it('émet saveQl800 avec l’URL de l’agent au clic sur Enregistrer', async () => {
    const wrapper = mountModal()

    await wrapper.find('#ql800-agent-url').setValue('http://192.168.1.20:9100')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Enregistrer')!
      .trigger('click')

    expect(wrapper.emitted('saveQl800')).toEqual([[{ agentUrl: 'http://192.168.1.20:9100' }]])
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('émet close au clic sur ✕ et sur le fond', async () => {
    const wrapper = mountModal()

    await wrapper.find('button.close').trigger('click')
    await wrapper.find('.overlay').trigger('click.self')

    expect(wrapper.emitted('close')).toHaveLength(2)
  })
})
