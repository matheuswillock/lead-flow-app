import { ExpiredAdhesionProvider } from "./features/context/ExpiredAdhesionContext"
import { ExpiredAdhesionContainer } from "./features/container/ExpiredAdhesionContainer"

export default function BackofficeAdhesionExpiredPage() {
  return (
    <ExpiredAdhesionProvider>
      <ExpiredAdhesionContainer />
    </ExpiredAdhesionProvider>
  )
}
