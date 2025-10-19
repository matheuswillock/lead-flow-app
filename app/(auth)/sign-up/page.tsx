import { Suspense } from "react";
import { SignUpFormContainer } from "./features/signUpContainer";
import { SignUpProvider } from "./features/signUpContext"
import { PageLoading } from "@/components/global-loading";

export default function SignUpPage() {
	// Log para debug - executado no servidor
	console.info('📄 [SignUpPage] Página renderizada (server-side)');
	
	return (
		<SignUpProvider>
			<Suspense fallback={<PageLoading />}>
				<SignUpFormContainer />
			</Suspense>
		</SignUpProvider>
	);
}
