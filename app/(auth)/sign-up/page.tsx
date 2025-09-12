"use client"
import { useState } from "react"
import { SignupForm } from "@/components/forms/signUpForm"
import { useSignUpForm } from "@/hooks/useForms"
import { signUpFormData } from "@/lib/types/formTypes"
import { signup } from "./actions"

export default function SignUpPage() {
	const form = useSignUpForm();
	const [errors, setErrors] = useState<Record<string, string>>({});

	async function onSubmit(data: signUpFormData) {
		const fd = new FormData();
		fd.append("fullName", data.fullName);
		fd.append("email", data.email);
		fd.append("phone", data.phone);
		fd.append("password", data.password);

		const result = await signup(fd);
		if (result.success) {
			window.location.href = "/dashboard";
		} else {
			const fe: Record<string, string> = {};
			Object.entries(result.errors || {}).forEach(([k, v]) => {
				fe[k] = Array.isArray(v) ? v.join(", ") : String(v);
			});
			setErrors(fe);
		}
	}

	return (
		<main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
			<div className="w-full max-w-sm ">
				<SignupForm form={form} errors={errors} onSubmit={onSubmit} />
			</div>
		</main>
	)
}
