import { LoginPageView } from "@/components/auth/LoginPageView";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LoginPageView initialError={error} />;
}
