import { SignUpFormContainer } from "./features/signUpContainer";
import { SignUpProvider } from "./features/signUpContext"

export default function SignUpPage() {
	// Log para debug - executado no servidor
	console.info('📄 [SignUpPage] Página renderizada (server-side)');
	
	return (
		<SignUpProvider>
			<SignUpFormContainer />
		</SignUpProvider>
	);
}
