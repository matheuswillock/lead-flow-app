import { ForgotPasswordProvider } from './features/context/ForgotPasswordContext';
import { ForgotPasswordContainer } from './features/container/ForgotPasswordContainer';

export default function ForgotPasswordPage() {
  return (
    <ForgotPasswordProvider>
      <ForgotPasswordContainer />
    </ForgotPasswordProvider>
  );
}
