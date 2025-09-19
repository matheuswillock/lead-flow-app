import { SignUpFormContainer } from "./features/container/signUpContainer";
import { SignUpProvider } from "./features/container/signUpContext"

export default function SignUpPage() {
	return (
		<SignUpProvider>
			<SignUpFormContainer />
		</SignUpProvider>
	);
}
