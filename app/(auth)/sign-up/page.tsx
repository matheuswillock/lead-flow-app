import { SignUpFormContainer } from "./features/signUpContainer";
import { SignUpProvider } from "./features/signUpContext"

export default function SignUpPage() {
	return (
		<SignUpProvider>
			<SignUpFormContainer />
		</SignUpProvider>
	);
}
