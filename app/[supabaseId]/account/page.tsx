import { AccountContainer } from "./features/container/AccountContainer";
import { AccountProvider } from "./features/container/AccountContext";

export default function AccountPage() {
  return (
    <AccountProvider>
      <AccountContainer />
    </AccountProvider>
  );
}
