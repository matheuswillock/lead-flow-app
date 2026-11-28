import { spawn } from "node:child_process"

export type HermesCommandExecutor = (args: string[], message: string) => Promise<void>

export interface IWhatsAppSender {
  send(phoneE164: string, message: string): Promise<void>
}

const E164_PATTERN = /^\+[1-9]\d{7,14}$/
const PROFILE_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/
const SEND_TIMEOUT_MS = 30_000

function executeHermesCommand(args: string[], message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("hermes", args, {
      shell: false,
      stdio: ["pipe", "ignore", "ignore"],
    })
    let settled = false

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (error) reject(error)
      else resolve()
    }

    const timeout = setTimeout(() => {
      child.kill("SIGTERM")
      finish(new Error("O envio pelo Hermes excedeu o tempo limite."))
    }, SEND_TIMEOUT_MS)

    child.once("error", () => finish(new Error("Não foi possível iniciar o Hermes CLI.")))
    child.once("close", (exitCode) => {
      if (exitCode === 0) {
        finish()
      } else {
        finish(new Error("O Hermes CLI não confirmou a aceitação da mensagem."))
      }
    })

    if (!child.stdin) {
      child.kill("SIGTERM")
      finish(new Error("Não foi possível transmitir a mensagem ao Hermes CLI."))
      return
    }

    child.stdin.once("error", () => {
      child.kill("SIGTERM")
      finish(new Error("Não foi possível transmitir a mensagem ao Hermes CLI."))
    })
    child.stdin.end(message)
  })
}

export function createHermesWhatsAppSender(
  profileName: string,
  execute: HermesCommandExecutor = executeHermesCommand,
): IWhatsAppSender {
  if (!PROFILE_PATTERN.test(profileName)) {
    throw new Error("O perfil dedicado do Hermes é inválido.")
  }

  return {
    async send(phoneE164, message) {
      if (!E164_PATTERN.test(phoneE164)) {
        throw new Error("O destinatário deve estar em formato E.164.")
      }
      if (message.trim().length === 0) {
        throw new Error("A mensagem não pode estar vazia.")
      }

      const target = `whatsapp:${phoneE164.slice(1)}`
      await execute(["-p", profileName, "send", "--to", target, "--file", "-", "--quiet"], message)
    },
  }
}
