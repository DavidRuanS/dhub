import { useEffect } from 'react'

type SpeechRecognitionAlternativeLike = { transcript: string }
type SpeechRecognitionResultLike = { [index: number]: SpeechRecognitionAlternativeLike }
type SpeechRecognitionEventLike = Event & { results: { [index: number]: SpeechRecognitionResultLike } }
type SpeechRecognitionErrorEventLike = Event & { error: string }

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  abort: () => void
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type SpeechWindow = typeof window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

let activeRecognition: SpeechRecognitionLike | null = null
let activeButton: HTMLButtonElement | null = null

function setReactValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  setter?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function stopCurrentRecognition() {
  activeRecognition?.abort()
  if (activeButton) {
    activeButton.classList.remove('listening')
    activeButton.textContent = '🎙 Ditar'
  }
  activeRecognition = null
  activeButton = null
}

export default function AgendaVoiceEnhancer() {
  useEffect(() => {
    const speechWindow = window as SpeechWindow
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    const enhanceAgendaModal = () => {
      document.querySelectorAll<HTMLFormElement>('.modal').forEach(form => {
        const isAgendaEvent = Array.from(form.querySelectorAll<HTMLElement>('.field > span'))
          .some(span => span.textContent?.trim() === 'Compromisso')
        if (!isAgendaEvent) return

        const supportedFields = new Set(['Compromisso', 'Local', 'Observações'])

        form.querySelectorAll<HTMLLabelElement>('.field').forEach(label => {
          const caption = label.querySelector<HTMLElement>(':scope > span')?.textContent?.trim() || ''
          if (!supportedFields.has(caption) || label.querySelector('.voiceDictationButton')) return

          const target = label.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
          if (!target) return

          label.classList.add('voiceField')
          const button = document.createElement('button')
          button.type = 'button'
          button.className = 'voiceDictationButton'
          button.textContent = Recognition ? '🎙 Ditar' : '🎙 Indisponível'
          button.disabled = !Recognition
          button.title = Recognition
            ? `Ditar ${caption.toLowerCase()}`
            : 'Este navegador não oferece ditado por voz.'

          button.addEventListener('click', () => {
            if (!Recognition) return
            stopCurrentRecognition()

            const recognition = new Recognition()
            activeRecognition = recognition
            activeButton = button
            recognition.lang = 'pt-BR'
            recognition.continuous = false
            recognition.interimResults = false

            recognition.onstart = () => {
              button.classList.add('listening')
              button.textContent = '● Ouvindo…'
            }

            recognition.onresult = event => {
              const transcript = event.results[0]?.[0]?.transcript?.trim()
              if (!transcript) return
              const current = target.value.trim()
              setReactValue(target, current ? `${current} ${transcript}` : transcript)
              target.focus()
            }

            recognition.onerror = event => {
              const message = event.error === 'not-allowed'
                ? 'Permita o acesso ao microfone para usar o ditado.'
                : 'Não foi possível reconhecer a fala. Tente novamente.'
              window.alert(message)
            }

            recognition.onend = () => {
              button.classList.remove('listening')
              button.textContent = '🎙 Ditar'
              activeRecognition = null
              activeButton = null
            }

            try {
              recognition.start()
            } catch {
              window.alert('O microfone já está em uso. Aguarde e tente novamente.')
              stopCurrentRecognition()
            }
          })

          label.appendChild(button)
        })
      })
    }

    enhanceAgendaModal()
    const observer = new MutationObserver(enhanceAgendaModal)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      stopCurrentRecognition()
    }
  }, [])

  return null
}
